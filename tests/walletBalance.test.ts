/**
 * Tests for the network-aware wallet balance lookup (issue #8).
 *
 * Covers the fetch with mocked responses: native balance, no native asset,
 * 404 (new account), network error, non-404 HTTP error, and mainnet vs
 * testnet URL selection.
 *
 * Run with: npm test
 */
import { test, beforeEach, afterEach, expect } from 'vitest';

import { fetchNativeBalance, parseNativeBalance, ZERO_BALANCE } from '../lib/stellar/balance.ts';
import { resolveHorizonUrl } from '../lib/stellar/config.ts';

const ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const originalFetch = globalThis.fetch;
const originalNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
const originalHorizonUrl = process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;

beforeEach(() => {
  globalThis.fetch = originalFetch;
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalNetwork;
  delete process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalNetwork === undefined) delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  else process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalNetwork;
  if (originalHorizonUrl === undefined) delete process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL;
  else process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = originalHorizonUrl;
});

function mockFetchResponse(status: number, body?: unknown) {
  globalThis.fetch = async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
}

test('native balance is extracted and stored on success', async () => {
  mockFetchResponse(200, {
    balances: [
      { asset_type: 'credit_alphanum4', asset_code: 'USDC', balance: '10.0000000' },
      { asset_type: 'native', balance: '123.4567890' },
    ],
  });

  const result = await fetchNativeBalance(ADDRESS, 'https://horizon-testnet.stellar.org');

  expect(result.error).toBeNull();
  expect(result.balance).toBe('123.4567890');
});

test('account without a native asset reports zero with no error', async () => {
  mockFetchResponse(200, {
    balances: [{ asset_type: 'credit_alphanum4', asset_code: 'USDC', balance: '5.0000000' }],
  });

  const result = await fetchNativeBalance(ADDRESS, 'https://horizon-testnet.stellar.org');

  expect(result.error).toBeNull();
  expect(result.balance).toBe(ZERO_BALANCE);
});

test('404 from Horizon is a valid zero balance, not an error', async () => {
  mockFetchResponse(404);

  const result = await fetchNativeBalance(ADDRESS, 'https://horizon-testnet.stellar.org');

  expect(result.error).toBeNull();
  expect(result.balance).toBe(ZERO_BALANCE);
});

test('network failure surfaces as an error instead of a wrong balance', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };

  const result = await fetchNativeBalance(ADDRESS, 'https://horizon-testnet.stellar.org');

  expect(result.balance).toBeNull();
  expect(result.error).not.toBeNull();
  expect(result.error ?? '').toMatch(/fetch failed/);
});

test('non-404 HTTP error surfaces as an error', async () => {
  mockFetchResponse(500, { detail: 'boom' });

  const result = await fetchNativeBalance(ADDRESS, 'https://horizon-testnet.stellar.org');

  expect(result.balance).toBeNull();
  expect(result.error ?? '').toMatch(/HTTP 500/);
});

test('trailing slashes on the Horizon URL are tolerated', async () => {
  let calledUrl = '';
  globalThis.fetch = async (input: RequestInfo | URL) => {
    calledUrl = String(input);
    return new Response(JSON.stringify({ balances: [{ asset_type: 'native', balance: '1.0000000' }] }), {
      status: 200,
    });
  };

  await fetchNativeBalance(ADDRESS, 'https://horizon-testnet.stellar.org/');

  expect(calledUrl).toBe(`https://horizon-testnet.stellar.org/accounts/${ADDRESS}`);
});

test('testnet configuration resolves the testnet Horizon URL', () => {
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
  expect(resolveHorizonUrl()).toBe('https://horizon-testnet.stellar.org');
});

test('mainnet configuration resolves the mainnet Horizon URL', () => {
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'mainnet';
  expect(resolveHorizonUrl()).toBe('https://horizon.stellar.org');
});

test('explicit NEXT_PUBLIC_STELLAR_HORIZON_URL overrides the network mapping', () => {
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'testnet';
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = 'https://custom-horizon.example.org/';
  expect(resolveHorizonUrl()).toBe('https://custom-horizon.example.org');
});

test('mainnet configuration fetches from the mainnet Horizon URL', async () => {
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'mainnet';
  let calledUrl = '';
  globalThis.fetch = async (input: RequestInfo | URL) => {
    calledUrl = String(input);
    return new Response(JSON.stringify({ balances: [{ asset_type: 'native', balance: '42.0000000' }] }), {
      status: 200,
    });
  };

  const result = await fetchNativeBalance(ADDRESS, resolveHorizonUrl());

  expect(calledUrl).toBe(`https://horizon.stellar.org/accounts/${ADDRESS}`);
  expect(result.balance).toBe('42.0000000');
});

test('parseNativeBalance falls back to zero for an empty balances list', () => {
  expect(parseNativeBalance({ balances: [] })).toBe(ZERO_BALANCE);
  expect(parseNativeBalance({})).toBe(ZERO_BALANCE);
});
