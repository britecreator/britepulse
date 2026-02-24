import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIssues, useApps } from '../hooks/useApi';
import { useMyAppIds } from '../hooks/useMyAppIds';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const { myAppIds, ownsApps } = useMyAppIds();
  const { data: issuesData, isLoading: issuesLoading } = useIssues({
    status: ['new', 'triaged', 'in_progress'],
    page_size: 5,
    sort_by: 'priority_score',
    sort_dir: 'desc',
    ...(ownsApps && { app_ids: myAppIds }),
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

      {/* How BritePulse Works */}
      <div className="card p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900">How BritePulse Works</h2>
          <p className="mt-1 text-sm text-gray-500">
            Your AI-powered feedback and error monitoring system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feedback Widget */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">User Feedback Widget</h3>
              <p className="mt-1 text-sm text-gray-500">
                Users submit bugs and feature requests directly from your app with screenshots and context.
              </p>
            </div>
          </div>

          {/* Auto Error Capture */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Automatic Error Capture</h3>
              <p className="mt-1 text-sm text-gray-500">
                JavaScript errors and failed API calls (4xx/5xx) are captured automatically with full context.
              </p>
            </div>
          </div>

          {/* Easy Integration */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">One-Line Install</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add a single script tag to your app. Get an agent-ready install guide from the Apps page.
              </p>
            </div>
          </div>

          {/* AI Context Files */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI-Ready Context Files</h3>
              <p className="mt-1 text-sm text-gray-500">
                Download issue context as markdown files optimized for AI coding assistants like Claude or Cursor.
              </p>
            </div>
          </div>

          {/* Auto Notifications */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Automatic Resolution Emails</h3>
              <p className="mt-1 text-sm text-gray-500">
                When you resolve an issue, the user who reported it automatically gets notified via email.
              </p>
            </div>
          </div>

          {/* Daily Briefs */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Daily Issue Briefs</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get a daily email summary of new and trending issues across your applications.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
