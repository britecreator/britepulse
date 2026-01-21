/**
 * API Client Module
 * Handles communication with BritePulse API
 */

import type { BritePulseConfig, EventPayload, FeedbackData, ErrorData, ContextData, AttachmentData } from './types.js';

/**
 * Event with attachments (extended for feedback)
 */
interface EventWithAttachments extends EventPayload {
  attachments?: AttachmentData[];
}

const DEFAULT_API_URL = 'https://britepulse-api-29820647719.us-central1.run.app';

/**
 * Build user object with only defined values (Firestore-safe)
 */
function buildUserObject(user: ContextData['user']): EventPayload['user'] {
  if (!user) return undefined;

  const result: NonNullable<EventPayload['user']> = {};
  if (user.id) result.user_id = user.id;
  if (user.role) result.role = user.role;
  if (user.email) result.email = user.email;

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Create API client
 */
export function createApiClient(config: BritePulseConfig) {
  const apiUrl = config.apiUrl || DEFAULT_API_URL;
  const apiKey = config.apiKey;

  /**
   * Send events to the API
   */
  async function sendEvents(events: (EventPayload | EventWithAttachments)[]): Promise<boolean> {
    try {
      const response = await fetch(`${apiUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        if (config.debug) {
          console.error('[BritePulse] API error:', response.status, await response.text());
        }
        return false;
      }

      if (config.debug) {
        const result = await response.json();
        console.log('[BritePulse] Events sent:', result);
      }

      return true;
    } catch (error) {
      if (config.debug) {
        console.error('[BritePulse] Failed to send events:', error);
      }
      return false;
    }
  }

  /**
   * Send a single event
   */
  async function sendEvent(event: EventPayload): Promise<boolean> {
    return sendEvents([event]);
  }

  /**
   * Create event payload from feedback data
   */
  function createFeedbackEvent(feedback: FeedbackData, context: ContextData): EventWithAttachments {
    const event: EventWithAttachments = {
      event_type: 'feedback',
      session_id: context.sessionId,
      trace_id: context.traceId,
      route_or_url: context.route || '/',
      version: context.version,
      user: buildUserObject(context.user),
      payload: {
        category: feedback.category,
        description: feedback.description,
        reproduction_steps: feedback.reproductionSteps,
        allow_contact: feedback.allowContact,
      },
    };

    // Add attachments if present
    if (feedback.attachments && feedback.attachments.length > 0) {
      event.attachments = feedback.attachments;
    }

    return event;
  }

  /**
   * Create event payload from error data
   */
  function createErrorEvent(error: ErrorData, context: ContextData): EventPayload {
    return {
      event_type: 'frontend_error',
      session_id: context.sessionId,
      trace_id: context.traceId,
      route_or_url: context.route || '/',
      version: context.version,
      user: buildUserObject(context.user),
      payload: {
        error_type: error.type,
        message: error.message,
        stack: error.stack,
        component_stack: error.componentStack,
        source_file: error.sourceFile,
        line_number: error.lineNumber,
        column_number: error.columnNumber,
      },
    };
  }

  return {
    sendEvents,
    sendEvent,
    createFeedbackEvent,
    createErrorEvent,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
