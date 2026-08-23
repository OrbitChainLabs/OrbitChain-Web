/**
 * Unit tests for lib/cache/cacheManager.ts (TTL cache with eviction).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { CacheManager } from '../lib/cache/cacheManager';

function createCache(maxEntries = 10) {
  return new CacheManager({
    maxEntries,
    version: 'v1',
    ttlByNamespace: { default: 60_000, short: 1_000 },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CacheManager', () => {
  it('returns null on a miss and records it', () => {
    const cache = createCache();
    expect(cache.get('users', 'u1')).toBeNull();
    expect(cache.getMetrics().misses).toBe(1);
  });

  it('returns the stored value on a hit', () => {
    const cache = createCache();
    cache.set('users', 'u1', { id: 1 });
    expect(cache.get('users', 'u1')).toEqual({ id: 1 });
    expect(cache.getMetrics().hits).toBe(1);
  });

  it('separates namespaces and keys', () => {
    const cache = createCache();
    cache.set('users', 'u1', 'user-1');
    expect(cache.get('users', 'u2')).toBeNull();
    expect(cache.get('posts', 'u1')).toBeNull();
  });

  it('expires entries after the namespace TTL', () => {
    const cache = createCache();
    cache.set('short', 'k', 'v');
    expect(cache.get('short', 'k')).toBe('v');

    vi.advanceTimersByTime(1_001);
    expect(cache.get('short', 'k')).toBeNull();
    expect(cache.getMetrics().invalidations).toBe(1);
  });

  it('evicts the least recently used entry past maxEntries', () => {
    const cache = createCache(2);
    cache.set('n', 'a', 1);
    vi.advanceTimersByTime(10);
    cache.set('n', 'b', 2);
    vi.advanceTimersByTime(10);
    cache.set('n', 'c', 3); // evicts 'a' (oldest touched)

    expect(cache.get('n', 'a')).toBeNull();
    expect(cache.get('n', 'b')).toBe(2);
    expect(cache.get('n', 'c')).toBe(3);
    expect(cache.getMetrics().evictions).toBe(1);
  });

  it('invalidates a single key', () => {
    const cache = createCache();
    cache.set('n', 'a', 1);
    cache.set('n', 'b', 2);
    cache.invalidate('n', 'a');

    expect(cache.get('n', 'a')).toBeNull();
    expect(cache.get('n', 'b')).toBe(2);
    expect(cache.getMetrics().invalidations).toBe(1);
  });

  it('invalidates an entire namespace', () => {
    const cache = createCache();
    cache.set('users', 'a', 1);
    cache.set('users', 'b', 2);
    cache.set('posts', 'a', 3);
    cache.invalidateNamespace('users');

    expect(cache.get('users', 'a')).toBeNull();
    expect(cache.get('users', 'b')).toBeNull();
    expect(cache.get('posts', 'a')).toBe(3);
  });

  it('getOrSet loads and caches on a miss, then serves the cache', async () => {
    const cache = createCache();
    let loads = 0;
    const loader = vi.fn(async () => {
      loads += 1;
      return 'loaded';
    });

    await expect(cache.getOrSet('n', 'k', loader)).resolves.toBe('loaded');
    await expect(cache.getOrSet('n', 'k', loader)).resolves.toBe('loaded');

    expect(loads).toBe(1);
  });

  it('getOrSet refreshes the value after expiry', async () => {
    const cache = createCache();
    let loads = 0;
    const loader = async () => {
      loads += 1;
      return `load-${loads}`;
    };

    await cache.getOrSet('short', 'k', loader);
    vi.advanceTimersByTime(1_001);
    await expect(cache.getOrSet('short', 'k', loader)).resolves.toBe('load-2');
  });

  it('reports a snapshot of metrics', () => {
    const cache = createCache();
    cache.set('n', 'k', 1);
    cache.get('n', 'k');
    cache.get('n', 'missing');

    const metrics = cache.getMetrics();
    expect(metrics).toEqual({ hits: 1, misses: 1, evictions: 0, invalidations: 0 });

    // Mutating the returned snapshot must not affect the cache.
    metrics.hits = 99;
    expect(cache.getMetrics().hits).toBe(1);
  });
});
