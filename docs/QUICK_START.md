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
4. Copy the **Public Key** (you'll need this in the next step)

> **Note**: If no keys exist, click **Rotate Keys** to generate them.

---

## Step 3: Add the SDK to Your App

Add these two lines to your HTML, just before the closing `</body>` tag:

```html
<script src="https://britepulse-api-29820647719.us-central1.run.app/sdk.js"></script>
<script>
  BritePulse.init({
    publicKey: 'YOUR_PUBLIC_KEY_HERE',
    environment: 'prod'  // or 'dev', 'stage'
  });
</script>
```

Replace `YOUR_PUBLIC_KEY_HERE` with the public key from Step 2.

### Optional Configuration

```html
<script>
  BritePulse.init({
    publicKey: 'YOUR_PUBLIC_KEY_HERE',
    environment: 'prod',

    // Optional settings:
    version: '1.2.3',           // Your app version
    userId: 'user@brite.co',    // Current user (for tracking)
    userRole: 'admin',          // User's role

    // Widget customization:
    position: 'bottom-right',   // bottom-right, bottom-left, top-right, top-left
    buttonText: 'Feedback',     // Custom button text
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

## Troubleshooting

### Widget doesn't appear

- Check browser console for errors
- Verify your public key is correct
- Make sure the SDK script loaded (check Network tab)

### Feedback not showing in console

- Verify you're looking at the correct app/environment filter
- Check the API health: https://britepulse-api-29820647719.us-central1.run.app/health

### Errors not being captured

- Check that your public key matches the environment
- Look for CORS errors in browser console

---

## Next Steps

- **Configure AI Triage**: Enable automatic issue analysis in App settings
- **Set Up Daily Brief**: Configure email notifications for your team
- **Add More Owners**: Share access with your team members

---

## Support

Questions? Contact the BritePulse team or check the full documentation.
