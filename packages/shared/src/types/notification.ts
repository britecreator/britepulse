/**
 * Notification types for in-app notification feed
 */

export type NotificationType = 'mention' | 'comment_on_thread';

export interface Notification {
  notification_id: string;
  recipient_email: string;
  type: NotificationType;
  issue_id: string;
  issue_title: string;
  app_id: string;
  comment_id: string;
  actor_email: string;
  actor_name?: string;
  body_preview: string;
  read: boolean;
  created_at: string;
}
