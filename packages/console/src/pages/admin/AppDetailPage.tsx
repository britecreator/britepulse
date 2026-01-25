import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useUpdateOwners, useRotateKeys, useUpdateAppSchedules, useSendTestBrief } from '../../hooks/useApi';

type BriefFrequency = 'disabled' | 'daily' | 'only_on_issues' | 'instant';

interface InstallKeys {
  public_key: string;
  server_key: string;
  key_rotated_at: string;
}

interface EnvironmentConfig {
  env_name: string;
  enabled: boolean;
  daily_brief_enabled?: boolean;
  ai_enabled?: boolean;
}

export default function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const { data: app, isLoading, error } = useApp(appId!);
  const updateOwners = useUpdateOwners(appId!);
  const rotateKeys = useRotateKeys(appId!);
  const updateSchedules = useUpdateAppSchedules(appId!);
  const sendTestBrief = useSendTestBrief(appId!);

  const [editingOwners, setEditingOwners] = useState(false);
  const [newOwner, setNewOwner] = useState('');
  const [showKeys, setShowKeys] = useState<string | null>(null);
  const [rotatedKeys, setRotatedKeys] = useState<{ env: string; public_key: string; server_key: string } | null>(null);
  const [briefFrequency, setBriefFrequency] = useState<BriefFrequency>('disabled');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize brief settings from app data
  useEffect(() => {
    if (app) {
      const schedule = app.schedules;
      if (!schedule?.daily_brief_time_local) {
        setBriefFrequency('disabled');
      } else if (schedule.brief_mode === 'only_on_issues') {
        setBriefFrequency('only_on_issues');
      } else {
        setBriefFrequency('daily');
      }
    }
  }, [app]);

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    try {
      if (briefFrequency === 'disabled') {
        // Clear schedule by sending empty object (API will handle clearing)
        await updateSchedules.mutateAsync({});
      } else {
        await updateSchedules.mutateAsync({
          daily_brief_time_local: '05:00',
          daily_brief_timezone: 'America/Chicago',
          daily_brief_max_items: app?.schedules?.daily_brief_max_items || 10,
          daily_brief_min_items: app?.schedules?.daily_brief_min_items || 5,
          daily_brief_recipients: app?.schedules?.daily_brief_recipients || app?.owners?.po_emails || [],
          brief_mode: briefFrequency === 'only_on_issues' ? 'only_on_issues' : 'daily',
        });
      }
    } finally {
      setSavingSchedule(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">
          {error ? `Failed to load app: ${error.message}` : 'App not found'}
        </p>
        <button onClick={() => navigate('/admin/apps')} className="btn-primary mt-4">
          Back to Apps
        </button>
      </div>
    );
  }

  // Get owners array from the owners object structure
  const ownerEmails = app.owners?.po_emails || [];
  const installKeys = (app as any).install_keys as Record<string, InstallKeys> | undefined;
  const environments = app.environments as EnvironmentConfig[];

  async function handleAddOwner() {
    if (!newOwner.trim()) return;
    if (ownerEmails.length >= 3) return;
    const updatedEmails = [...ownerEmails, newOwner.trim()];
    const updatedOwners = {
      ...app!.owners,
      po_emails: updatedEmails,
    };
    await updateOwners.mutateAsync(updatedOwners);

    // Sync daily brief recipients if schedule exists
    if (app?.schedules?.daily_brief_time_local) {
      await updateSchedules.mutateAsync({
        ...app.schedules,
        daily_brief_recipients: updatedEmails,
      });
    }

    setNewOwner('');
    setEditingOwners(false);
  }

  async function handleRemoveOwner(ownerToRemove: string) {
    const updatedEmails = ownerEmails.filter((o: string) => o !== ownerToRemove);
    if (updatedEmails.length === 0) return;
    const updatedOwners = {
      ...app!.owners,
      po_emails: updatedEmails,
    };
    await updateOwners.mutateAsync(updatedOwners);

    // Sync daily brief recipients if schedule exists
    if (app?.schedules?.daily_brief_time_local) {
      await updateSchedules.mutateAsync({
        ...app.schedules,
        daily_brief_recipients: updatedEmails,
      });
    }
  }

  async function handleRotateKeys(environment: string) {
    if (!confirm(`Are you sure you want to rotate keys for ${environment}? Existing SDK installations will need to be updated.`)) {
      return;
    }
    const result = await rotateKeys.mutateAsync(environment);
    const keys = (result as any).data || (result as any).keys;
    setRotatedKeys({ env: environment, public_key: keys.public_key, server_key: keys.server_key });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function downloadIntegrationGuide() {
    if (!app) return;
    const prodKey = installKeys?.prod?.public_key || 'KEY_NOT_GENERATED';
    const stageKey = installKeys?.stage?.public_key;
    const apiUrl = 'https://britepulse-api-29820647719.us-central1.run.app';

    const guide = `# BritePulse Integration Guide for ${app.name}

## Quick Start

Add this script tag to your HTML \`<head>\`:

\`\`\`html
<script
  src="${apiUrl}/sdk.js"
  data-api-key="${prodKey}"
  data-api-url="${apiUrl}"
  defer
></script>
\`\`\`

That's it! The SDK will automatically:
- Show a feedback button in the bottom-right corner
- Capture uncaught JavaScript errors
- Capture network errors (fetch/XHR 4xx/5xx responses)
- Track user sessions

## Configuration

| Setting | Value |
|---------|-------|
| App ID | \`${app.app_id}\` |
| API URL | \`${apiUrl}\` |
| Public Key (prod) | \`${prodKey}\` |
${stageKey ? `| Public Key (stage) | \`${stageKey}\` |` : ''}

## Manual Initialization (React/SPA)

If you need more control, initialize manually instead of using data attributes:

\`\`\`tsx
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
        captureNetworkErrors?: boolean; // Auto-capture fetch/XHR 4xx/5xx (default: true)
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
        apiKey: '${prodKey}',
        apiUrl: '${apiUrl}',
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
\`\`\`

## Error Boundary (React)

Wrap your app with the built-in ErrorBoundary to capture React component errors:

\`\`\`tsx
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
\`\`\`

Props:
- \`children\`: Components to wrap
- \`fallback\`: ReactNode or function \`(error, resetError) => ReactNode\`
- \`onError\`: Optional callback when error occurs
- \`reportError\`: Whether to send to BritePulse (default: true)

## User Identification (Important!)

To see who submitted feedback in BritePulse, you must tell the SDK about the logged-in user. Without this, feedback will show as "anonymous".

\`\`\`typescript
// Call this after your user logs in (e.g., in your auth callback or useEffect)
window.BritePulse?.getInstance()?.setUser({
  id: user.id,           // Required: unique user identifier
  email: user.email,     // Recommended: shows in "Reported By" column
  role: user.role,       // Optional: e.g., "admin", "user", "guest"
});

// Call this when user logs out
window.BritePulse?.getInstance()?.setUser(undefined);
\`\`\`

**Example with Firebase Auth:**
\`\`\`typescript
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.BritePulse?.getInstance()?.setUser({
      id: user.uid,
      email: user.email || undefined,
    });
  } else {
    window.BritePulse?.getInstance()?.setUser(undefined);
  }
});
\`\`\`

## API Methods

\`\`\`typescript
// Manual error capture with metadata
window.BritePulse?.captureError(error, {
  context: 'checkout',
  orderId: '12345',
});

// Open feedback widget programmatically
window.BritePulse?.openWidget();
\`\`\`

## Image Attachments

The feedback widget allows users to attach images (screenshots, error states, etc.) to provide visual context with their feedback.

### Widget Behavior
- Users can click the attachment button (📎) in the feedback widget
- Supported formats: JPEG, PNG, GIF, WebP
- Maximum file size: 5MB per image
- Users must opt-in to attach images (checkbox in widget)

### Programmatic Attachment (Advanced)

For programmatic feedback submission with attachments:

\`\`\`typescript
// Submit feedback with an image attachment
async function submitFeedbackWithImage(imageFile: File) {
  // Convert file to base64
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const base64Data = await toBase64(imageFile);

  // Use the SDK's submitFeedback method with attachments
  window.BritePulse?.getInstance()?.submitFeedback({
    category: 'bug',
    description: 'User reported issue with screenshot',
    attachments: [{
      filename: imageFile.name,
      content_type: imageFile.type,
      data: base64Data,
      user_opted_in: true,  // Required: user must consent
    }],
  });
}
\`\`\`

### Viewing Attachments
Attachments appear in the BritePulse console under the Events tab for each issue. Click thumbnails to view full-size images.

### Storage & Privacy
- Images are stored securely in Google Cloud Storage
- Automatic 90-day retention (configurable)
- Access requires authentication and app permissions
- URLs are time-limited (15 minutes) for security

## Staging Environment

To use staging instead of production, use the staging public key:
${stageKey ? `\`\`\`html
<script
  src="${apiUrl}/sdk.js"
  data-api-key="${stageKey}"
  data-api-url="${apiUrl}"
  defer
></script>
\`\`\`` : '- Generate staging keys in the BritePulse console first'}

---

**Console:** https://britepulse-console-29820647719.us-central1.run.app
**App ID:** ${app.app_id}
`;

    const blob = new Blob([guide], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `britepulse-integration-${app.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/admin/apps')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center"
          >
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Apps
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{app.name}</h1>
          <p className="mt-1 text-sm text-gray-500">ID: {app.app_id}</p>
        </div>
        <button
          onClick={downloadIntegrationGuide}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Integration Guide
        </button>
      </div>

      {/* Environments Section */}
      <div className="card">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Environments</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configured environments for this application
          </p>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {environments.map((env: EnvironmentConfig) => (
              <span
                key={env.env_name}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  env.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {env.env_name}
                {env.enabled ? ' (Active)' : ' (Disabled)'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Owners Section */}
      <div className="card">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Owners</h2>
          <p className="mt-1 text-sm text-gray-500">
            Product owners who receive daily briefs and can manage this application
          </p>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {ownerEmails.length === 0 ? (
              <span className="text-gray-500">No owners assigned</span>
            ) : (
              ownerEmails.map((owner: string) => (
                <span
                  key={owner}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800"
                >
                  {owner}
                  <button
                    onClick={() => handleRemoveOwner(owner)}
                    className="ml-2 text-primary-600 hover:text-primary-800"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))
            )}
          </div>
          {ownerEmails.length >= 3 ? (
            <p className="text-sm text-gray-500">Maximum of 3 owners reached</p>
          ) : editingOwners ? (
            <div className="flex items-center space-x-2">
              <input
                type="email"
                className="input flex-1"
                placeholder="owner@brite.co"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                autoFocus
              />
              <button onClick={handleAddOwner} className="btn-primary">
                Add
              </button>
              <button onClick={() => setEditingOwners(false)} className="btn-ghost">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingOwners(true)} className="btn-secondary">
              Add Owner
            </button>
          )}
        </div>
      </div>

      {/* Policies Section */}
      <div className="card">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Policies</h2>
        </div>
        <div className="divide-y divide-gray-200">
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Redaction Profile</h3>
              <p className="text-sm text-gray-500">
                {app.policies?.redaction_profile || 'standard'}
              </p>
            </div>
          </div>
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Attachments</h3>
              <p className="text-sm text-gray-500">
                {app.policies?.attachment_policy?.allowed !== false ? 'Allowed' : 'Disabled'}
                {app.policies?.attachment_policy?.restricted_roles?.length ? (
                  <> (restricted for: {app.policies.attachment_policy.restricted_roles.join(', ')})</>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedules Section */}
      <div className="card">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Schedules</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure when to send email summaries to owners
          </p>
        </div>
        <div className="px-4 py-5 sm:px-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Daily Brief</label>
            <select
              className="input w-full max-w-md"
              value={briefFrequency}
              onChange={(e) => setBriefFrequency(e.target.value as BriefFrequency)}
            >
              <option value="disabled">Disabled</option>
              <option value="daily">Every day at scheduled time</option>
              <option value="only_on_issues">Daily, only when there are new submissions</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {briefFrequency === 'disabled' && 'No email summaries will be sent'}
              {briefFrequency === 'daily' && 'Send summary every day, even if there are no new issues'}
              {briefFrequency === 'only_on_issues' && 'Send summary only on days with new submissions'}
            </p>
          </div>

          {briefFrequency !== 'disabled' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Send Time</label>
              <p className="text-sm text-gray-500">
                5:00 AM (America/Chicago)
              </p>
            </div>
          )}

          {briefFrequency !== 'disabled' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Recipients</label>
              <p className="text-sm text-gray-500">
                {(app.schedules?.daily_brief_recipients?.length || 0) > 0
                  ? app.schedules?.daily_brief_recipients?.join(', ')
                  : ownerEmails.length > 0
                    ? `${ownerEmails.join(', ')} (from owners)`
                    : 'No recipients configured - add owners above'}
              </p>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="btn-primary"
            >
              {savingSchedule ? 'Saving...' : 'Save Schedule'}
            </button>
            <button
              onClick={async () => {
                setTestEmailStatus(null);
                try {
                  const result = await sendTestBrief.mutateAsync();
                  if (result.sent) {
                    setTestEmailStatus({
                      type: 'success',
                      message: `Test email sent to ${result.to} with ${result.issues_included} issues`,
                    });
                  } else {
                    setTestEmailStatus({
                      type: 'error',
                      message: result.error || 'Failed to send test email',
                    });
                  }
                } catch (err) {
                  setTestEmailStatus({
                    type: 'error',
                    message: err instanceof Error ? err.message : 'Failed to send test email',
                  });
                }
              }}
              disabled={sendTestBrief.isPending}
              className="btn-ghost"
            >
              {sendTestBrief.isPending ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>
          {testEmailStatus && (
            <div
              className={`mt-3 p-3 rounded-md text-sm ${
                testEmailStatus.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {testEmailStatus.message}
            </div>
          )}
        </div>
      </div>

      {/* Install Keys Section */}
      <div className="card">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Install Keys</h2>
          <p className="mt-1 text-sm text-gray-500">
            API keys for SDK installation in each environment
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {environments.map((env: EnvironmentConfig) => (
            <div key={env.env_name} className="px-4 py-5 sm:px-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900 capitalize">{env.env_name}</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowKeys(showKeys === env.env_name ? null : env.env_name)}
                    className="btn-ghost text-xs"
                  >
                    {showKeys === env.env_name ? 'Hide Keys' : 'Show Keys'}
                  </button>
                  <button
                    onClick={() => handleRotateKeys(env.env_name)}
                    className="btn-ghost text-xs text-orange-600 hover:text-orange-700"
                    disabled={rotateKeys.isPending}
                  >
                    Rotate Keys
                  </button>
                </div>
              </div>
              {showKeys === env.env_name && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-24">Public Key:</span>
                    <code className="flex-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                      {installKeys?.[env.env_name]?.public_key || 'Not generated'}
                    </code>
                    {installKeys?.[env.env_name]?.public_key && (
                      <button
                        onClick={() => copyToClipboard(installKeys[env.env_name].public_key)}
                        className="btn-ghost text-xs"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-24">Server Key:</span>
                    <code className="flex-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                      {installKeys?.[env.env_name]?.server_key || 'Not generated'}
                    </code>
                    {installKeys?.[env.env_name]?.server_key && (
                      <button
                        onClick={() => copyToClipboard(installKeys[env.env_name].server_key)}
                        className="btn-ghost text-xs"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              )}
              {rotatedKeys && rotatedKeys.env === env.env_name && (
                <div className="mt-4 p-4 bg-green-50 rounded-md">
                  <p className="text-sm text-green-800 font-medium mb-2">
                    Keys rotated successfully! Save these new keys:
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-green-700 w-24">Public Key:</span>
                      <code className="flex-1 bg-green-100 px-2 py-1 rounded text-xs font-mono">
                        {rotatedKeys.public_key}
                      </code>
                      <button
                        onClick={() => copyToClipboard(rotatedKeys.public_key)}
                        className="btn-ghost text-xs"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-700 w-24">Server Key:</span>
                      <code className="flex-1 bg-green-100 px-2 py-1 rounded text-xs font-mono">
                        {rotatedKeys.server_key}
                      </code>
                      <button
                        onClick={() => copyToClipboard(rotatedKeys.server_key)}
                        className="btn-ghost text-xs"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SDK Installation Instructions */}
      <div className="card">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">SDK Installation</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add the BritePulse SDK to your application
          </p>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">1. Add the SDK script</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`<script src="https://cdn.britepulse.io/sdk.js"></script>`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">2. Initialize with your public key</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`<script>
  BritePulse.init({
    publicKey: '${installKeys?.prod?.public_key || installKeys?.dev?.public_key || 'YOUR_PUBLIC_KEY'}',
    environment: 'prod', // or 'dev', 'stage'
    version: '1.0.0' // your app version
  });
</script>`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
