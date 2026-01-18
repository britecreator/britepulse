/**
 * API Types
 * Based on Build Contract Section 5
 */

/**
 * Standard API error response
 */
export interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Standard API success response wrapper
 */
export interface APIResponse<T> {
  data: T;
  meta?: {
    request_id?: string;
    timestamp?: string;
  };
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    has_more: boolean;
  };
}

/**
 * API authentication types
 */
export type AuthType = 'public_key' | 'server_key' | 'oauth';

/**
 * API request context (set by middleware)
 */
export interface APIContext {
  request_id: string;
  auth_type: AuthType;
  app_id?: string; // for SDK/server key auth
  user?: {
    user_id: string;
    email: string;
    role: string;
  };
}

/**
 * Event ingestion request
 */
export interface IngestEventRequest {
  events: EventIngestion[];
}

export interface EventIngestion {
  event_type: 'feedback' | 'frontend_error' | 'backend_error';
  timestamp?: string; // defaults to server time if not provided
  session_id?: string;
  trace_id?: string;
  route_or_url: string;
  version?: string;
  user?: {
    user_id?: string;
    role?: string;
  };
  payload: Record<string, unknown>;
  attachments?: AttachmentUpload[];
}

export interface AttachmentUpload {
  filename: string;
  content_type: string;
  data: string; // base64 encoded
  user_opted_in: boolean; // must be true
}

/**
 * Event ingestion response
 */
export interface IngestEventResponse {
  accepted: number;
  rejected: number;
  event_ids: string[];
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  components: {
    database: 'ok' | 'error';
    queue: 'ok' | 'error';
    ai_service: 'ok' | 'error';
  };
}

/**
 * App health response (Section 5.2 - GET /apps/{app_id}/health)
 */
export interface AppHealthResponse {
  app_id: string;
  environment: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'no_data';
  metrics: {
    last_event_received?: string;
    events_24h: number;
    missing_version_rate: number; // 0.0-1.0
    missing_trace_rate: number; // 0.0-1.0
    volume_anomaly?: {
      detected: boolean;
      expected_range: [number, number];
      actual: number;
    };
  };
  issues: {
    total_open: number;
    p0_open: number;
    p1_open: number;
  };
}

/**
 * Rate limit headers
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

/**
 * HTTP status codes (Section 5.3)
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const;
