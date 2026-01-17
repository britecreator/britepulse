/**
 * Authentication routes
 * OAuth login flow for console
 */

import { Router, type IRouter } from 'express';
import { asyncHandler, APIError, getAuthorizationUrl, exchangeCodeForTokens } from '../middleware/index.js';
import { config } from '../config.js';
import * as firestoreService from '../services/firestore.js';

const router: IRouter = Router();

/**
 * GET /auth/google or /auth/login
 * Redirect to Google OAuth
 */
function handleGoogleLogin(req: any, res: any) {
  const state = req.query.redirect as string || '/';
  const authUrl = getAuthorizationUrl(state);
  res.redirect(authUrl);
}

router.get('/login', handleGoogleLogin);
router.get('/google', handleGoogleLogin);

/**
 * GET /auth/callback
 * OAuth callback handler
 */
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      throw APIError.unauthorized(`OAuth error: ${error}`);
    }

    if (!code) {
      throw APIError.badRequest('Authorization code is required');
    }

    try {
      const tokens = await exchangeCodeForTokens(code as string);

      // Verify the ID token
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(config.googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw APIError.unauthorized('Invalid token payload');
      }

      // Check domain restriction
      if (config.allowedDomain && payload.hd !== config.allowedDomain) {
        throw APIError.forbidden(`Only ${config.allowedDomain} users are allowed`);
      }

      // Get or create user
      let user = await firestoreService.getUserByEmail(payload.email!);
      if (!user) {
        // Create new user with default role
        user = await firestoreService.createUser({
          email: payload.email!,
          name: payload.name,
          role: 'ReadOnly', // Default role for new users
          app_access: [],
        });
      }

      // Update last login
      await firestoreService.updateUser(user.user_id, {});

      // Redirect to console with token
      const redirectUrl = new URL(
        state as string || '/',
        config.consoleBaseUrl
      );
      redirectUrl.searchParams.set('token', tokens.id_token!);

      res.redirect(redirectUrl.toString());
    } catch (err) {
      console.error('OAuth callback error:', err);
      throw APIError.unauthorized('Authentication failed');
    }
  })
);

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw APIError.badRequest('refresh_token is required');
    }

    try {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(
        config.googleClientId,
        config.googleClientSecret,
        config.oauthRedirectUri
      );

      client.setCredentials({ refresh_token });
      const { credentials } = await client.refreshAccessToken();

      res.json({
        data: {
          id_token: credentials.id_token,
          expires_at: credentials.expiry_date,
        },
      });
    } catch (err) {
      console.error('Token refresh error:', err);
      throw APIError.unauthorized('Token refresh failed');
    }
  })
);

/**
 * GET /auth/me
 * Get current user info
 */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw APIError.unauthorized('Authentication required');
    }

    const token = authHeader.slice(7);

    try {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(config.googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: config.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw APIError.unauthorized('Invalid token');
      }

      // Check domain
      if (config.allowedDomain && payload.hd !== config.allowedDomain) {
        throw APIError.forbidden(`Only ${config.allowedDomain} users are allowed`);
      }

      // Get user from database
      const user = await firestoreService.getUserByEmail(payload.email!);
      if (!user) {
        throw APIError.notFound('User');
      }

      res.json({
        data: {
          user_id: user.user_id,
          email: user.email,
          name: user.name || payload.name,
          role: user.role,
          app_access: user.app_access,
          picture: payload.picture,
        },
      });
    } catch (err) {
      if (err instanceof APIError) throw err;
      console.error('Auth verification error:', err);
      throw APIError.unauthorized('Authentication failed');
    }
  })
);

/**
 * POST /auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', (_req, res) => {
  // OAuth tokens are stateless, so logout is client-side
  // Just return success
  res.json({
    data: {
      success: true,
      message: 'Logged out successfully',
    },
  });
});

export default router;
