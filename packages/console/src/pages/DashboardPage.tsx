import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIssues, useApps } from '../hooks/useApi';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const { data: issuesData, isLoading: issuesLoading } = useIssues({
    status: ['new', 'triaged', 'in_progress'],
    page_size: 5,
    sort_by: 'priority_score',
    sort_dir: 'desc',
  });
  const { data: apps, isLoading: appsLoading } = useApps();

  const isAdmin = hasRole('Admin');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.email?.split('@')[0]}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening across your applications
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <dt className="text-sm font-medium text-gray-500 truncate">
            Active Issues
          </dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">
            {issuesLoading ? '-' : issuesData?.total ?? 0}
          </dd>
        </div>
        {isAdmin && (
          <div className="card p-5">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Applications
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {appsLoading ? '-' : apps?.length ?? 0}
            </dd>
          </div>
        )}
      </div>

      {/* Top Issues */}
      <div className="card">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Top Priority Issues
            </h2>
            <Link to="/issues" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {issuesLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : issuesData?.issues?.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No active issues
            </div>
          ) : (
            issuesData?.issues?.map((issue) => (
              <Link
                key={issue.issue_id}
                to={`/issues/${issue.issue_id}`}
                className="block px-4 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className={`badge-${issue.severity.toLowerCase()}`}>
                      {issue.severity}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {issue.title}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>{issue.counts.occurrences_24h} events (24h)</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/issues" className="btn-primary">
            View All Issues
          </Link>
          {isAdmin && (
            <Link to="/admin/apps" className="btn-secondary">
              Manage Apps
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
