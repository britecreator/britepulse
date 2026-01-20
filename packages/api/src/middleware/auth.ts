/**
 * Authentication middleware
 * Supports: API keys (public/server) and Google OAuth
 */

import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import type { UserSession, UserRole, AuthType } from '@britepulse/shared';
import { config } from '../config.js';
import { APIError } from './error-handler.js';
import * as firestoreService from '../services/firestore.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auth?: {
        type: AuthType;
        appId?: string; // For API key auth
        user?: UserSession; // For OAuth auth
      };
    }
  }
}

// OAuth client (singleton)
let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (!oauthClient) {
    oauthClient = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      config.oauthRedirectUri
    );
  }
  return oauthClient;
}

/**
 * Validate API key format
 */
function isValidKeyFormat(key: string): boolean {
  // Keys should be at least 32 chars, alphanumeric + dashes + underscores
  return /^[a-zA-Z0-9_-]{32,}$/.test(key);
}

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): { type: 'public' | 'server'; key: string } | null {
  // Check X-API-Key header
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    // Server keys are prefixed with 'sk_', public keys with 'pk_'
    if (apiKey.startsWith('sk_')) {
      return { type: 'server', key: apiKey };
    }
    if (apiKey.startsWith('pk_')) {
      return { type: 'public', key: apiKey };
    }
  }

  // Check query param (for public key only, used by SDK)
  const queryKey = req.query.key as string;
  if (queryKey && queryKey.startsWith('pk_')) {
    return { type: 'public', key: queryKey };
  }

  return null;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Verify Google ID token
 */
async function verifyGoogleToken(token: string): Promise<{
  email: string;
  name?: string;
  sub: string;
} | null> {
  try {
    const client = getOAuthClient();
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) return null;

    // Check domain restriction
    if (config.allowedDomain && payload.hd !== config.allowedDomain) {
      console.warn(`Token domain mismatch: expected ${config.allowedDomain}, got ${payload.hd}`);
      return null;
    }

    return {
      email: payload.email!,
      name: payload.name,
      sub: payload.sub,
    };
  } catch (error) {
    console.error('Google token verification failed:', error);
    return null;
  }
}

/**
 * API Key authentication middleware
 * Used for: SDK event ingestion
 */
export function apiKeyAuth(keyType: 'public' | 'server' | 'any' = 'any') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      return next(APIError.unauthorized('API key required'));
    }

    if (keyType !== 'any' && apiKey.type !== keyType) {
      return next(APIError.unauthorized(`${keyType} API key required`));
    }

    if (!isValidKeyFormat(apiKey.key.slice(3))) {
      return next(APIError.unauthorized('Invalid API key format'));
    }

    // Validate API key against database
    const validation = await firestoreService.validateApiKey(apiKey.key, apiKey.type);
    if (!validation.valid || !validation.appId) {
      return next(APIError.unauthorized('Invalid API key'));
    }

    req.auth = {
      type: apiKey.type === 'public' ? 'public_key' : 'server_key',
      appId: validation.appId,
    };

    next();
  };
}

/**
 * OAuth authentication middleware
 * Used for: Console access
 */
export function oauthAuth(required = true) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);

    if (!token) {
      if (required) {
        return next(APIError.unauthorized('Authentication required'));
      }
      return next();
    }

    const googleUser = await verifyGoogleToken(token);
    if (!googleUser) {
      return next(APIError.unauthorized('Invalid or expired token'));
    }

    // Look up user in database to get role and app_access
    const dbUser = await firestoreService.getUserByEmail(googleUser.email);
    if (!dbUser) {
      return next(APIError.unauthorized('User not found in system'));
    }

    const userSession: UserSession = {
      user_id: dbUser.user_id,
      email: dbUser.email,
      name: dbUser.name || googleUser.name,
      role: dbUser.role as UserRole,
      app_access: dbUser.app_access || [],
      session_id: req.requestId,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    req.auth = {
      type: 'oauth',
      user: userSession,
    };

    next();
  };
}

/**
 * Combined auth middleware - allows API key OR OAuth
 */
export function combinedAuth(options: {
  allowApiKey?: boolean;
  allowOAuth?: boolean;
  required?: boolean;
} = {}) {
  const { allowApiKey = true, allowOAuth = true, required = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Try API key first
    if (allowApiKey) {
      const apiKey = extractApiKey(req);
      if (apiKey) {
        return apiKeyAuth('any')(req, res, next);
      }
    }

    // Try OAuth
    if (allowOAuth) {
      const token = extractBearerToken(req);
      if (token) {
        return oauthAuth(required)(req, res, next);
      }
    }

    // No auth provided
    if (required) {
      return next(APIError.unauthorized('Authentication required'));
    }

    next();
  };
}

/**
 * Get OAuth authorization URL
 */
export function getAuthorizationUrl(state?: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    hd: config.allowedDomain || undefined,
    state,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}
