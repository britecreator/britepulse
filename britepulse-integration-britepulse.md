# BritePulse Integration Guide for BritePulse

## Step 1: Add the SDK

Add this script tag to your HTML `<head>`:

```html
<script
  src="https://britepulse-api-29820647719.us-central1.run.app/sdk.js"
  data-api-key="pk_0410caf0-1276-4782-82d7-aec5140f946f_c33c98737690464d8d9827fa1bf1c581"
  data-api-url="https://britepulse-api-29820647719.us-central1.run.app"
  defer
></script>
```

The SDK will automatically:
- Show a feedback button in the bottom-right corner
- Capture uncaught JavaScript errors
- Capture network errors (fetch/XHR 4xx/5xx responses)
- Track user sessions

**Next:** Complete Step 2 to identify users, otherwise all feedback shows as "anonymous".

## Step 2: Identify Users (Required)

Without this step, all feedback and errors will show as "anonymous" in the BritePulse console.

```javascript
// Helper functions - add to your app
function setBritePulseUser(user) {
  function trySetUser(attempts) {
    if (attempts > 50) return; // Give up after 5 seconds
    const instance = window.BritePulse?.getInstance();
    if (instance) {
      instance.setUser({
        id: user.id,         // Required: unique identifier
        email: user.email,   // Recommended: shows in "Reported By"
        role: user.role      // Optional: "admin", "user", etc.
      });
    } else {
      // SDK not ready yet, retry
      setTimeout(() => trySetUser(attempts + 1), 100);
    }
  }
  trySetUser(0);
}

function clearBritePulseUser() {
  window.BritePulse?.getInstance()?.setUser(undefined);
}
```

> **Timing matters:** The SDK loads with `defer`, so `getInstance()` may return `null` if called too early. Always use the retry pattern above.

### Example: Vanilla JS with server-injected user

```html
<script>
  // Assuming your server injects: window.AUTH_USER = { id: "...", email: "...", name: "..." }
  if (window.AUTH_USER) {
    setBritePulseUser({
      id: window.AUTH_USER.id,
      email: window.AUTH_USER.email
    });
  }
</script>
```

### Example: Firebase Auth

```javascript
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
  if (user) {
    setBritePulseUser({ id: user.uid, email: user.email });
  } else {
    clearBritePulseUser();
  }
});
```

### Example: React with useEffect

```javascript
useEffect(() => {
  if (currentUser) {
    setBritePulseUser({
      id: currentUser.id,
      email: currentUser.email
    });
  }
  return () => clearBritePulseUser();
}, [currentUser]);
```

## Common Pitfalls

| Problem | Cause | Solution |
|---------|-------|----------|
| Feedback shows "anonymous" | `setUser()` never called | Implement Step 2 |
| `getInstance()` returns `null` | Called before SDK initialized | Use retry pattern (see Step 2) |
| `setUser()` doesn't work | Called on `window.BritePulse` directly | Must call on `getInstance()` result |

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
        captureNetworkErrors?: boolean;
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

Wrap your app with the built-in ErrorBoundary to capture React component errors:

```tsx
import { BritePulseErrorBoundary } from '@britepulse/sdk';

// Basic usage - wrap your app or components
function App() {
  return (
    <BritePulseErrorBoundary>
      <YourApp />
    </BritePulseErrorBoundary>
  );
}

// With custom fallback UI
<BritePulseErrorBoundary
  fallback={<div>Something went wrong. Please refresh.</div>}
>
  <YourComponent />
</BritePulseErrorBoundary>

// With reset capability (let users retry)
<BritePulseErrorBoundary
  fallback={(error, resetError) => (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={resetError}>Try Again</button>
    </div>
  )}
>
  <YourComponent />
</BritePulseErrorBoundary>
```

Props:
- `children`: Components to wrap
- `fallback`: ReactNode or function `(error, resetError) => ReactNode`
- `onError`: Optional callback when error occurs
- `reportError`: Whether to send to BritePulse (default: true)

## API Methods

```typescript
// Manual error capture with metadata
window.BritePulse?.captureError(error, {
  context: 'checkout',
  orderId: '12345',
});

// Open feedback widget programmatically
window.BritePulse?.openWidget();
```

## Image Attachments

The feedback widget supports image attachments for visual context (screenshots, error states, etc.).

### Widget Usage
- Click the **Attach Image** button in the feedback widget
- Supported: JPEG, PNG, GIF, WebP (max 5MB)
- A thumbnail preview shows before submission
- Attachments appear in the Console under Issues > Events tab

### Programmatic Attachment

```typescript
// Submit feedback with an image
async function submitFeedbackWithImage(imageFile: File) {
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const base64Data = await toBase64(imageFile);

  window.BritePulse?.getInstance()?.submitFeedback({
    category: 'bug',
    description: 'Issue with screenshot attached',
    attachments: [{
      filename: imageFile.name,
      content_type: imageFile.type,
      data: base64Data,
      user_opted_in: true,  // Required
    }],
  });
}
```

### Storage Notes
- Images stored securely in Google Cloud Storage
- 90-day automatic retention
- Time-limited signed URLs (15 min) for security

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
