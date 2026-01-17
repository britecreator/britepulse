/**
 * API Client Module
 * Handles communication with BritePulse API
 */

import type { BritePulseConfig, EventPayload, FeedbackData, ErrorData, ContextData } from './types.js';

const DEFAULT_API_URL = 'https://api.britepulse.io';

/**
 * Create API client
 */
export function createApiClient(config: BritePulseConfig) {
  const apiUrl = config.apiUrl || DEFAULT_API_URL;
  const apiKey = config.apiKey;

  /**
   * Send events to the API
   */
  async function sendEvents(events: EventPayload[]): Promise<boolean> {
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
  function createFeedbackEvent(feedback: FeedbackData, context: ContextData): EventPayload {
    return {
      event_type: 'feedback',
      session_id: context.sessionId,
      trace_id: context.traceId,
      route_or_url: context.route,
      version: context.version,
      user: context.user ? { user_id: context.user.id, role: context.user.role } : undefined,
      payload: {
        category: feedback.category,
        description: feedback.description,
        reproduction_steps: feedback.reproductionSteps,
        allow_contact: feedback.allowContact,
      },
    };
  }

  /**
   * Create event payload from error data
   */
  function createErrorEvent(error: ErrorData, context: ContextData): EventPayload {
    return {
      event_type: 'frontend_error',
      session_id: context.sessionId,
      trace_id: context.traceId,
      route_or_url: context.route,
      version: context.version,
      user: context.user ? { user_id: context.user.id, role: context.user.role } : undefined,
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
