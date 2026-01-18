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
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
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
      fetchApi<{ app: App }>(`/admin/apps/${appId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
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
      fetchApi<{ keys: { public_key: string; server_key: string } }>(
        `/admin/apps/${appId}/rotate-keys`,
        {
          method: 'POST',
          body: JSON.stringify({ environment }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps', appId] });
    },
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
      fetchApi<{ issues: Issue[]; total: number }>(`/issues?${params}`),
  });
}

export function useIssue(issueId: string) {
  return useQuery({
    queryKey: ['issues', issueId],
    queryFn: () =>
      fetchApi<{ issue: Issue }>(`/issues/${issueId}`).then((r) => r.issue),
    enabled: !!issueId,
  });
}

export function useIssueEvents(issueId: string) {
  return useQuery({
    queryKey: ['issues', issueId, 'events'],
    queryFn: () =>
      fetchApi<{ events: Event[] }>(`/issues/${issueId}/events`).then(
        (r) => r.events
      ),
    enabled: !!issueId,
  });
}

export function useUpdateIssue(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status?: IssueStatus; severity?: Severity; assigned_to?: string }) =>
      fetchApi<{ issue: Issue }>(`/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues', issueId] });
    },
  });
}

export function useTriageIssue(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (force: boolean = false) =>
      fetchApi<{ success: boolean; analysis?: unknown }>(`/issues/${issueId}/triage`, {
        method: 'POST',
        body: JSON.stringify({ force }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', issueId] });
    },
  });
}

export function useMergeIssues() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) =>
      fetchApi<{ issue: Issue }>(`/issues/${targetId}/merge`, {
        method: 'POST',
        body: JSON.stringify({ source_issue_ids: sourceIds }),
      }),
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
