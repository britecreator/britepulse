/**
 * Context Collection Module
 * Collects session, trace, route, and version information
 */

import type { ContextData, BritePulseConfig, ErrorData } from './types.js';

const SESSION_KEY = 'britepulse_session_id';
const TRACE_HEADER = 'x-trace-id';

// Stored user context that can be updated after init
let currentUser: { id?: string; role?: string; email?: string } | undefined;

// Network error handler - set during SDK init
type NetworkErrorHandler = (error: ErrorData) => void;
let networkErrorHandler: NetworkErrorHandler | null = null;
let britepulseApiUrl: string | null = null;

/**
 * Set the network error handler (called from SDK init)
 */
export function setNetworkErrorHandler(handler: NetworkErrorHandler | null, apiUrl?: string): void {
  networkErrorHandler = handler;
  britepulseApiUrl = apiUrl || null;
}

/**
 * Check if a URL is BritePulse's own API (to avoid infinite loops)
 */
function isBritePulseUrl(url: string): boolean {
  if (!britepulseApiUrl) return false;
  try {
    return url.includes(britepulseApiUrl) || url.includes('britepulse');
  } catch {
    return false;
  }
}

/**
 * Set/update the current user context
 */
export function setUser(user: { id?: string; role?: string; email?: string } | undefined): void {
  currentUser = user;
}

/**
 * Get the current user context
 */
export function getUser(): { id?: string; role?: string; email?: string } | undefined {
  return currentUser;
}

/**
 * Generate a unique ID (UUID v4 format)
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create session ID
 */
export function getSessionId(): string {
  // Try to get from sessionStorage
  try {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = generateId();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  } catch {
    // sessionStorage not available (SSR or privacy mode)
    return generateId();
  }
}

/**
 * Generate a new trace ID for request correlation
 */
export function generateTraceId(): string {
  return generateId();
}

/**
 * Get current trace ID from global storage
 */
let currentTraceId: string | undefined;

export function getTraceId(): string | undefined {
  return currentTraceId;
}

export function setTraceId(traceId: string): void {
  currentTraceId = traceId;
}

export function clearTraceId(): void {
  currentTraceId = undefined;
}

/**
 * Sensitive query parameter names that should be redacted
 * Case-insensitive matching is used
 */
const SENSITIVE_PARAMS = [
  'token', 'access_token', 'id_token', 'refresh_token', 'bearer',
  'api_key', 'apikey', 'key',
  'password', 'pwd', 'pass', 'passwd',
  'secret',
  'code', // OAuth authorization code
  'session', 'sessionid', 'session_id',
  'auth', 'authorization',
  'credential', 'credentials',
  'private', 'private_key',
];

/**
 * Get current route (URL path) with sensitive query params redacted
 */
export function getCurrentRoute(): string {
  if (typeof window === 'undefined') return '';

  const pathname = window.location.pathname;
  const search = window.location.search;

  if (!search) return pathname;

  // Redact sensitive query parameters
  try {
    const params = new URLSearchParams(search);
    const sensitiveSet = new Set(SENSITIVE_PARAMS.map((p) => p.toLowerCase()));

    for (const [key] of params) {
      if (sensitiveSet.has(key.toLowerCase())) {
        params.set(key, '[REDACTED]');
      }
    }

    const redactedSearch = params.toString();
    return pathname + (redactedSearch ? '?' + redactedSearch : '');
  } catch {
    // If parsing fails, return path only (safe fallback)
    return pathname;
  }
}

/**
 * Collect all context data
 */
export function collectContext(config: BritePulseConfig): ContextData {
  // Use currentUser (set via setUser) if available, otherwise fall back to config.user
  const user = currentUser || config.user;
  return {
    sessionId: getSessionId(),
    traceId: getTraceId(),
    route: getCurrentRoute(),
    version: config.version || 'unknown',
    user: user
      ? {
          id: user.id,
          role: user.role,
          email: user.email,
        }
      : undefined,
  };
}

/**
 * Intercept fetch to add trace ID header and capture errors
 */
export function setupTraceInterceptor(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

  const originalFetch = window.fetch;

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const traceId = getTraceId() || generateTraceId();
    setTraceId(traceId);

    const headers = new Headers(init?.headers);
    if (!headers.has(TRACE_HEADER)) {
      headers.set(TRACE_HEADER, traceId);
    }

    // Get URL and method for error reporting
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';

    return originalFetch.call(this, input, {
      ...init,
      headers,
    }).then((response) => {
      // Capture 4xx/5xx errors (but not for BritePulse's own API)
      if (!response.ok && networkErrorHandler && !isBritePulseUrl(url)) {
        const errorData: ErrorData = {
          type: 'NetworkError',
          message: `HTTP ${response.status}: ${response.statusText || 'Request failed'} - ${method} ${url}`,
          url,
          method: method.toUpperCase(),
          statusCode: response.status,
          statusText: response.statusText,
        };
        networkErrorHandler(errorData);
      }
      return response;
    }).catch((error) => {
      // Capture network failures (connection errors, CORS, etc.)
      if (networkErrorHandler && !isBritePulseUrl(url)) {
        const errorData: ErrorData = {
          type: 'NetworkError',
          message: `Fetch failed: ${error.message || 'Network request failed'} - ${method} ${url}`,
          url,
          method: method.toUpperCase(),
        };
        networkErrorHandler(errorData);
      }
      throw error; // Re-throw to preserve original behavior
    });
  };
}

/**
 * Intercept XMLHttpRequest to add trace ID header and capture errors
 */
export function setupXHRInterceptor(): void {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') return;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  // Extended XHR type with our tracking properties
  interface BritePulseXHR extends XMLHttpRequest {
    _britepulse_url?: string;
    _britepulse_method?: string;
  }

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    // Store method and url for later
    const xhr = this as BritePulseXHR;
    xhr._britepulse_url = url.toString();
    xhr._britepulse_method = method;
    return originalOpen.call(
      this,
      method,
      url,
      async !== false,
      username ?? null,
      password ?? null
    );
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
    const xhr = this as BritePulseXHR;
    const traceId = getTraceId() || generateTraceId();
    setTraceId(traceId);

    try {
      this.setRequestHeader(TRACE_HEADER, traceId);
    } catch {
      // Headers already sent or not allowed
    }

    // Add error capture listener
    if (networkErrorHandler && xhr._britepulse_url && !isBritePulseUrl(xhr._britepulse_url)) {
      const url = xhr._britepulse_url;
      const method = xhr._britepulse_method || 'GET';

      this.addEventListener('loadend', function () {
        // Capture 4xx/5xx errors
        if (this.status >= 400) {
          const errorData: ErrorData = {
            type: 'NetworkError',
            message: `HTTP ${this.status}: ${this.statusText || 'Request failed'} - ${method} ${url}`,
            url,
            method: method.toUpperCase(),
            statusCode: this.status,
            statusText: this.statusText,
          };
          networkErrorHandler!(errorData);
        }
      });

      this.addEventListener('error', function () {
        const errorData: ErrorData = {
          type: 'NetworkError',
          message: `XHR failed: Network request failed - ${method} ${url}`,
          url,
          method: method.toUpperCase(),
        };
        networkErrorHandler!(errorData);
      });

      this.addEventListener('timeout', function () {
        const errorData: ErrorData = {
          type: 'NetworkError',
          message: `XHR timeout: Request timed out - ${method} ${url}`,
          url,
          method: method.toUpperCase(),
        };
        networkErrorHandler!(errorData);
      });
    }

    return originalSend.call(this, body);
  };
}
