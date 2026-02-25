import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useApi';
import { useMyAppIds } from '../hooks/useMyAppIds';
import type { NotificationType } from '../types';

type FilterMode = 'all' | 'my_products' | 'tagged';

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMinutes = Math.floor((now - then) / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function NotificationsPage() {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { myAppIds } = useMyAppIds();
  const navigate = useNavigate();

  const queryOptions = useMemo(() => {
    const opts: { type?: string; appIds?: string[] } = {};
    if (filterMode === 'tagged') {
      opts.type = 'mention' satisfies NotificationType;
    }
    if (filterMode === 'my_products' && myAppIds.length > 0) {
      opts.appIds = myAppIds;
    }
    return opts;
  }, [filterMode, myAppIds]);

  const { data, isLoading } = useNotifications(queryOptions);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  function handleNotificationClick(notification: typeof notifications[0]) {
    if (!notification.read) {
      markRead.mutate(notification.notification_id);
    }
    navigate(`/issues/${notification.issue_id}`);
  }

  const filters: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'my_products', label: 'My Products' },
    { key: 'tagged', label: 'Tagged' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterMode(f.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              filterMode === f.key
                ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">
            {filterMode === 'all'
              ? 'No notifications yet'
              : filterMode === 'tagged'
                ? 'No mentions yet'
                : 'No notifications for your products'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {notifications.map((n) => (
            <button
              key={n.notification_id}
              onClick={() => handleNotificationClick(n)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                !n.read ? 'bg-primary-50/40' : ''
              }`}
            >
              {/* Unread indicator */}
              <div className="flex-shrink-0 pt-1.5">
                {!n.read ? (
                  <span className="block h-2 w-2 rounded-full bg-primary-500" />
                ) : (
                  <span className="block h-2 w-2" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">
                    {n.actor_name || n.actor_email}
                  </span>{' '}
                  {n.type === 'mention'
                    ? 'mentioned you in'
                    : 'commented on'}{' '}
                  <span className="font-medium">{n.issue_title}</span>
                </p>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  {n.body_preview}
                </p>
              </div>

              {/* Timestamp */}
              <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap pt-0.5">
                {formatTimeAgo(n.created_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
