/**
 * API Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server - Cloud Run uses PORT, local dev can use API_PORT
  port: parseInt(process.env.PORT || process.env.API_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Google Cloud
  gcpProjectId: process.env.GCP_PROJECT_ID || '',
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
  bigqueryDataset: process.env.BIGQUERY_DATASET || 'britepulse',

  // OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  oauthRedirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  allowedDomain: process.env.ALLOWED_DOMAIN || 'brite.co',

  // Session
  sessionSecret: process.env.SESSION_SECRET || 'development-secret-change-in-production',

  // External services
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'britepulse@brite.co',

  // Scheduler authentication (for Cloud Scheduler to trigger daily briefs)
  schedulerAuthToken: process.env.SCHEDULER_AUTH_TOKEN || '',

  // Console URL (for links in emails)
  consoleBaseUrl: process.env.CONSOLE_BASE_URL || 'http://localhost:3000',

  // Google Cloud Storage (for attachments)
  gcsBucket: process.env.GCS_BUCKET || '',
  attachmentMaxSizeMb: parseInt(process.env.ATTACHMENT_MAX_SIZE_MB || '5', 10),
  attachmentRetentionDays: parseInt(process.env.ATTACHMENT_RETENTION_DAYS || '90', 10),
  attachmentSignedUrlExpiryMinutes: parseInt(process.env.ATTACHMENT_SIGNED_URL_EXPIRY_MINUTES || '15', 10),

  // CORS allowed origins for SDK ingestion (comma-separated)
  // In production, this should include customer app domains
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Rate limiting
  rateLimitWindowMs: 60 * 1000, // 1 minute
  rateLimitMaxRequests: 100,

  // Ingestion rate limiting (higher for SDK)
  ingestionRateLimitWindowMs: 60 * 1000,
  ingestionRateLimitMaxRequests: 1000,
} as const;

/**
 * Validate required configuration
 */
export function validateConfig(): string[] {
  const errors: string[] = [];

  if (config.nodeEnv === 'production') {
    if (!config.gcpProjectId) {
      errors.push('GCP_PROJECT_ID is required in production');
    }
    if (!config.googleClientId) {
      errors.push('GOOGLE_CLIENT_ID is required in production');
    }
    if (!config.googleClientSecret) {
      errors.push('GOOGLE_CLIENT_SECRET is required in production');
    }
    if (config.sessionSecret === 'development-secret-change-in-production') {
      errors.push('SESSION_SECRET must be changed in production');
    }
  }

  return errors;
}
