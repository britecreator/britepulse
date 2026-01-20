import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  App,
  Issue,
  IssueFilters,
  Event,
  IssueStatus,
  Severity,
} from '../types';

// API base URL - use VITE_API_URL in production, localhost in dev
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';
const TOKEN_KEY = 'britepulse_token';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }));
    const errorMessage = errorBody.message || `HTTP ${response.status}`;

    // Report server errors (5xx) to BritePulse for monitoring
    if (response.status >= 500) {
      const error = new Error(`API Error: ${errorMessage}`);
      window.BritePulse?.getInstance()?.captureError(error, {
        endpoint: path,
        method: options.method || 'GET',
        status: response.status,
        errorCode: errorBody.code,
      });
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

// Apps
export function useApps() {
  return useQuery({
    queryKey: ['apps'],
    queryFn: () => fetchApi<{ data: App[] }>('/admin/apps').then((r) => r.data),
  });
}

export function useApp(appId: string) {
  return useQuery({
    queryKey: ['apps', appId],
    queryFn: () => fetchApi<{ data: App }>(`/admin/apps/${appId}`).then((r) => r.data),
    enabled: !!appId,
  });
}

export function useCreateApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<App>) =>
      fetchApi<{ data: App }>('/admin/apps', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function useUpdateApp(appId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<App>) =>
      fetchApi<{ data: App }>(`/admin/apps/${appId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: ['apps', appId] });
    },
  });
}

export function useRotateKeys(appId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (environment: string) =>
      fetchApi<{ data: { public_key: string; server_key: string } }>(
        `/admin/apps/${appId}/rotate-keys`,
        {
          method: 'POST',
          body: JSON.stringify({ environment }),
        }
      ).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps', appId] });
    },
  });
}

export function useUpdateAppSchedules(appId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedules: {
      daily_brief_time_local?: string;
      daily_brief_timezone?: string;
      daily_brief_max_items?: number;
      daily_brief_min_items?: number;
      daily_brief_recipients?: string[];
      brief_mode?: 'daily' | 'only_on_issues';
    } | null) =>
      fetchApi<{ data: App }>(`/admin/apps/${appId}/schedules`, {
        method: 'PATCH',
        body: JSON.stringify(schedules || {}),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: ['apps', appId] });
    },
  });
}

export function useSendTestBrief(appId: string) {
  return useMutation({
    mutationFn: () =>
      fetchApi<{ data: { sent: boolean; to: string; issues_included: number; error?: string } }>(
        `/briefs/test/${appId}`,
        { method: 'POST' }
      ).then((r) => r.data),
  });
}

// Issues
export function useIssues(filters: Partial<IssueFilters> = {}) {
  const params = new URLSearchParams();
  if (filters.app_id) params.set('app_id', filters.app_id);
  if (filters.environment) params.set('environment', filters.environment);
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.severity?.length) params.set('severity', filters.severity.join(','));
  if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.page_size) params.set('page_size', String(filters.page_size));

  return useQuery({
    queryKey: ['issues', filters],
    queryFn: () =>
      fetchApi<{ data: Issue[]; pagination: { total: number } }>(`/issues?${params}`).then(
        (r) => ({ issues: r.data, total: r.pagination.total })
      ),
  });
}

export function useIssue(issueId: string) {
  return useQuery({
    queryKey: ['issues', issueId],
    queryFn: () =>
      fetchApi<{ data: Issue }>(`/issues/${issueId}`).then((r) => r.data),
    enabled: !!issueId,
  });
}

export function useIssueEvents(issueId: string) {
  return useQuery({
    queryKey: ['issues', issueId, 'events'],
    queryFn: () =>
      fetchApi<{ data: Event[] }>(`/issues/${issueId}/events`).then(
        (r) => r.data
      ),
    enabled: !!issueId,
  });
}

export function useUpdateIssueStatus(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: IssueStatus; reason?: string }) =>
      fetchApi<{ data: Issue }>(`/issues/${issueId}/actions/set-status`, {
        method: 'POST',
        body: JSON.stringify({ status: data.status, reason: data.reason || 'Status updated via console' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues', issueId] });
    },
  });
}

export function useUpdateIssueSeverity(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { severity: Severity; reason?: string }) =>
      fetchApi<{ data: Issue }>(`/issues/${issueId}/actions/set-severity`, {
        method: 'POST',
        body: JSON.stringify({ severity: data.severity, reason: data.reason || 'Severity updated via console' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues', issueId] });
    },
  });
}

// Keep backwards compatibility alias
export function useUpdateIssue(issueId: string) {
  return useUpdateIssueStatus(issueId);
}

export function useTriageIssue(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (force: boolean = false) =>
      fetchApi<{ data: { success: boolean; analysis?: unknown } }>(`/issues/${issueId}/actions/triage`, {
        method: 'POST',
        body: JSON.stringify({ force }),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', issueId] });
    },
  });
}

export function useMergeIssues() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, sourceIds, reason }: { targetId: string; sourceIds: string[]; reason?: string }) =>
      fetchApi<{ data: Issue }>(`/issues/${targetId}/actions/merge`, {
        method: 'POST',
        body: JSON.stringify({ source_issue_ids: sourceIds, reason: reason || 'Issues merged via console' }),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

// Users
interface User {
  user_id: string;
  email: string;
  name?: string;
  role: 'Admin' | 'PO' | 'Engineer' | 'ReadOnly';
  app_access: string[];
  created_at: string;
  updated_at: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetchApi<{ data: User[] }>('/admin/users').then((r) => r.data),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; name?: string; role: User['role']; app_access?: string[] }) =>
      fetchApi<{ data: User }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; role?: User['role']; app_access?: string[] }) =>
      fetchApi<{ data: User }>(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      fetchApi<{ data: { success: boolean } }>(`/admin/users/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
