Deployment notes for backend (CDK Python)

Required environment variables / GitHub secrets for CI:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION

The CDK Python app is in `backend/`.

To deploy locally:

1. Activate the virtualenv:
   source backend/.venv/bin/activate

2. Install dependencies:
   python -m pip install -r backend/requirements.txt

3. Synthesize / deploy:
   cd backend
   npx cdk synth
   npx cdk deploy --require-approval=never

In CI (GitHub Actions), use the AWS creds from repository secrets and run the same commands.

Environment variables used by Lambda (set via CDK):
- TABLE_NAME (created by CDK)
- COMMUNITY_CARDS_TABLE (created by CDK)

No further secrets are required by the Lambda for v1, because email sending is simulated.
