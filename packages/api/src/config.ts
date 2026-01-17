/**
 * API Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.API_PORT || '3001', 10),
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

  // Console URL (for links in emails)
  consoleBaseUrl: process.env.CONSOLE_BASE_URL || 'http://localhost:3000',

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
