# BritePulse Quick Start Guide

Add feedback collection and error monitoring to your BriteCo web app in under 5 minutes.

## Prerequisites

- Access to BritePulse Console: https://britepulse-console-29820647719.us-central1.run.app
- A `@brite.co` Google account

---

## Step 1: Register Your App

1. Log in to the [BritePulse Console](https://britepulse-console-29820647719.us-central1.run.app)
2. Go to **Admin** → **Applications**
3. Click **Add Application**
4. Enter your app name (e.g., "Portal", "Admin Dashboard")
5. Click **Create**

---

## Step 2: Get Your API Key

1. Click **Configure** on your newly created app
2. Scroll to **Install Keys**
3. Click **Show Keys** for your environment (dev, stage, or prod)
4. Copy the **Public Key** (starts with `pk_`)

> **Note**: If no keys exist, click **Rotate Keys** to generate them.

---

## Step 3: Add the SDK to Your App

Add this script tag to your HTML `<head>`:

```html
<script
  src="https://britepulse-api-29820647719.us-central1.run.app/sdk.js"
  data-api-key="YOUR_PUBLIC_KEY_HERE"
  data-api-url="https://britepulse-api-29820647719.us-central1.run.app"
  defer
></script>
```

Replace `YOUR_PUBLIC_KEY_HERE` with the public key from Step 2.

That's it! The SDK will automatically:
- Show a **Feedback** button in the bottom-right corner
- Capture uncaught JavaScript errors
- Track user sessions

### Optional: Manual Initialization

For more control (e.g., in React/Vue/Angular apps), initialize manually:

```html
<script src="https://britepulse-api-29820647719.us-central1.run.app/sdk.js"></script>
<script>
  BritePulse.init({
    apiKey: 'YOUR_PUBLIC_KEY_HERE',
    apiUrl: 'https://britepulse-api-29820647719.us-central1.run.app',

    // Optional settings:
    version: '1.2.3',                    // Your app version
    user: {
      id: 'user@brite.co',               // Current user ID
      email: 'user@brite.co',            // User email
      role: 'admin',                     // User's role
    },
    widgetPosition: 'bottom-right',      // bottom-right, bottom-left, top-right, top-left
    widgetButtonText: 'Feedback',        // Custom button text
    captureErrors: true,                 // Enable/disable error capture
    enableWidget: true,                  // Enable/disable feedback widget
    debug: false,                        // Enable console logging
  });
</script>
```

---

## Step 4: Verify Installation

1. Open your app in a browser
2. Look for the **Feedback** button (teal, bottom-right corner)
3. Click it and submit a test feedback
4. Check the BritePulse Console → **Issues** to see your feedback

### Testing Error Capture

Open your browser console and run:

```javascript
throw new Error('Test BritePulse error capture');
```

This error should appear in the BritePulse Console within a few seconds.

---

## What Gets Captured Automatically

| Event Type | Description |
|------------|-------------|
| **JavaScript Errors** | Uncaught exceptions and promise rejections |
| **User Feedback** | Feedback submitted through the widget |
| **Context** | Page URL, browser info, session ID |

---

## API Methods

```javascript
// Set user after login
BritePulse.getInstance()?.setUser({
  id: 'user123',
  email: 'user@brite.co',
  role: 'admin'
});

// Clear user on logout
BritePulse.getInstance()?.setUser(undefined);

// Manual error capture with metadata
BritePulse.captureError(new Error('Something failed'), {
  context: 'checkout',
  orderId: '12345'
});

// Open feedback widget programmatically
BritePulse.openWidget();
```

---

## Attaching Images

Users can attach images (screenshots, error states, etc.) when submitting feedback to provide visual context.

### Using the Widget
1. Click the **Feedback** button
2. Fill in your feedback description
3. Click the **📎 Attach Image** button
4. Select an image file (JPEG, PNG, GIF, or WebP, max 5MB)
5. A thumbnail preview will appear
6. Submit your feedback

### Programmatic Attachment

```javascript
// Convert a file to base64
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

// Submit feedback with an image
const imageFile = document.getElementById('imageInput').files[0];
const base64Data = await toBase64(imageFile);

BritePulse.getInstance()?.submitFeedback({
  category: 'bug',
  description: 'Button not working on mobile',
  attachments: [{
    filename: imageFile.name,
    content_type: imageFile.type,
    data: base64Data,
    user_opted_in: true,  // Required
  }],
});
```

### Supported Formats
- JPEG, PNG, GIF, WebP
- Maximum 5MB per file
- View attachments in the Console under **Issues** → Events tab

---

## Troubleshooting

### Widget doesn't appear

- Check browser console for errors
- Verify your public key is correct (starts with `pk_`)
- Make sure the SDK script loaded (check Network tab)

### Feedback not showing in console

- Verify you're looking at the correct app/environment filter
- Check the API health: https://britepulse-api-29820647719.us-central1.run.app/health

### Errors not being captured

- Check that your public key matches the environment
- Look for CORS errors in browser console

---

## Next Steps

- **Download Integration Guide**: Get a customized guide for your app from the Admin page
- **Set Up Daily Brief**: Configure email notifications for your team
- **Add Owners**: Share access with your team members

---

## Support

Questions? Contact the BritePulse team or check the full documentation.
