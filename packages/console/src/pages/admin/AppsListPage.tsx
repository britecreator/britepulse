import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApps, useCreateApp } from '../../hooks/useApi';
import Modal from '../../components/Modal';

export default function AppsListPage() {
  const { data: apps, isLoading, error } = useApps();
  const createApp = useCreateApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAppName, setNewAppName] = useState('');

  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateApp(e: React.FormEvent) {
    e.preventDefault();
    if (!newAppName.trim()) return;
    setCreateError(null);

    try {
      await createApp.mutateAsync({
        name: newAppName.trim(),
        environments: [
          { env_name: 'dev', enabled: true, daily_brief_enabled: false, ai_enabled: true },
          { env_name: 'stage', enabled: true, daily_brief_enabled: false, ai_enabled: true },
          { env_name: 'prod', enabled: true, daily_brief_enabled: true, ai_enabled: true },
        ],
        base_url_patterns: ['*'], // Allow all URLs initially
        owners: {
          po_emails: ['dustin.sitar@brite.co'], // Default to current user
        },
      });
      setShowCreateModal(false);
      setNewAppName('');
    } catch (err: any) {
      console.error('Failed to create app:', err);
      setCreateError(err.message || 'Failed to create app');
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load apps: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your registered applications and their configurations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          Add Application
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Environments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owners
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Auto Triage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Daily Brief
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {apps?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No applications registered yet. Click "Add Application" to get started.
                </td>
              </tr>
            ) : (
              apps?.map((app) => (
                <tr key={app.app_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {app.name}
                    </div>
                    <div className="text-sm text-gray-500">{app.app_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {app.environments.map((env) => (
                        <span
                          key={typeof env === 'string' ? env : env.env_name}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {typeof env === 'string' ? env : env.env_name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {app.owners?.po_emails?.length || 0} owner{(app.owners?.po_emails?.length || 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        app.policies?.ai_policy
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {app.policies?.ai_policy ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        app.schedules?.daily_brief_time_local
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {app.schedules?.daily_brief_time_local ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/admin/apps/${app.app_id}`}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      Configure
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Application"
      >
        <form onSubmit={handleCreateApp} className="space-y-4">
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {createError}
            </div>
          )}
          <div>
            <label htmlFor="appName" className="label">
              Application Name
            </label>
            <input
              type="text"
              id="appName"
              className="input mt-1"
              value={newAppName}
              onChange={(e) => setNewAppName(e.target.value)}
              placeholder="e.g., Portal, Admin Dashboard"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!newAppName.trim() || createApp.isPending}
            >
              {createApp.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
