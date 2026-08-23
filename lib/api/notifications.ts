/**
 * lib/api/notifications.ts
 *
 * Typed client for the OrbitChain-API notification endpoints. The API
 * contract was read from OrbitChain-API's notifications controller/service:
 *
 *   GET   /notifications            -> { data: NotificationDto[], total }
 *   PATCH /notifications/mark-read            (mark all as read)
 *   PATCH /notifications/:id/mark-read        (mark one as read)
 *
 * All three are JWT-guarded; the shared axios client attaches the bearer
 * token and handles 401/refresh, so the store can rely on the existing
 * session flow. The API's NotificationType enum is mapped onto the web app's
 * AppNotification type vocabulary.
 */

import { apiClient } from './interceptors';
import type { AppNotification } from '@/types';
import type { NotificationDto, NotificationListResponse } from '@/types/api';

const TYPE_MAP: Record<string, AppNotification['type']> = {
  DONATION_RECEIVED: 'donation',
  CAMPAIGN_CREATED: 'campaign_update',
  CAMPAIGN_UPDATED: 'campaign_update',
  CAMPAIGN_COMPLETED: 'campaign_update',
  MILESTONE_REACHED: 'campaign_update',
  DISPUTE_FILED: 'system',
  DISPUTE_RESOLVED: 'system',
};

function toAppNotification(dto: NotificationDto): AppNotification {
  return {
    id: dto.id,
    type: TYPE_MAP[dto.type] ?? 'system',
    title: dto.title,
    message: dto.message,
    read: dto.isRead,
    createdAt: dto.createdAt,
    metadata: dto.relatedId ? { relatedId: dto.relatedId } : undefined,
  };
}

export const notificationsApi = {
  /** Fetches the signed-in user's notifications (up to 50, newest first). */
  async fetchNotifications(): Promise<AppNotification[]> {
    const response = await apiClient.get<NotificationListResponse>('/notifications');
    return response.data.data.map(toAppNotification);
  },

  /** Marks a single notification as read on the server. */
  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/mark-read`);
  },

  /** Marks every notification as read on the server. */
  async markAllAsRead(): Promise<void> {
    await apiClient.patch('/notifications/mark-read');
  },
};
