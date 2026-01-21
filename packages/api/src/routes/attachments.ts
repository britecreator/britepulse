/**
 * Attachment routes
 * GET /attachments/:attachment_id - Get signed URL for attachment
 */

import { Router, type IRouter, type Request, type Response } from 'express';
import { asyncHandler, APIError, oauthAuth } from '../middleware/index.js';
import { hasAppAccess } from '@britepulse/shared';
import * as firestoreService from '../services/firestore.js';
import * as storageService from '../services/storage.js';

const router: IRouter = Router();

// Helper to extract token from query param (for redirect endpoint)
function extractTokenFromQuery(req: Request): string | null {
  const token = req.query.token as string;
  return token || null;
}

/**
 * GET /attachments/:attachment_id
 * Get a signed URL for viewing an attachment
 * Requires authentication and access to the app the attachment belongs to
 */
router.get(
  '/:attachment_id',
  oauthAuth(true),
  asyncHandler(async (req, res) => {
    const { attachment_id } = req.params;

    // Get attachment metadata
    const attachment = await firestoreService.getAttachment(attachment_id);
    if (!attachment) {
      throw APIError.notFound('Attachment');
    }

    // Check if user has access to the app
    const user = req.auth?.user;
    if (!user) {
      throw APIError.unauthorized('Authentication required');
    }

    if (!hasAppAccess(user, attachment.app_id)) {
      throw APIError.forbidden('You do not have access to this attachment');
    }

    // Check if storage is configured
    if (!storageService.isStorageConfigured()) {
      throw APIError.internal('Storage not configured');
    }

    // Generate signed URL
    const signedUrl = await storageService.generateSignedUrl(attachment.storage_path);

    // Return signed URL (client can use this to fetch the image)
    res.json({
      data: {
        attachment_id: attachment.attachment_id,
        filename: attachment.filename,
        content_type: attachment.content_type,
        size_bytes: attachment.size_bytes,
        url: signedUrl,
        expires_in_minutes: 15,
      },
    });
  })
);

/**
 * GET /attachments/:attachment_id/redirect
 * Redirect to signed URL for direct image access
 * Supports token in query param for embedding images
 */
router.get(
  '/:attachment_id/redirect',
  asyncHandler(async (req: Request, res: Response) => {
    const { attachment_id } = req.params;

    // For redirect endpoint, also accept token in query string
    // This allows embedding images directly in HTML
    const queryToken = extractTokenFromQuery(req);
    if (queryToken) {
      // Set authorization header for the oauthAuth middleware
      req.headers.authorization = `Bearer ${queryToken}`;
    }

    // Apply OAuth auth manually
    await new Promise<void>((resolve, reject) => {
      oauthAuth(true)(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Get attachment metadata
    const attachment = await firestoreService.getAttachment(attachment_id);
    if (!attachment) {
      throw APIError.notFound('Attachment');
    }

    // Check if user has access to the app
    const user = req.auth?.user;
    if (!user) {
      throw APIError.unauthorized('Authentication required');
    }

    if (!hasAppAccess(user, attachment.app_id)) {
      throw APIError.forbidden('You do not have access to this attachment');
    }

    // Check if storage is configured
    if (!storageService.isStorageConfigured()) {
      throw APIError.internal('Storage not configured');
    }

    // Generate signed URL and redirect
    const signedUrl = await storageService.generateSignedUrl(attachment.storage_path);
    res.redirect(signedUrl);
  })
);

export default router;
