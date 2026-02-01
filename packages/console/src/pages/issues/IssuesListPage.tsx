import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useIssues, useApps } from '../../hooks/useApi';
import type { IssueStatus, Severity, Environment, Issue } from '../../types';

const STATUSES: IssueStatus[] = ['new', 'triaged', 'in_progress', 'resolved', 'wont_fix'];
const SEVERITIES: Severity[] = ['P0', 'P1', 'P2', 'P3'];

// Format date for display (e.g., "Jan 20, 2:30 PM" or "Jan 20, 2025" if older)
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isThisYear) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function IssuesListPage() {
  // Default to showing active statuses (exclude 'resolved' and 'wont_fix')
  const [filters, setFilters] = useState({
    app_id: '',
    environment: '' as Environment | '',
    status: ['new', 'triaged', 'in_progress'] as IssueStatus[],
    severity: [] as Severity[],
    search: '',
    sort_by: 'priority_score' as const,
    sort_dir: 'desc' as const,
    page: 1,
    page_size: 25,
  });

  const { data, isLoading, error } = useIssues(filters);
  const { data: apps } = useApps();

  // Create a map of app_id to app name for display
  const appNameMap = useMemo(() => {
    return Object.fromEntries(apps?.map((app) => [app.app_id, app.name]) ?? []);
  }, [apps]);

  // Helper to determine if issue is from user feedback or auto error
  const getIssueSource = (issue: Issue) => {
    if (issue.issue_type === 'feedback' || issue.issue_type === 'feature') {
      return { label: 'User Feedback', className: 'bg-blue-100 text-blue-800' };
    }
    return { label: 'Auto Error', className: 'bg-red-100 text-red-800' };
  };

  function toggleStatus(status: IssueStatus) {
    setFilters((f) => ({
      ...f,
      status: f.status.includes(status)
        ? f.status.filter((s) => s !== status)
        : [...f.status, status],
      page: 1,
    }));
  }

  function toggleSeverity(severity: Severity) {
    setFilters((f) => ({
      ...f,
      severity: f.severity.includes(severity)
        ? f.severity.filter((s) => s !== severity)
        : [...f.severity, severity],
      page: 1,
    }));
  }

  function handleNextPage() {
    setFilters((f) => ({ ...f, page: f.page + 1 }));
  }

  function handlePrevPage() {
    setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }));
  }

  const total = data?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / filters.page_size) : 1;
  const currentPage = filters.page;
  const startItem = total > 0 ? (filters.page - 1) * filters.page_size + 1 : 0;
  const endItem = Math.min(filters.page * filters.page_size, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Issues</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track and manage issues across your applications
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Application</label>
            <select
              className="input mt-1"
              value={filters.app_id}
              onChange={(e) => setFilters((f) => ({ ...f, app_id: e.target.value, page: 1 }))}
            >
              <option value="">All Apps</option>
              {apps?.map((app) => (
                <option key={app.app_id} value={app.app_id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Environment</label>
            <select
              className="input mt-1"
              value={filters.environment}
              onChange={(e) => setFilters((f) => ({ ...f, environment: e.target.value as Environment | '', page: 1 }))}
            >
              <option value="">All Environments</option>
              <option value="prod">Production</option>
              <option value="stage">Staging</option>
              <option value="dev">Development</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <input
              type="text"
              className="input mt-1"
              placeholder="Search by title or description..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
            {STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`mr-1 mb-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                  filters.status.includes(status)
                    ? 'bg-primary-100 border-primary-300 text-primary-800'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700 mr-2">Severity:</span>
            {SEVERITIES.map((severity) => (
              <button
                key={severity}
                onClick={() => toggleSeverity(severity)}
                className={`mr-1 mb-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                  filters.severity.includes(severity)
                    ? 'bg-primary-100 border-primary-300 text-primary-800'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            Failed to load issues: {error.message}
          </div>
        ) : data?.issues?.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No issues found matching your filters
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    App / Env
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reported By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.issues?.map((issue) => (
                  <tr key={issue.issue_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        to={`/issues/${issue.issue_id}`}
                        className="block"
                      >
                        <div className="flex items-center space-x-2">
                          <span className={`badge-${issue.severity.toLowerCase()}`}>
                            {issue.severity}
                          </span>
                          <span className="text-sm font-medium text-gray-900 hover:text-primary-600">
                            {issue.title}
                          </span>
                          {issue.ai_analysis && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-primary-100 text-primary-700">
                              AI
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-500 truncate max-w-md">
                          {issue.description}
                        </p>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="font-medium text-gray-900">
                        {appNameMap[issue.app_id] || issue.app_id}
                      </div>
                      <div className="text-xs">{issue.environment}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          getIssueSource(issue).className
                        }`}
                      >
                        {getIssueSource(issue).label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {issue.reported_by?.email ||
                        issue.reported_by?.user_id ||
                        'Anonymous'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(issue.timestamps.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge-${issue.status}`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={handlePrevPage}
                  disabled={filters.page <= 1}
                  className="btn-ghost"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="btn-ghost"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">{startItem}</span> to{' '}
                    <span className="font-medium">{endItem}</span>{' '}
                    of <span className="font-medium">{total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={handlePrevPage}
                      disabled={filters.page <= 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
