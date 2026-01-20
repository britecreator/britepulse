import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useIssue,
  useIssueEvents,
  useUpdateIssueStatus,
  useUpdateIssueSeverity,
} from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import type { IssueStatus, IssueType, Severity } from '../../types';

const STATUSES: IssueStatus[] = ['new', 'triaged', 'in_progress', 'resolved', 'wont_fix'];
const SEVERITIES: Severity[] = ['P0', 'P1', 'P2', 'P3'];
const ISSUE_TYPE_BUG: IssueType = 'bug';

// Safe date formatting helper
function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString();
}

export default function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { data: issue, isLoading, error } = useIssue(issueId!);
  const { data: events, isLoading: eventsLoading } = useIssueEvents(issueId!);
  const updateStatus = useUpdateIssueStatus(issueId!);
  const updateSeverity = useUpdateIssueSeverity(issueId!);

  const [activeTab, setActiveTab] = useState<'timeline' | 'events'>('timeline');

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">
          {error ? `Failed to load issue: ${error.message}` : 'Issue not found'}
        </p>
        <button onClick={() => navigate('/issues')} className="btn-primary mt-4">
          Back to Issues
        </button>
      </div>
    );
  }

  async function handleStatusChange(status: IssueStatus) {
    await updateStatus.mutateAsync({ status });
  }

  async function handleSeverityChange(severity: Severity) {
    await updateSeverity.mutateAsync({ severity });
  }

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  async function handleDownloadContext() {
    const token = localStorage.getItem('britepulse_token');
    const response = await fetch(`${API_BASE}/issues/${issueId}/context?format=markdown`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      alert('Failed to download context file');
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `issue-${issueId}-context.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Admin, PO, and Engineer can edit issues
  const canEdit = hasRole('Admin') || hasRole('PO') || hasRole('Engineer');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/issues')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center"
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Issues
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <span className={`badge-${issue.severity.toLowerCase()}`}>
                {issue.severity}
              </span>
              <span className={`badge-${issue.status}`}>
                {issue.status.replace('_', ' ')}
              </span>
              <h1 className="text-2xl font-bold text-gray-900">{issue.title}</h1>
            </div>
            <p className="mt-2 text-gray-600 whitespace-pre-wrap">{issue.description}</p>
            <div className="mt-2 text-sm text-gray-500">
              {issue.app_id} / {issue.environment} | First seen:{' '}
              {formatDate(issue.timestamps.created_at)}
            </div>
          </div>
          <button
            onClick={handleDownloadContext}
            className="btn-primary flex items-center gap-2"
            title="Download a context file to give to your AI coding agent"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download for AI Agent
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <dt className="text-sm font-medium text-gray-500">Events (24h)</dt>
          <dd className="mt-1 text-2xl font-semibold text-gray-900">
            {issue.counts.occurrences_24h}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-sm font-medium text-gray-500">Users (24h)</dt>
          <dd className="mt-1 text-2xl font-semibold text-gray-900">
            {issue.counts.unique_users_24h_est}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-sm font-medium text-gray-500">Total Events</dt>
          <dd className="mt-1 text-2xl font-semibold text-gray-900">
            {issue.counts.occurrences_total}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-sm font-medium text-gray-500">Priority Score</dt>
          <dd className="mt-1 text-2xl font-semibold text-gray-900">
            {issue.priority_score?.toFixed(0) ?? '-'}
          </dd>
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="card p-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="label">Status</label>
              <select
                className="input mt-1"
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                disabled={updateStatus.isPending}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Severity</label>
              <select
                className="input mt-1"
                value={issue.severity}
                onChange={(e) => handleSeverityChange(e.target.value as Severity)}
                disabled={updateSeverity.isPending}
              >
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'timeline'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'events'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Events ({events?.length ?? 0})
            </button>
          </nav>
        </div>

        <div className="p-4">
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flow-root">
                <ul className="-mb-8">
                  {/* Issue created */}
                  <li className="relative pb-8">
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Issue created
                          </p>
                          <p className="text-sm text-gray-500">
                            {issue.issue_type === ISSUE_TYPE_BUG ? 'Auto-captured error' : 'User-submitted feedback'}
                          </p>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {formatDate(issue.timestamps.created_at)}
                        </div>
                      </div>
                    </div>
                  </li>

                  {/* Last activity */}
                  {issue.timestamps.last_seen_at && issue.timestamps.last_seen_at !== issue.timestamps.created_at && (
                    <li className="relative pb-8">
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center ring-8 ring-white">
                            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Last occurrence
                            </p>
                            <p className="text-sm text-gray-500">
                              {issue.counts.occurrences_total} total occurrences
                            </p>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {formatDate(issue.timestamps.last_seen_at)}
                          </div>
                        </div>
                      </div>
                    </li>
                  )}

                  {/* Resolved */}
                  {issue.timestamps.resolved_at && (
                    <li className="relative pb-8">
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center ring-8 ring-white">
                            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Issue resolved
                            </p>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {formatDate(issue.timestamps.resolved_at)}
                          </div>
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div>
              {eventsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : events?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No events found
                </div>
              ) : (
                <div className="space-y-4">
                  {events?.slice(0, 20).map((event) => (
                    <div key={event.event_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`badge ${
                            event.event_type === 'error' ? 'bg-red-100 text-red-800' :
                            event.event_type === 'feedback' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.event_type}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDate(event.timestamp)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{event.event_id}</span>
                      </div>
                      {event.payload.error && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-900">
                            {event.payload.error.message}
                          </p>
                          {event.payload.error.stack && (
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-32">
                              {event.payload.error.stack}
                            </pre>
                          )}
                        </div>
                      )}
                      {event.payload.feedback && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            {event.payload.feedback.comment}
                          </p>
                          {event.payload.feedback.sentiment && (
                            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {event.payload.feedback.sentiment}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {events && events.length > 20 && (
                    <p className="text-center text-sm text-gray-500">
                      Showing 20 of {events.length} events
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
