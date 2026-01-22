/**
 * BritePulse Error Boundary
 * A React error boundary that automatically captures errors to BritePulse
 *
 * This file uses createElement instead of JSX to avoid build conflicts
 * between Preact (used by the widget) and React (used by host apps)
 */

import { createElement, Component, type ReactNode, type ErrorInfo } from 'react';
import { captureComponentError } from './capture.js';

export interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional fallback UI to show when an error occurs */
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to report the error to BritePulse (default: true) */
  reportError?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary that automatically captures errors to BritePulse
 *
 * @example
 * // Basic usage
 * <BritePulseErrorBoundary>
 *   <MyApp />
 * </BritePulseErrorBoundary>
 *
 * @example
 * // With custom fallback
 * <BritePulseErrorBoundary
 *   fallback={<div>Something went wrong</div>}
 * >
 *   <MyComponent />
 * </BritePulseErrorBoundary>
 *
 * @example
 * // With fallback function (includes reset capability)
 * <BritePulseErrorBoundary
 *   fallback={(error, resetError) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={resetError}>Try Again</button>
 *     </div>
 *   )}
 * >
 *   <MyComponent />
 * </BritePulseErrorBoundary>
 */
export class BritePulseErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, reportError = true } = this.props;

    // Report to BritePulse
    if (reportError) {
      captureComponentError(error, errorInfo.componentStack || '');
    }

    // Call optional error callback
    if (onError) {
      onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // If fallback is a function, call it with error and reset function
      if (typeof fallback === 'function') {
        return fallback(error, this.resetError);
      }

      // If fallback is provided as a node, render it
      if (fallback !== undefined) {
        return fallback;
      }

      // Default fallback UI using createElement (not JSX to avoid Preact/React conflicts)
      return createElement(
        'div',
        {
          style: {
            padding: '20px',
            margin: '20px',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
          },
        },
        createElement(
          'h2',
          { style: { margin: '0 0 10px 0', fontSize: '18px' } },
          'Something went wrong'
        ),
        createElement(
          'p',
          { style: { margin: '0 0 10px 0', fontSize: '14px' } },
          error.message
        ),
        createElement(
          'button',
          {
            onClick: this.resetError,
            style: {
              padding: '8px 16px',
              backgroundColor: '#721c24',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            },
          },
          'Try Again'
        )
      );
    }

    return children;
  }
}

export default BritePulseErrorBoundary;
