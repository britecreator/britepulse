/**
 * Context Collection Module
 * Collects session, trace, route, and version information
 */

import type { ContextData, BritePulseConfig } from './types.js';

const SESSION_KEY = 'britepulse_session_id';
const TRACE_HEADER = 'x-trace-id';

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
 * Get current route (URL path)
 */
export function getCurrentRoute(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname + window.location.search;
}

/**
 * Collect all context data
 */
export function collectContext(config: BritePulseConfig): ContextData {
  return {
    sessionId: getSessionId(),
    traceId: getTraceId(),
    route: getCurrentRoute(),
    version: config.version || 'unknown',
    user: config.user
      ? {
          id: config.user.id,
          role: config.user.role,
        }
      : undefined,
  };
}

/**
 * Intercept fetch to add trace ID header
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

    return originalFetch.call(this, input, {
      ...init,
      headers,
    });
  };
}

/**
 * Intercept XMLHttpRequest to add trace ID header
 */
export function setupXHRInterceptor(): void {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined') return;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    // Store method and url for later
    (this as XMLHttpRequest & { _britepulse_url?: string })._britepulse_url = url.toString();
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
    const traceId = getTraceId() || generateTraceId();
    setTraceId(traceId);

    try {
      this.setRequestHeader(TRACE_HEADER, traceId);
    } catch {
      // Headers already sent or not allowed
    }

    return originalSend.call(this, body);
  };
}
