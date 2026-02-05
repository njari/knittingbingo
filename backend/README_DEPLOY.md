Deployment notes for backend (CloudFormation)

This backend is deployed as:
- DynamoDB tables: `user`, `communitycards`
- Lambda function: `knit-bingo-api`
- Lambda Function URL (CORS open)

## Required GitHub secrets (CI)
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION

## Artifact bucket
Lambda code must be uploaded as a zip to S3 so CloudFormation can reference it.

Bucket:
- `bingoknitting-artifacts`

Key:
- `backend/lambda.zip`

The GitHub workflow `.github/workflows/deploy-backend-cfn.yml` will:
1) zip `backend/lambda/`
2) upload it to the artifact bucket
3) deploy `backend/template.yaml`

## Deploy locally

```bash
# zip and upload
cd backend/lambda
zip -r ../lambda.zip .
aws s3 cp ../lambda.zip s3://bingoknitting-artifacts/backend/lambda.zip

# deploy stack
aws cloudformation deploy \
  --template-file backend/template.yaml \
  --stack-name knit-bingo-backend \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides LambdaCodeBucket=bingoknitting-artifacts LambdaCodeKey=backend/lambda.zip
```

After deploy, read the **FunctionUrl** output and set it as your frontend `VITE_API_URL`.
