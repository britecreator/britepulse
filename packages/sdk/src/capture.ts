/**
 * Error Capture Module
 * Captures window.onerror and unhandledrejection events
 */

import type { ErrorData, BritePulseConfig } from './types.js';

type ErrorHandler = (error: ErrorData) => void;

let errorHandler: ErrorHandler | null = null;
let isSetup = false;

/**
 * Normalize error into ErrorData format
 */
function normalizeError(
  error: Error | string | Event,
  source?: string,
  lineno?: number,
  colno?: number
): ErrorData {
  if (error instanceof Error) {
    return {
      type: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      sourceFile: source,
      lineNumber: lineno,
      columnNumber: colno,
    };
  }

  if (typeof error === 'string') {
    return {
      type: 'Error',
      message: error,
      sourceFile: source,
      lineNumber: lineno,
      columnNumber: colno,
    };
  }

  // Event or unknown
  return {
    type: 'Error',
    message: String(error),
  };
}

/**
 * Handle unhandledrejection events
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  if (!errorHandler) return;

  const reason = event.reason;
  const errorData: ErrorData =
    reason instanceof Error
      ? normalizeError(reason)
      : {
          type: 'UnhandledPromiseRejection',
          message: String(reason),
        };

  errorHandler(errorData);
}

/**
 * Handle error events (addEventListener version)
 */
function handleErrorEvent(event: ErrorEvent): void {
  if (!errorHandler) return;

  const errorData = event.error
    ? normalizeError(event.error, event.filename, event.lineno, event.colno)
    : normalizeError(event.message, event.filename, event.lineno, event.colno);

  errorHandler(errorData);
}

/**
 * Setup error capture listeners
 */
export function setupErrorCapture(config: BritePulseConfig, handler: ErrorHandler): void {
  if (typeof window === 'undefined') return;
  if (isSetup) return;

  if (!config.captureErrors) return;

  errorHandler = handler;

  // Capture window errors using addEventListener (more robust than window.onerror)
  window.addEventListener('error', handleErrorEvent);

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  isSetup = true;

  if (config.debug) {
    console.log('[BritePulse] Error capture enabled');
  }
}

/**
 * Teardown error capture listeners
 */
export function teardownErrorCapture(): void {
  if (typeof window === 'undefined') return;

  window.removeEventListener('error', handleErrorEvent);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);

  errorHandler = null;
  isSetup = false;
}

/**
 * Manually capture an error
 */
export function captureError(error: Error | string, metadata?: Record<string, unknown>): void {
  if (!errorHandler) return;

  const errorData = typeof error === 'string'
    ? { type: 'Error', message: error }
    : normalizeError(error);

  if (metadata) {
    (errorData as ErrorData & { metadata?: Record<string, unknown> }).metadata = metadata;
  }

  errorHandler(errorData);
}

/**
 * Capture React error boundary errors
 */
export function captureComponentError(
  error: Error,
  componentStack: string
): void {
  if (!errorHandler) return;

  const errorData = normalizeError(error);
  errorData.componentStack = componentStack;
  errorData.type = 'ReactError';

  errorHandler(errorData);
}
