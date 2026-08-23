/**
 * Unit tests for store/uiStore.ts (modals, notifications, theme, loading).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useUIStore } from '../store/uiStore';

const initial = {
  activeModal: null,
  notifications: [],
  isSidebarOpen: false,
  theme: 'light',
  isGlobalLoading: false,
} as const;

beforeEach(() => {
  useUIStore.setState({
    activeModal: null,
    notifications: [],
    isSidebarOpen: false,
    theme: 'light',
    isGlobalLoading: false,
  });
});

describe('uiStore', () => {
  it('starts in the default UI state', () => {
    expect(useUIStore.getState()).toMatchObject(initial);
  });

  it('opens and closes a modal', () => {
    useUIStore.getState().openModal('wallet');
    expect(useUIStore.getState().activeModal).toBe('wallet');

    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it('adds notifications with generated ids', () => {
    useUIStore.getState().addNotification({ type: 'success', message: 'Saved!' });
    useUIStore.getState().addNotification({ type: 'error', message: 'Failed!' });

    const notifications = useUIStore.getState().notifications;
    expect(notifications).toHaveLength(2);
    expect(notifications[0]!.message).toBe('Saved!');
    expect(notifications[0]!.id).toBeTruthy();
    expect(notifications[1]!.id).not.toBe(notifications[0]!.id);
  });

  it('removes a notification by id and ignores unknown ids', () => {
    useUIStore.getState().addNotification({ type: 'success', message: 'A' });
    const [first] = useUIStore.getState().notifications;
    useUIStore.getState().addNotification({ type: 'success', message: 'B' });

    useUIStore.getState().removeNotification(first!.id);
    expect(useUIStore.getState().notifications).toHaveLength(1);
    expect(useUIStore.getState().notifications[0]!.message).toBe('B');

    useUIStore.getState().removeNotification('does-not-exist');
    expect(useUIStore.getState().notifications).toHaveLength(1);
  });

  it('toggles the sidebar', () => {
    expect(useUIStore.getState().isSidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(false);
  });

  it('sets the theme', () => {
    useUIStore.getState().setTheme('dark');
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('sets the global loading flag', () => {
    useUIStore.getState().setGlobalLoading(true);
    expect(useUIStore.getState().isGlobalLoading).toBe(true);
  });
});
