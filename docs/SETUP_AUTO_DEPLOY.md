# BritePulse Auto-Deploy Setup

This guide explains how to set up automatic deployments to Cloud Run when you push to the main branch.

## How It Works

When you push code to the `main` branch on GitHub, a GitHub Actions workflow will:
1. Build the API and Console Docker images
2. Push them to Google Artifact Registry
3. Deploy them to Cloud Run

## Setup Steps

### 1. Add the GitHub Secret

You need to add the service account key as a GitHub secret:

1. Go to your GitHub repo: https://github.com/britecreator/britepulse
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Name: `GCP_SA_KEY`
5. Value: Paste the entire contents of `github-deploy-key.json` (in the project root)
6. Click **Add secret**

> **Important**: Delete the `github-deploy-key.json` file after adding it to GitHub secrets. Never commit it to the repo.

### 2. Verify the Workflow

The workflow file is at `.github/workflows/deploy.yml`. It's already configured to:
- Trigger on push to `main` branch
- Build both API and Console images
- Deploy to the existing Cloud Run services

### 3. Test It

Push any change to the main branch:
```bash
git add .
git commit -m "Test auto-deploy"
git push origin main
```

Then check the **Actions** tab on GitHub to see the workflow running.

## Deployed URLs

After deployment:
- **Console**: https://britepulse-console-29820647719.us-central1.run.app
- **API**: https://britepulse-api-29820647719.us-central1.run.app

## Troubleshooting

### Workflow fails with permission error

The service account needs these roles (already configured):
- `roles/run.admin` - Deploy to Cloud Run
- `roles/artifactregistry.writer` - Push Docker images
- `roles/iam.serviceAccountUser` - Act as the Cloud Run service account

### Images not updating

1. Check if the workflow completed successfully in the Actions tab
2. Verify the service account key is correctly added as a secret
3. Check Cloud Run logs for any deployment errors

### Environment variables reset

Cloud Run preserves environment variables between deployments. If you need to update them, do it through the Cloud Console or gcloud CLI, not through the deployment workflow.

## Manual Deployment

If you need to deploy without pushing to GitHub:

```bash
# Build and deploy API
gcloud builds submit --config=infrastructure/cloudbuild-api-only.yaml --substitutions=COMMIT_SHA=manual --project=britecreations
gcloud run deploy britepulse-api --image=us-central1-docker.pkg.dev/britecreations/britepulse/api:manual --region=us-central1

# Build and deploy Console (similar pattern)
```
