/**
 * BritePulse SDK Types
 */

export interface BritePulseConfig {
  /** API key (public key starting with pk_) */
  apiKey: string;
  /** API endpoint URL */
  apiUrl?: string;
  /** App version (commit SHA or build ID) */
  version?: string;
  /** User information */
  user?: {
    id?: string;
    role?: string;
    email?: string;
  };
  /** Enable/disable error capture */
  captureErrors?: boolean;
  /** Enable/disable the feedback widget */
  enableWidget?: boolean;
  /** Widget position */
  widgetPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Custom widget button text */
  widgetButtonText?: string;
  /** Callback when feedback is submitted */
  onFeedbackSubmit?: (feedback: FeedbackData) => void;
  /** Callback when error is captured */
  onErrorCapture?: (error: ErrorData) => void;
  /** Debug mode */
  debug?: boolean;
}

export interface AttachmentData {
  filename: string;
  content_type: string;
  data: string; // base64
  user_opted_in: true;
}

export interface FeedbackData {
  category: 'bug' | 'feature' | 'feedback';
  description: string;
  reproductionSteps?: string;
  allowContact?: boolean;
  screenshot?: string; // base64 (deprecated, use attachments)
  attachments?: AttachmentData[];
}

export interface ErrorData {
  type: string;
  message: string;
  stack?: string;
  componentStack?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface EventPayload {
  event_type: 'feedback' | 'frontend_error' | 'backend_error';
  session_id: string;
  trace_id?: string;
  route_or_url: string;
  version: string;
  user?: {
    user_id?: string;
    role?: string;
    email?: string;
  };
  payload: Record<string, unknown>;
}

export interface ContextData {
  sessionId: string;
  traceId?: string;
  route: string;
  version: string;
  user?: {
    id?: string;
    role?: string;
    email?: string;
  };
}
