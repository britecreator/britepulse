import { useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useIssue,
  useIssueEvents,
  useUpdateIssueStatus,
  useUpdateIssueSeverity,
  useAssignIssue,
  useUsers,
  useIssueComments,
  useAddComment,
  useAttachmentUrl,
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

// Attachment thumbnail component
function AttachmentThumbnail({ attachmentId }: { attachmentId: string }) {
  const { data, isLoading, error } = useAttachmentUrl(attachmentId);

  if (isLoading) {
    return (
      <div className="h-16 w-16 rounded border border-gray-200 bg-gray-100 animate-pulse" />
    );
  }

  if (error || !data?.url) {
    return (
      <div className="h-16 w-16 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
        Error
      </div>
    );
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block"
      title="Click to view full image"
    >
      <img
        src={data.url}
        alt="Attachment"
        className="h-16 w-auto rounded border border-gray-200 hover:border-primary-400 transition-colors cursor-pointer"
        onError={(e) => {
          // Hide broken images
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </a>
  );
}

export default function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const { data: issue, isLoading, error } = useIssue(issueId!);
  const { data: events, isLoading: eventsLoading } = useIssueEvents(issueId!);
  const updateStatus = useUpdateIssueStatus(issueId!);
  const updateSeverity = useUpdateIssueSeverity(issueId!);
  const assignIssue = useAssignIssue(issueId!);
  const { data: users } = useUsers();
  const { data: comments, isLoading: commentsLoading } = useIssueComments(issueId!);
  const addComment = useAddComment(issueId!);

  const [activeTab, setActiveTab] = useState<'timeline' | 'events' | 'comments'>('timeline');
  const [commentText, setCommentText] = useState('');
  const [resolutionModal, setResolutionModal] = useState<{ status: IssueStatus } | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // @mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasPrefilledRef = useRef(false);

  // @mention candidates: reporter + team members (deduped)
  // Must be before early returns to satisfy React hooks rules
  const mentionCandidates = useMemo(() => {
    const candidates: Array<{ email: string; name?: string; isReporter: boolean }> = [];
    if (issue?.reported_by?.email) {
      candidates.push({ email: issue.reported_by.email, isReporter: true });
    }
    const reporterEmail = issue?.reported_by?.email?.toLowerCase();
    users?.forEach((u) => {
      if (u.email.toLowerCase() !== reporterEmail) {
        candidates.push({ email: u.email, name: u.name, isReporter: false });
      }
    });
    return candidates;
  }, [issue?.reported_by?.email, users]);

  const filteredMentions = useMemo(() => {
    if (!mentionQuery) return mentionCandidates;
    const q = mentionQuery.toLowerCase();
    return mentionCandidates.filter(
      (c) => c.email.toLowerCase().includes(q) || (c.name && c.name.toLowerCase().includes(q))
    );
  }, [mentionCandidates, mentionQuery]);

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

  function handleComposeFocus() {
    if (!hasPrefilledRef.current && issue?.reported_by?.email && commentText === '') {
      setCommentText(`@${issue.reported_by.email} `);
      hasPrefilledRef.current = true;
    }
  }

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setCommentText(value);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/(^|\s)@([^\s]*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[2]);
      setShowMentionDropdown(true);
      setMentionIndex(0);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
  }

  function handleMentionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showMentionDropdown || filteredMentions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredMentions[mentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentionDropdown(false);
    }
  }

  function insertMention(candidate: { email: string }) {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = commentText.substring(0, cursorPos);
    const textAfterCursor = commentText.substring(cursorPos);

    const atPos = textBeforeCursor.lastIndexOf('@');
    const before = commentText.substring(0, atPos);
    const newText = `${before}@${candidate.email} ${textAfterCursor}`;

    setCommentText(newText);
    setShowMentionDropdown(false);

    const newCursorPos = atPos + candidate.email.length + 2;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  function renderCommentBody(body: string): React.ReactNode {
    const parts = body.split(/(@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
    return parts.map((part, i) => {
      if (part.match(/^@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        return (
          <span key={i} className="text-primary-600 font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  }

  async function handleStatusChange(status: IssueStatus) {
    if (status === 'resolved' || status === 'wont_fix') {
      setResolutionModal({ status });
      setResolutionNote('');
      return;
    }
    await updateStatus.mutateAsync({ status });
  }

  async function handleResolutionSubmit() {
    if (!resolutionModal) return;
    await updateStatus.mutateAsync({
      status: resolutionModal.status,
      resolution_note: resolutionNote || undefined,
    });
    setResolutionModal(null);
    setResolutionNote('');
  }

  async function handleSeverityChange(severity: Severity) {
    await updateSeverity.mutateAsync({ severity });
  }

  async function handleAssigneeChange(assignedTo: string) {
    await assignIssue.mutateAsync({ assigned_to: assignedTo });
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    await addComment.mutateAsync({ body: commentText.trim() });
    setCommentText('');
    hasPrefilledRef.current = false;
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
  // Only the current assignee or an Admin can reassign
  const canReassign = user?.role === 'Admin' || user?.email === issue?.routing?.assigned_to;

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
            <div className="mt-1 text-sm text-gray-500">
              User: {issue.reported_by?.email || issue.reported_by?.user_id || 'Anonymous'}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Assigned to: {issue.routing?.assigned_to || 'Unassigned'}
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
            <div>
              <label className="label">Assigned To</label>
              <select
                className="input mt-1"
                value={issue.routing?.assigned_to || ''}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                disabled={!canReassign || assignIssue.isPending}
              >
                <option value="">Unassigned</option>
                {users?.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name || u.email}
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
          <nav className="-mb-px flex items-center space-x-8 px-4" aria-label="Tabs">
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
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'comments'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Comments ({comments?.length ?? 0})
            </button>
            {events?.some((e) => e.attachment_refs && e.attachment_refs.length > 0) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-400 text-amber-900 shadow-sm">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                User Attached Image
              </span>
            )}
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
                          {issue.resolution_note && (
                            <div className="mt-2 bg-green-50 border-l-4 border-green-400 p-3 rounded-r">
                              <p className="text-xs font-semibold text-green-800 mb-1">Note:</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.resolution_note}</p>
                            </div>
                          )}
                          <div className="mt-1 text-sm text-gray-500">
                            {formatDate(issue.timestamps.resolved_at)}
                          </div>
                        </div>
                      </div>
                    </li>
                  )}

                  {/* Won't Fix */}
                  {issue.timestamps.wont_fix_at && (
                    <li className="relative pb-8">
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center ring-8 ring-white">
                            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Marked as won't fix
                            </p>
                          </div>
                          {issue.resolution_note && (
                            <div className="mt-2 bg-gray-50 border-l-4 border-gray-400 p-3 rounded-r">
                              <p className="text-xs font-semibold text-gray-600 mb-1">Note:</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.resolution_note}</p>
                            </div>
                          )}
                          <div className="mt-1 text-sm text-gray-500">
                            {formatDate(issue.timestamps.wont_fix_at)}
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
                          {event.route_or_url && event.route_or_url !== '/' && (
                            <span className="text-sm text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {event.route_or_url}
                            </span>
                          )}
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
                      {event.attachment_refs && event.attachment_refs.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Attachments ({event.attachment_refs.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {event.attachment_refs.map((attachmentId) => (
                              <AttachmentThumbnail key={attachmentId} attachmentId={attachmentId} />
                            ))}
                          </div>
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

          {activeTab === 'comments' && (
            <div>
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : comments?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No comments yet
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {comments?.map((comment) => (
                    <div key={comment.comment_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {comment.author_name || comment.author_email}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            comment.source === 'email'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {comment.source === 'email' ? 'via email' : 'console'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderCommentBody(comment.body)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Compose area */}
              {canEdit && (
                <div className="border-t pt-4">
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      className="input w-full h-20 resize-none"
                      placeholder="Add a comment... Use @ to mention someone"
                      value={commentText}
                      onChange={handleCommentChange}
                      onKeyDown={handleMentionKeyDown}
                      onFocus={handleComposeFocus}
                    />
                    {showMentionDropdown && filteredMentions.length > 0 && (
                      <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                        {filteredMentions.map((candidate, idx) => (
                          <button
                            key={candidate.email}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 ${
                              idx === mentionIndex ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              insertMention(candidate);
                            }}
                          >
                            <div>
                              {candidate.name && (
                                <span className="font-medium">{candidate.name}</span>
                              )}
                              <span className={candidate.name ? 'ml-2 text-gray-500' : ''}>
                                {candidate.email}
                              </span>
                            </div>
                            {candidate.isReporter && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                Reporter
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      className="btn-primary"
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || addComment.isPending}
                    >
                      {addComment.isPending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resolution Note Modal */}
      {resolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {resolutionModal.status === 'resolved' ? 'Resolve Issue' : "Mark as Won't Fix"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Add an optional note that will be included in the email to the reporter and shown on the issue.
            </p>
            <textarea
              className="input w-full h-24 resize-none"
              placeholder="Add a note (optional)..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                className="btn-secondary"
                onClick={() => setResolutionModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleResolutionSubmit}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
