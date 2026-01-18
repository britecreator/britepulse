#!/bin/bash
# BritePulse Cloud Scheduler Setup Script
# Run this script from Google Cloud Shell or a machine with gcloud CLI configured

set -e

# Configuration
PROJECT_ID="britecreations"
REGION="us-central1"
API_URL="https://britepulse-api-29820647719.us-central1.run.app"
SCHEDULER_TOKEN="acdf7092dd3982b93ef9fa9963243a91ff9af1d56bb733e056ad6c492325f657"

echo "=== BritePulse Scheduler Setup ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "API URL: $API_URL"
echo ""

# Step 1: Set the project
echo "Step 1: Setting GCP project..."
gcloud config set project $PROJECT_ID

# Step 2: Enable required APIs
echo "Step 2: Enabling Cloud Scheduler API..."
gcloud services enable cloudscheduler.googleapis.com

# Step 3: Create secrets in Secret Manager (if they don't exist)
echo "Step 3: Creating secrets in Secret Manager..."

# Function to create or update a secret
create_secret() {
  SECRET_NAME=$1
  SECRET_VALUE=$2

  if gcloud secrets describe $SECRET_NAME --project=$PROJECT_ID &>/dev/null; then
    echo "  Secret $SECRET_NAME already exists, updating..."
    echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME --data-file=-
  else
    echo "  Creating secret $SECRET_NAME..."
    echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME --data-file=- --replication-policy="automatic"
  fi
}

# Create the scheduler auth token secret
create_secret "SCHEDULER_AUTH_TOKEN" "$SCHEDULER_TOKEN"

echo ""
echo "NOTE: You also need to create these secrets manually if not already done:"
echo "  - GOOGLE_CLIENT_ID"
echo "  - GOOGLE_CLIENT_SECRET"
echo "  - SESSION_SECRET"
echo "  - SENDGRID_API_KEY"
echo "  - ANTHROPIC_API_KEY"
echo ""
echo "Use this command pattern:"
echo '  echo -n "your-secret-value" | gcloud secrets create SECRET_NAME --data-file=- --replication-policy="automatic"'
echo ""

# Step 4: Grant Cloud Run service account access to secrets
echo "Step 4: Granting Cloud Run access to secrets..."
SERVICE_ACCOUNT="29820647719-compute@developer.gserviceaccount.com"

for SECRET in SCHEDULER_AUTH_TOKEN GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET SESSION_SECRET SENDGRID_API_KEY ANTHROPIC_API_KEY; do
  echo "  Granting access to $SECRET..."
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID 2>/dev/null || echo "    (may already have access)"
done

# Step 5: Create Cloud Scheduler job
echo "Step 5: Creating Cloud Scheduler job..."

# Delete existing job if it exists
gcloud scheduler jobs delete britepulse-daily-brief --location=$REGION --quiet 2>/dev/null || true

# Create new scheduler job
gcloud scheduler jobs create http britepulse-daily-brief \
  --location=$REGION \
  --schedule="0 8 * * *" \
  --time-zone="America/Chicago" \
  --uri="${API_URL}/briefs/trigger" \
  --http-method=POST \
  --headers="Authorization=Bearer ${SCHEDULER_TOKEN},Content-Type=application/json" \
  --message-body="{}"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Cloud Scheduler job created:"
echo "  Name: britepulse-daily-brief"
echo "  Schedule: 8:00 AM Central, daily"
echo "  Endpoint: ${API_URL}/briefs/trigger"
echo ""
echo "To test the scheduler manually:"
echo "  gcloud scheduler jobs run britepulse-daily-brief --location=$REGION"
echo ""
echo "To view scheduler logs:"
echo "  gcloud logging read 'resource.type=cloud_scheduler_job' --limit=10"
echo ""
