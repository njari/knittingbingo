from aws_cdk import (
    CfnOutput,
    RemovalPolicy,
    Stack,
    aws_apigateway as apigw,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_lambda as _lambda,
)
from constructs import Construct

class BackendStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # DynamoDB
        table = dynamodb.Table(
            self,
            "UserTable",
            table_name="user",
            partition_key=dynamodb.Attribute(name="pk", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="sk", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        community_cards = dynamodb.Table(
            self,
            "CommunityCardsTable",
            table_name="communitycards",
            partition_key=dynamodb.Attribute(name="pk", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="sk", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Cognito (passwordless by using Email OTP via USER_PASSWORD_AUTH disabled; client can use SRP-less flows)
        user_pool = cognito.UserPool(
            self,
            "UserPool",
            sign_in_aliases=cognito.SignInAliases(email=True),
            self_sign_up_enabled=True,
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            user_verification=cognito.UserVerificationConfig(
                email_subject="Your KnitBingo verification code",
                email_body="Your verification code is {####}",
                email_style=cognito.VerificationEmailStyle.CODE,
            ),
        )
        user_pool_client = cognito.UserPoolClient(
            self,
            "UserPoolClient",
            user_pool=user_pool,
            auth_flows=cognito.AuthFlow(user_password=True, user_srp=True),
            generate_secret=False,
        )

        # Lambda
        api_fn = _lambda.Function(
            self,
            "ApiFn",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=_lambda.Code.from_asset("lambda"),
            environment={
                "TABLE_NAME": table.table_name,
                "COMMUNITY_CARDS_TABLE": community_cards.table_name,
            },
        )
        table.grant_read_write_data(api_fn)
        community_cards.grant_read_write_data(api_fn)

        # API Gateway
        api = apigw.RestApi(
            self,
            "Api",
            rest_api_name="knit-bingo-api",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=[
                    "Content-Type",
                    "Authorization",
                ],
            ),
        )

        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "Authorizer",
            cognito_user_pools=[user_pool],
        )

        auth = api.root.add_resource("auth")
        magic_link = auth.add_resource("magic-link")
        magic_link_cb = auth.add_resource("magic-link-callback")

        bingo3x3 = api.root.add_resource("bingo3x3")
        toss = api.root.add_resource("toss")
        community = api.root.add_resource("community")
        community_cards_api = community.add_resource("cards")

        integration = apigw.LambdaIntegration(api_fn)

        # Auth (public)
        magic_link.add_method("POST", integration)
        magic_link_cb.add_method("GET", integration)

        # Bingo board save (authorized via magic-link token)
        bingo3x3.add_method("PUT", integration)

        # Toss (authorized via magic-link token)
        toss.add_method("POST", integration)

        # Community cards list (public)
        community_cards_api.add_method("GET", integration)

        # NOTE: v1 focuses only on magic link auth APIs. Game APIs will be added later.

        CfnOutput(self, "ApiUrl", value=api.url)
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id)
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id)
