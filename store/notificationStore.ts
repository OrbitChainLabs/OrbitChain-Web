import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { NotificationStore, AppNotification } from '@/types';
import { notificationsApi } from '@/lib/api/notifications';

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set, get) => ({
      // Initial State
      notifications: [],
      unreadCount: 0,
      isLoading: false,

      // Actions
      fetchNotifications: async () => {
        set({ isLoading: true });
        try {
          // Real API-backed source: unreadCount is derived from server state.
          const notifications = await notificationsApi.fetchNotifications();
          const unreadCount = notifications.filter(n => !n.read).length;
          set({ notifications, unreadCount, isLoading: false });
        } catch (error) {
          // Keep the previous list on failure; never crash the header.
          console.error('Failed to fetch notifications:', error);
          set({ isLoading: false });
        }
      },

      markAsRead: async (id: string) => {
        try {
          await notificationsApi.markAsRead(id);
          const { notifications } = get();
          const updatedNotifications = notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          );
          const unreadCount = updatedNotifications.filter(n => !n.read).length;
          set({ notifications: updatedNotifications, unreadCount });
        } catch (error) {
          console.error('Failed to mark notification as read:', error);
        }
      },

      markAllAsRead: async () => {
        try {
          await notificationsApi.markAllAsRead();
          const { notifications } = get();
          const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
          set({ notifications: updatedNotifications, unreadCount: 0 });
        } catch (error) {
          console.error('Failed to mark all notifications as read:', error);
        }
      },

      addNotification: (notification) => {
        const newNotification: AppNotification = {
          ...notification,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        };

        const { notifications, unreadCount } = get();
        const updatedNotifications = [newNotification, ...notifications];
        const newUnreadCount = notification.read ? unreadCount : unreadCount + 1;

        set({
          notifications: updatedNotifications,
          unreadCount: newUnreadCount
        });
      },

      setNotifications: (notifications: AppNotification[]) => {
        const unreadCount = notifications.filter(n => !n.read).length;
        set({ notifications, unreadCount });
      },

      setLoading: (loading: boolean) => set({ isLoading: loading })
    }),
    {
      name: 'NotificationStore'
    }
  )
);
