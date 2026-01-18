# BritePulse Integration Guide for BritePulse

## Quick Start

Add this script tag to your HTML `<head>`:

```html
<script
  src="https://britepulse-api-29820647719.us-central1.run.app/sdk.js"
  data-app-id="0410caf0-1276-4782-82d7-aec5140f946f"
  data-api-url="https://britepulse-api-29820647719.us-central1.run.app"
  data-environment="production"
  defer
></script>
```

## Configuration

| Setting | Value |
|---------|-------|
| App ID | `0410caf0-1276-4782-82d7-aec5140f946f` |
| API URL | `https://britepulse-api-29820647719.us-central1.run.app` |
| Public Key (prod) | `pk_0410caf0-1276-4782-82d7-aec5140f946f_c33c98737690464d8d9827fa1bf1c581` |
| Public Key (stage) | `pk_0410caf0-1276-4782-82d7-aec5140f946f_94201dd4fe9b4911922c3430d05d0cff` |

## React Integration

```tsx
// Add to your app's entry point (e.g., main.tsx or App.tsx)
import { useEffect } from 'react';

declare global {
  interface Window {
    BritePulse?: {
      init: (config: any) => void;
      setUser: (user: any) => void;
      captureError: (error: Error, context?: any) => void;
      openWidget: (options?: any) => void;
    };
  }
}

function App() {
  useEffect(() => {
    const initBritePulse = () => {
      window.BritePulse?.init({
        appId: '0410caf0-1276-4782-82d7-aec5140f946f',
        apiUrl: 'https://britepulse-api-29820647719.us-central1.run.app',
        environment: 'production',
      });
    };

    if (window.BritePulse) {
      initBritePulse();
    } else {
      window.addEventListener('britepulse:ready', initBritePulse);
      return () => window.removeEventListener('britepulse:ready', initBritePulse);
    }
  }, []);

  return <YourApp />;
}
```

## Error Boundary (Optional)

Capture React errors automatically:

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
    window.BritePulse?.captureError(error, {
      componentStack: errorInfo.componentStack,
    });
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
// Update user after login
window.BritePulse?.setUser({ userId: user.id, email: user.email });

// Manual error capture
window.BritePulse?.captureError(error, { context: 'checkout' });

// Open feedback widget
window.BritePulse?.openWidget();
window.BritePulse?.openWidget({ type: 'bug' }); // Pre-select type
```

## Staging Environment

To use staging instead of production, change:
- `data-environment="staging"`
- Use public key: `pk_0410caf0-1276-4782-82d7-aec5140f946f_94201dd4fe9b4911922c3430d05d0cff`

---

**Console:** https://britepulse-console-29820647719.us-central1.run.app
**App ID:** 0410caf0-1276-4782-82d7-aec5140f946f
