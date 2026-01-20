import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useIssue,
  useIssueEvents,
  useUpdateIssueStatus,
  useUpdateIssueSeverity,
  useTriageIssue,
} from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import type { IssueStatus, IssueType, Severity, FixOption } from '../../types';

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
  const triageIssue = useTriageIssue(issueId!);

  const [activeTab, setActiveTab] = useState<'timeline' | 'ai' | 'events'>('timeline');

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

  async function handleTriage() {
    await triageIssue.mutateAsync(false);
  }

  async function handleForceTriage() {
    await triageIssue.mutateAsync(true);
  }

  // Admin, PO, and Engineer can edit issues
  const canEdit = hasRole('Admin') || hasRole('PO') || hasRole('Engineer');
  const canTriage = hasRole('Admin') || hasRole('PO');

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
          {canTriage && (
            <button
              onClick={issue.ai_analysis ? handleForceTriage : handleTriage}
              className="btn-secondary"
              disabled={triageIssue.isPending}
            >
              {triageIssue.isPending
                ? 'Analyzing...'
                : issue.ai_analysis
                ? 'Re-analyze with AI'
                : 'Analyze with AI'}
            </button>
          )}
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
              onClick={() => setActiveTab('ai')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'ai'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              AI Analysis
              {issue.ai_analysis && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                  Available
                </span>
              )}
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

                  {/* AI Analysis completed */}
                  {issue.ai_analysis && (
                    <li className="relative pb-8">
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center ring-8 ring-white">
                            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              AI Analysis completed
                            </p>
                            <p className="text-sm text-gray-500">
                              {(issue.ai_analysis.confidence * 100).toFixed(0)}% confidence
                            </p>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {formatDate(issue.ai_analysis.generated_at)}
                          </div>
                        </div>
                      </div>
                    </li>
                  )}

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

          {activeTab === 'ai' && (
            <div>
              {issue.ai_analysis ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        Analyzed {formatDate(issue.ai_analysis.generated_at)}
                      </span>
                      <span className="text-sm text-gray-500">|</span>
                      <span className="text-sm text-gray-500">
                        {(issue.ai_analysis.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Classification</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      <span className={`badge-${issue.ai_analysis.severity.toLowerCase()}`}>
                        {issue.ai_analysis.severity}
                      </span>
                      <span className="ml-2">{issue.ai_analysis.classification}</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{issue.ai_analysis.severity_rationale}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Impact Summary</h3>
                    <p className="mt-1 text-sm text-gray-600">{issue.ai_analysis.impact_summary}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Root Cause Hypothesis</h3>
                    <p className="mt-1 text-sm text-gray-600">{issue.ai_analysis.root_cause_hypothesis}</p>
                  </div>

                  {issue.ai_analysis.fix_plan.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Fix Options</h3>
                      <ul className="mt-2 space-y-2">
                        {issue.ai_analysis.fix_plan.map((fix: FixOption) => (
                          <li key={fix.option_number} className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
                            <div className="font-medium">
                              Option {fix.option_number}: {fix.description}
                            </div>
                            <div className="text-gray-500">
                              Complexity: {fix.complexity} | Risk: {fix.risk_level}
                            </div>
                            <ul className="mt-1 list-disc list-inside text-gray-500">
                              {fix.steps.map((step: string, i: number) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Recommended Next Action</h3>
                    <p className="mt-1 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {issue.ai_analysis.next_action}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{issue.ai_analysis.next_action_rationale}</p>
                  </div>

                  {issue.ai_analysis.assumptions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Assumptions</h3>
                      <ul className="mt-1 list-disc list-inside text-sm text-gray-600">
                        {issue.ai_analysis.assumptions.map((a: string, i: number) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {issue.ai_analysis.additional_info_needed && issue.ai_analysis.additional_info_needed.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Additional Info Needed</h3>
                      <ul className="mt-1 list-disc list-inside text-sm text-gray-600">
                        {issue.ai_analysis.additional_info_needed.map((info: string, i: number) => (
                          <li key={i}>{info}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="mt-2">No AI analysis available yet</p>
                  {canTriage && (
                    <button
                      onClick={handleTriage}
                      className="btn-primary mt-4"
                      disabled={triageIssue.isPending}
                    >
                      {triageIssue.isPending ? 'Analyzing...' : 'Run AI Analysis'}
                    </button>
                  )}
                </div>
              )}
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
