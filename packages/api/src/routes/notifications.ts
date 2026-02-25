/**
 * Notification routes
 * In-app notification feed for mentions and comment activity
 */

import { Router, type IRouter } from 'express';
import { asyncHandler, APIError, oauthAuth } from '../middleware/index.js';
import * as firestoreService from '../services/firestore.js';
import type { NotificationType } from '@britepulse/shared';

const router: IRouter = Router();

// All notification routes require OAuth authentication
router.use(oauthAuth(true));

/**
 * GET /notifications
 * List notifications for the current user
 * Query params: type (mention|comment_on_thread), app_ids (comma-separated), limit (number)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const email = req.auth!.user!.email.toLowerCase();
    const type = req.query.type as NotificationType | undefined;
    const appIdsParam = req.query.app_ids as string | undefined;
    const appIds = appIdsParam ? appIdsParam.split(',').filter(Boolean) : undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    if (type && type !== 'mention' && type !== 'comment_on_thread') {
      throw APIError.badRequest('Invalid notification type');
    }

    const { notifications, total_unread } = await firestoreService.getNotifications(
      email,
      { type, appIds, limit }
    );

    res.json({ data: notifications, unread_count: total_unread });
  })
);

/**
 * GET /notifications/unread-count
 * Quick unread count for badge display
 */
router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const email = req.auth!.user!.email.toLowerCase();
    const count = await firestoreService.getUnreadNotificationCount(email);
    res.json({ data: { count } });
  })
);

/**
 * POST /notifications/:notification_id/read
 * Mark a single notification as read
 */
router.post(
  '/:notification_id/read',
  asyncHandler(async (req, res) => {
    const { notification_id } = req.params;
    const success = await firestoreService.markNotificationRead(notification_id);
    if (!success) {
      throw APIError.notFound('Notification');
    }
    res.json({ data: { success: true } });
  })
);

/**
 * POST /notifications/mark-all-read
 * Mark all notifications as read for the current user
 */
router.post(
  '/mark-all-read',
  asyncHandler(async (req, res) => {
    const email = req.auth!.user!.email.toLowerCase();
    const marked = await firestoreService.markAllNotificationsRead(email);
    res.json({ data: { marked } });
  })
);

export default router;
