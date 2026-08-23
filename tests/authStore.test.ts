/**
 * Unit tests for store/authStore.ts (auth state + persistence actions).
 *
 * Runs in the Node environment: the persist middleware's localStorage is
 * unavailable here, so the store operates without rehydration, and the
 * cookie helpers no-op because `window` is undefined.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useAuthStore } from '../store/authStore';

const user = { id: 'u1', email: 'a@example.com', name: 'Alice' };

function resetStore() {
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
}

beforeEach(() => {
  resetStore();
});

describe('authStore', () => {
  it('starts logged out', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('login sets the user, token, and authenticated flag', () => {
    useAuthStore.getState().login(user, 'jwt-token', 'refresh-token');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.token).toBe('jwt-token');
    expect(state.refreshToken).toBe('refresh-token');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('login tolerates a missing refresh token', () => {
    useAuthStore.getState().login(user, 'jwt-token');
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('logout clears auth state', () => {
    useAuthStore.getState().login(user, 'jwt-token');
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setUser updates the user without touching auth flags', () => {
    useAuthStore.getState().setUser(user);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(false);
  });

  it('setLoading toggles the loading flag', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('setTokens authenticates with a new pair', () => {
    useAuthStore.getState().setTokens('new-token', 'new-refresh');
    const state = useAuthStore.getState();
    expect(state.token).toBe('new-token');
    expect(state.refreshToken).toBe('new-refresh');
    expect(state.isAuthenticated).toBe(true);
  });
});
