/**
 * Event Entity Types
 * Based on Build Contract Section 4.7
 */

import type { Environment, EventType } from './enums.js';

/**
 * Sanitized user information captured with events
 */
export interface EventUser {
  user_id: string; // or 'unknown'
  role: string; // or 'unknown'
  email?: string; // captured when user is logged in
}

/**
 * Request metadata for backend events
 */
export interface RequestMetadata {
  request_id?: string;
  service_name?: string;
  revision?: string;
  http_status?: number;
}

/**
 * Feedback event payload
 */
export interface FeedbackPayload {
  category: 'bug' | 'feature' | 'feedback';
  description: string; // sanitized
  reproduction_steps?: string; // sanitized
  allow_contact?: boolean;
}

/**
 * Frontend error event payload
 */
export interface FrontendErrorPayload {
  error_type: string;
  message: string; // sanitized
  stack?: string; // sanitized
  component_stack?: string;
  source_file?: string;
  line_number?: number;
  column_number?: number;
}

/**
 * Backend error event payload
 */
export interface BackendErrorPayload {
  error_type: string;
  message: string; // sanitized
  stack?: string; // sanitized
  service_name: string;
  revision?: string;
  endpoint?: string;
  http_method?: string;
  http_status?: number;
}

export type EventPayload = FeedbackPayload | FrontendErrorPayload | BackendErrorPayload;

/**
 * Event entity (Section 4.7)
 * A single captured input (feedback or telemetry error)
 */
export interface Event {
  // Required fields
  event_id: string;
  app_id: string;
  environment: Environment;
  event_type: EventType;
  timestamp: string; // ISO timestamp
  session_id: string; // required for frontend, optional for backend
  route_or_url: string;
  version: string; // can be 'unknown' but must exist
  user: EventUser; // sanitized

  // Type-specific payload (sanitized)
  payload: EventPayload;

  // Optional fields
  trace_id?: string; // recommended for correlation
  fingerprint?: string; // required for error types
  attachment_refs?: string[]; // references to stored attachments
  request_metadata?: RequestMetadata;
}

/**
 * Event creation input (before processing)
 */
export interface EventInput {
  app_id: string;
  environment: Environment;
  event_type: EventType;
  session_id?: string;
  trace_id?: string;
  route_or_url: string;
  version?: string;
  user?: Partial<EventUser>;
  payload: Record<string, unknown>; // will be sanitized
  attachment_refs?: string[];
  request_metadata?: RequestMetadata;
}

/**
 * Attachment reference
 */
export interface Attachment {
  attachment_id: string;
  event_id: string;
  app_id: string;
  environment: Environment;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  uploaded_at: string;
  expires_at: string;
  user_opted_in: boolean; // explicit opt-in required
}
