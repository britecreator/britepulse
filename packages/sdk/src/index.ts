/**
 * BritePulse SDK
 * Client-side feedback widget and error capture
 */

import type { BritePulseConfig, FeedbackData, ErrorData } from './types.js';
import { createApiClient, type ApiClient } from './api.js';
import {
  collectContext,
  setupTraceInterceptor,
  setupXHRInterceptor,
  teardownInterceptors,
  setNetworkErrorHandler,
  getSessionId,
  generateTraceId,
  setTraceId,
  setUser as setContextUser,
} from './context.js';
import { setupErrorCapture, teardownErrorCapture, captureError, captureComponentError } from './capture.js';
import { mountWidget, destroyWidget } from './widget/index.js';

/**
 * BritePulse SDK instance
 */
export interface BritePulse {
  /** Submit feedback manually */
  submitFeedback: (feedback: FeedbackData) => Promise<boolean>;
  /** Capture an error manually */
  captureError: (error: Error | string, metadata?: Record<string, unknown>) => void;
  /** Capture React error boundary errors */
  captureComponentError: (error: Error, componentStack: string) => void;
  /** Get current session ID */
  getSessionId: () => string;
  /** Generate a new trace ID */
  generateTraceId: () => string;
  /** Set the current trace ID */
  setTraceId: (traceId: string) => void;
  /** Set the current user context */
  setUser: (user: { id?: string; role?: string; email?: string } | undefined) => void;
  /** Destroy the SDK (cleanup) */
  destroy: () => void;
}

let instance: BritePulse | null = null;

/**
 * Initialize BritePulse SDK
 */
export function init(config: BritePulseConfig): BritePulse {
  // Validate config
  if (!config.apiKey) {
    throw new Error('[BritePulse] apiKey is required');
  }
  if (!config.apiKey.startsWith('pk_')) {
    throw new Error('[BritePulse] apiKey must be a public key (starting with pk_)');
  }

  // Default config values
  const fullConfig: BritePulseConfig = {
    captureErrors: true,
    captureNetworkErrors: true,
    enableWidget: true,
    widgetPosition: 'bottom-right',
    debug: false,
    ...config,
  };

  // Create API client
  const apiClient = createApiClient(fullConfig);

  // Setup trace interceptors for correlation
  setupTraceInterceptor();
  setupXHRInterceptor();

  // Handler for sending feedback
  const handleFeedbackSubmit = async (feedback: FeedbackData): Promise<boolean> => {
    const context = collectContext(fullConfig);
    const event = apiClient.createFeedbackEvent(feedback, context);
    const success = await apiClient.sendEvent(event);

    if (fullConfig.onFeedbackSubmit) {
      fullConfig.onFeedbackSubmit(feedback);
    }

    return success;
  };

  // Handler for captured errors
  const handleErrorCapture = async (error: ErrorData): Promise<void> => {
    const context = collectContext(fullConfig);
    const event = apiClient.createErrorEvent(error, context);
    await apiClient.sendEvent(event);

    if (fullConfig.onErrorCapture) {
      fullConfig.onErrorCapture(error);
    }
  };

  // Setup error capture
  setupErrorCapture(fullConfig, handleErrorCapture);

  // Setup network error capture (fetch/XHR 4xx/5xx)
  if (fullConfig.captureNetworkErrors) {
    setNetworkErrorHandler(handleErrorCapture, fullConfig.apiUrl);
    if (fullConfig.debug) {
      console.log('[BritePulse] Network error capture enabled');
    }
  }

  // Mount widget
  mountWidget(fullConfig, handleFeedbackSubmit);

  // Create instance
  instance = {
    submitFeedback: handleFeedbackSubmit,
    captureError: (error, metadata) => captureError(error, metadata),
    captureComponentError,
    getSessionId,
    generateTraceId,
    setTraceId,
    setUser: (user) => {
      setContextUser(user);
      if (fullConfig.debug) {
        console.log('[BritePulse] User set:', user);
      }
    },
    destroy: () => {
      teardownErrorCapture();
      teardownInterceptors();
      setNetworkErrorHandler(null);
      destroyWidget();
      instance = null;
      if (fullConfig.debug) {
        console.log('[BritePulse] Destroyed');
      }
    },
  };

  if (fullConfig.debug) {
    console.log('[BritePulse] Initialized', { config: fullConfig });
  }

  return instance;
}

/**
 * Get the current SDK instance
 */
export function getInstance(): BritePulse | null {
  return instance;
}

// Export types
export type { BritePulseConfig, FeedbackData, ErrorData } from './types.js';

// Export React components
export { BritePulseErrorBoundary } from './ErrorBoundary.js';
export type { ErrorBoundaryProps } from './ErrorBoundary.js';

// Auto-init from script tag data attributes
if (typeof document !== 'undefined') {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script) {
    const apiKey = script.dataset.apiKey || script.getAttribute('data-api-key');
    const apiUrl = script.dataset.apiUrl || script.getAttribute('data-api-url');
    const version = script.dataset.version || script.getAttribute('data-version');

    if (apiKey) {
      // Defer init to ensure DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          init({
            apiKey,
            apiUrl: apiUrl || undefined,
            version: version || undefined,
          });
        });
      } else {
        init({
          apiKey,
          apiUrl: apiUrl || undefined,
          version: version || undefined,
        });
      }
    }
  }
}

// Expose to window for UMD builds
if (typeof window !== 'undefined') {
  (window as unknown as {
    BritePulse: {
      init: typeof init;
      getInstance: typeof getInstance;
      captureError: (error: Error | string, metadata?: Record<string, unknown>) => void;
      openWidget: (options?: { type?: string }) => void;
    };
  }).BritePulse = {
    init,
    getInstance,
    // Convenience methods that delegate to instance
    captureError: (error, metadata) => instance?.captureError(error, metadata),
    openWidget: () => {
      const trigger = document.querySelector('[data-britepulse-trigger]') as HTMLButtonElement;
      if (trigger) {
        trigger.click();
        return true;
      }
      console.warn('[BritePulse] Widget trigger not found - is the widget mounted?');
      return false;
    },
  };
}
