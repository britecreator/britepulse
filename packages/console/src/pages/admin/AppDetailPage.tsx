import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useUpdateApp, useRotateKeys } from '../../hooks/useApi';

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
  const updateApp = useUpdateApp(appId!);
  const rotateKeys = useRotateKeys(appId!);

  const [editingOwners, setEditingOwners] = useState(false);
  const [newOwner, setNewOwner] = useState('');
  const [showKeys, setShowKeys] = useState<string | null>(null);
  const [rotatedKeys, setRotatedKeys] = useState<{ env: string; public_key: string; server_key: string } | null>(null);

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
    const updatedOwners = {
      ...app!.owners,
      po_emails: [...ownerEmails, newOwner.trim()],
    };
    await updateApp.mutateAsync({ owners: updatedOwners } as any);
    setNewOwner('');
    setEditingOwners(false);
  }

  async function handleRemoveOwner(ownerToRemove: string) {
    const updatedOwners = {
      ...app!.owners,
      po_emails: ownerEmails.filter((o: string) => o !== ownerToRemove),
    };
    await updateApp.mutateAsync({ owners: updatedOwners } as any);
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
          {editingOwners ? (
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
              <h3 className="text-sm font-medium text-gray-900">AI Triage</h3>
              <p className="text-sm text-gray-500">
                {app.policies?.ai_policy ? (
                  <>Min severity: {app.policies.ai_policy.eligible_severity_min}, Min occurrences: {app.policies.ai_policy.eligible_recurrence_min}</>
                ) : (
                  'Not configured'
                )}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                app.policies?.ai_policy ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {app.policies?.ai_policy ? 'Configured' : 'Default'}
            </span>
          </div>
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
        </div>
        <div className="divide-y divide-gray-200">
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Daily Brief</h3>
              <p className="text-sm text-gray-500">
                {app.schedules?.daily_brief_time_local ? (
                  <>{app.schedules.daily_brief_time_local} ({app.schedules.daily_brief_timezone || 'America/Chicago'})</>
                ) : (
                  'Not scheduled'
                )}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                app.schedules?.daily_brief_time_local ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {app.schedules?.daily_brief_time_local ? 'Enabled' : 'Disabled'}
            </span>
          </div>
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
