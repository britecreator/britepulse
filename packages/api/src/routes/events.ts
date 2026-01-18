/**
 * Event ingestion routes
 * POST /events - Ingest events from SDK or server
 */

import { Router, type IRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { schemas, type Event } from '@britepulse/shared';
import { config } from '../config.js';
import { asyncHandler, APIError, apiKeyAuth } from '../middleware/index.js';
import * as firestoreService from '../services/firestore.js';
import { processEvent } from '../services/pipeline.js';

const router: IRouter = Router();

// Higher rate limit for ingestion
const ingestionLimiter = rateLimit({
  windowMs: config.ingestionRateLimitWindowMs,
  max: config.ingestionRateLimitMaxRequests,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Ingestion rate limit exceeded',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /events
 * Ingest one or more events
 */
router.post(
  '/',
  ingestionLimiter,
  apiKeyAuth('any'),
  asyncHandler(async (req, res) => {
    // Validate request body
    const parseResult = schemas.IngestEventRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid request body', {
        issues: parseResult.error.issues,
      });
    }

    const { events } = parseResult.data;
    const appId = req.auth!.appId!;

    // Process events
    const accepted: string[] = [];
    const rejected: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < events.length; i++) {
      const eventInput = events[i];

      try {
        // Determine environment from API key context or event
        // TODO: Get environment from validated API key
        const environment = 'prod';

        // Create event
        const timestamp = eventInput.timestamp || new Date().toISOString();

        // Build event object
        const event: Omit<Event, 'event_id'> = {
          app_id: appId,
          environment,
          event_type: eventInput.event_type,
          timestamp,
          session_id: eventInput.session_id || uuidv4(),
          route_or_url: eventInput.route_or_url || 'unknown',
          version: eventInput.version || 'unknown',
          user: {
            user_id: eventInput.user?.user_id || 'anonymous',
            role: eventInput.user?.role || 'user',
          },
          payload: eventInput.payload as unknown as Event['payload'],
        };

        // Only add optional fields if they have values
        if (eventInput.trace_id) {
          event.trace_id = eventInput.trace_id;
        }

        // Process through pipeline (redaction, fingerprinting, issue grouping)
        const result = await processEvent(event);
        accepted.push(result.event.event_id);
      } catch (error) {
        rejected.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.status(accepted.length > 0 ? 201 : 400).json({
      data: {
        accepted: accepted.length,
        rejected: rejected.length,
        event_ids: accepted,
        errors: rejected.length > 0 ? rejected : undefined,
      },
    });
  })
);

/**
 * GET /events/:event_id
 * Get a single event by ID (for debugging)
 */
router.get(
  '/:event_id',
  apiKeyAuth('server'), // Server key required for reading events
  asyncHandler(async (req, res) => {
    const { event_id } = req.params;

    const event = await firestoreService.getEvent(event_id);
    if (!event) {
      throw APIError.notFound('Event');
    }

    // Verify event belongs to the authenticated app
    if (event.app_id !== req.auth!.appId) {
      throw APIError.forbidden('Event does not belong to this app');
    }

    res.json({ data: event });
  })
);

export default router;
