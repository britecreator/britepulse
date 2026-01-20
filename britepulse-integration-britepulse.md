# BritePulse Integration Guide for BritePulse

## Quick Start

Add this script tag to your HTML `<head>`:

```html
<script
  src="https://britepulse-api-29820647719.us-central1.run.app/sdk.js"
  data-api-key="pk_0410caf0-1276-4782-82d7-aec5140f946f_c33c98737690464d8d9827fa1bf1c581"
  data-api-url="https://britepulse-api-29820647719.us-central1.run.app"
  defer
></script>
```

That's it! The SDK will automatically:
- Show a feedback button in the bottom-right corner
- Capture uncaught JavaScript errors
- Track user sessions

## Configuration

| Setting | Value |
|---------|-------|
| App ID | `0410caf0-1276-4782-82d7-aec5140f946f` |
| API URL | `https://britepulse-api-29820647719.us-central1.run.app` |
| Public Key (prod) | `pk_0410caf0-1276-4782-82d7-aec5140f946f_c33c98737690464d8d9827fa1bf1c581` |
| Public Key (stage) | `pk_0410caf0-1276-4782-82d7-aec5140f946f_94201dd4fe9b4911922c3430d05d0cff` |

## Manual Initialization (React/SPA)

If you need more control, initialize manually instead of using data attributes:

```tsx
// Add to your app's entry point (e.g., main.tsx or App.tsx)
import { useEffect } from 'react';

declare global {
  interface Window {
    BritePulse?: {
      init: (config: {
        apiKey: string;
        apiUrl?: string;
        version?: string;
        user?: { id?: string; role?: string; email?: string };
        captureErrors?: boolean;
        enableWidget?: boolean;
        widgetPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
        widgetButtonText?: string;
        debug?: boolean;
      }) => void;
      getInstance: () => {
        setUser: (user: { id?: string; role?: string; email?: string } | undefined) => void;
        captureError: (error: Error | string, metadata?: Record<string, unknown>) => void;
        captureComponentError: (error: Error, componentStack: string) => void;
      } | null;
      captureError: (error: Error | string, metadata?: Record<string, unknown>) => void;
      openWidget: () => void;
    };
  }
}

function App() {
  useEffect(() => {
    // Wait for SDK script to load, then initialize
    const initBritePulse = () => {
      window.BritePulse?.init({
        apiKey: 'pk_0410caf0-1276-4782-82d7-aec5140f946f_c33c98737690464d8d9827fa1bf1c581',
        apiUrl: 'https://britepulse-api-29820647719.us-central1.run.app',
        // Optional settings:
        // version: '1.0.0',
        // widgetPosition: 'bottom-right',
        // widgetButtonText: 'Feedback',
        // debug: true,
      });
    };

    if (window.BritePulse) {
      initBritePulse();
    } else {
      // SDK not loaded yet, wait for script
      const script = document.querySelector('script[src*="sdk.js"]');
      script?.addEventListener('load', initBritePulse);
    }
  }, []);

  return <YourApp />;
}
```

## Error Boundary (React)

Capture React component errors:

```tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Use captureComponentError for React errors (includes component stack)
    window.BritePulse?.getInstance()?.captureComponentError(
      error,
      errorInfo.componentStack || ''
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong</div>;
    }
    return this.props.children;
  }
}
```

## API Methods

```typescript
// Set user context after login
window.BritePulse?.getInstance()?.setUser({
  id: user.id,
  email: user.email,
  role: user.role,  // optional
});

// Clear user on logout
window.BritePulse?.getInstance()?.setUser(undefined);

// Manual error capture with metadata
window.BritePulse?.captureError(error, {
  context: 'checkout',
  orderId: '12345',
});

// Open feedback widget programmatically
window.BritePulse?.openWidget();
```

## Staging Environment

To use staging instead of production, use the staging public key:
```html
<script
  src="https://britepulse-api-29820647719.us-central1.run.app/sdk.js"
  data-api-key="pk_0410caf0-1276-4782-82d7-aec5140f946f_94201dd4fe9b4911922c3430d05d0cff"
  data-api-url="https://britepulse-api-29820647719.us-central1.run.app"
  defer
></script>
```

---

**Console:** https://britepulse-console-29820647719.us-central1.run.app
**App ID:** 0410caf0-1276-4782-82d7-aec5140f946f
