import json
import os
import uuid
from datetime import datetime, timezone

import boto3


class Bingo3x3Card(dict):
    """Backend representation of a single 3x3 bingo card.

    Stored as a plain DynamoDB map via boto3 (so this is a lightweight helper).
    Expected keys:
      - id: str
      - text: str
      - backgroundColor: str (CSS color)
    """

    @staticmethod
    def from_dict(value: dict) -> "Bingo3x3Card":
        if not isinstance(value, dict):
            raise ValueError("card must be an object")
        card_id = value.get("id")
        text = value.get("text")
        background_color = value.get("backgroundColor")
        if not isinstance(card_id, str) or not card_id:
            raise ValueError("card.id must be a non-empty string")
        if not isinstance(text, str):
            raise ValueError("card.text must be a string")
        if not isinstance(background_color, str) or not background_color:
            raise ValueError("card.backgroundColor must be a non-empty string")
        return Bingo3x3Card({"id": card_id, "text": text, "backgroundColor": background_color})


TABLE_NAME = os.environ["TABLE_NAME"]
COMMUNITY_CARDS_TABLE = os.environ["COMMUNITY_CARDS_TABLE"]
ddb = boto3.resource("dynamodb")
table = ddb.Table(TABLE_NAME)
community_table = ddb.Table(COMMUNITY_CARDS_TABLE)


BINGO_3X3_KEY = "bingo3x3"


def save_bingo_3x3_for_user(*, user_id: str, cards: list):
    """Persist a 3x3 (9-card) board onto the user's PROFILE item.

    Stores the cards under the constant key `BINGO_3X3_KEY`.
    """
    if not isinstance(cards, list) or len(cards) != 9:
        raise ValueError("cards must be a list of 9 items")

    cards = [Bingo3x3Card.from_dict(c) for c in cards]

    now = datetime.now(timezone.utc).isoformat()
    table.update_item(
        Key={"pk": f"USER#{user_id}", "sk": "PROFILE"},
        UpdateExpression=f"SET {BINGO_3X3_KEY} = :b, updatedAt = :u",
        ExpressionAttributeValues={
            ":b": cards,
            ":u": now,
        },
    )


def _validate_email(email: str) -> str:
    if not email or not isinstance(email, str):
        raise ValueError("Email is required")
    email = email.strip().lower()
    if "+" in email:
        raise ValueError("Email must not contain '+'")
    if "@" not in email:
        raise ValueError("Invalid email")
    return email


def _json(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(body),
    }


def _bearer_token(event: dict) -> str:
    headers = event.get("headers") or {}
    auth = headers.get("Authorization") or headers.get("authorization")
    if not auth:
        raise ValueError("Missing Authorization header")
    parts = auth.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise ValueError("Invalid Authorization header")
    return parts[1]


def _user_id_for_token(token: str) -> str:
    # v1: scan profile items. Later add a GSI (authToken -> userId).
    resp = table.scan(
        FilterExpression="#sk = :profile AND #authToken = :t",
        ExpressionAttributeNames={
            "#sk": "sk",
            "#authToken": "authToken",
        },
        ExpressionAttributeValues={
            ":profile": "PROFILE",
            ":t": token,
        },
        Limit=1,
    )
    items = resp.get("Items") or []
    if not items:
        raise ValueError("Invalid token")
    return items[0]["userId"]


def _user_id(event: dict) -> str:
    # API Gateway (REST) + Cognito authorizer injects claims here
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
    )
    sub = claims.get("sub")
    if not sub:
        raise ValueError("Missing user identity (sub claim)")
    return sub


def handler(event, context):
    try:
        method = event.get("httpMethod")
        path_params = event.get("pathParameters") or {}
        resource = event.get("resource")
        body_raw = event.get("body") or "{}"
        body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
        # Auth endpoints are public, game endpoints require cognito claims.
        user_id = None
        if resource not in ("/auth/magic-link", "/auth/magic-link-callback"):
            user_id = _user_id(event)

        # POST /auth/magic-link
        if method == "POST" and resource == "/auth/magic-link":
            email = _validate_email(body.get("email"))
            code = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()

            # store forever-valid code (v1) mapped to email
            table.put_item(
                Item={
                    "pk": f"EMAIL#{email}",
                    "sk": "MAGIC",
                    "email": email,
                    "code": code,
                    "createdAt": now,
                }
            )

            # Simulate sending email by returning link and logging
            link = f"/auth/magic-link-callback?code={code}"
            print(f"Magic link for {email}: {link}")
            return _json(200, {"magicLink": link})

        # GET /auth/magic-link-callback?code=...
        if method == "GET" and resource == "/auth/magic-link-callback":
            qs = event.get("queryStringParameters") or {}
            code = qs.get("code")
            if not code:
                return _json(400, {"message": "Missing code"})

            # Look up email by code: scan (acceptable for v1). Later add GSI.
            resp = table.scan(
                FilterExpression="#sk = :magic AND #code = :code",
                ExpressionAttributeNames={
                    "#sk": "sk",
                    "#code": "code",
                },
                ExpressionAttributeValues={
                    ":magic": "MAGIC",
                    ":code": code,
                },
                Limit=1,
            )
            items = resp.get("Items") or []
            if not items:
                return _json(404, {"message": "Invalid code"})
            email = items[0]["email"]

            # Upsert user-by-email without overwriting createdAt if user exists.
            now = datetime.now(timezone.utc).isoformat()

            # 1) Resolve userId for this email (create one if missing)
            mapping_key = {"pk": f"EMAIL#{email}", "sk": "USER"}
            mapping = table.get_item(Key=mapping_key).get("Item")
            if mapping and mapping.get("userId"):
                user_id = mapping["userId"]
            else:
                user_id = str(uuid.uuid4())
                table.put_item(
                    Item={
                        "pk": f"EMAIL#{email}",
                        "sk": "USER",
                        "email": email,
                        "userId": user_id,
                        "createdAt": now,
                    },
                    ConditionExpression="attribute_not_exists(pk)",
                )

            # 2) Create profile if missing (set createdAt once)
            try:
                table.put_item(
                    Item={
                        "pk": f"USER#{user_id}",
                        "sk": "PROFILE",
                        "userId": user_id,
                        "email": email,
                        "createdAt": now,
                    },
                    ConditionExpression="attribute_not_exists(pk)",
                )
            except Exception:
                # already exists
                pass

            # 3) Always update token + lastLoginAt (but not createdAt)
            table.update_item(
                Key={"pk": f"USER#{user_id}", "sk": "PROFILE"},
                UpdateExpression="SET authToken = :t, lastLoginAt = :l",
                ExpressionAttributeValues={
                    ":t": code,
                    ":l": now,
                },
            )

            return _json(200, {"token": code, "userId": user_id, "email": email})

        # PUT /bingo3x3
        if method == "PUT" and resource == "/bingo3x3":
            token = _bearer_token(event)
            user_id = _user_id_for_token(token)
            cards = body.get("cards")
            save_bingo_3x3_for_user(user_id=user_id, cards=cards)
            return _json(200, {"ok": True})

        # POST /toss
        if method == "POST" and resource == "/toss":
            token = _bearer_token(event)
            user_id = _user_id_for_token(token)

            card = Bingo3x3Card.from_dict(body.get("card"))
            now = datetime.now(timezone.utc).isoformat()
            toss_id = str(uuid.uuid4())

            community_table.put_item(
                Item={
                    "pk": "COMMUNITY",
                    "sk": f"TOSS#{now}#{toss_id}",
                    "tossId": toss_id,
                    "tossedAt": now,
                    "userId": user_id,
                    "card": card,
                }
            )

            return _json(201, {"ok": True, "tossId": toss_id})

        # GET /community/cards
        if method == "GET" and resource == "/community/cards":
            # v1: scan. Later: GSI or use pk='COMMUNITY' + query.
            resp = community_table.scan(Limit=50)
            items = resp.get("Items") or []

            # sort newest first (by tossedAt if present, else by sk)
            def _sort_key(x: dict):
                return x.get("tossedAt") or x.get("sk") or ""

            items.sort(key=_sort_key, reverse=True)
            cards = []
            for it in items:
                card = it.get("card")
                if card:
                    cards.append(card)
            return _json(200, {"cards": cards})

        return _json(404, {"message": "Not Found"})
    except Exception as e:
        return _json(500, {"message": str(e)})
