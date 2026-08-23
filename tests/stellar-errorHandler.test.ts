/**
 * Unit tests for lib/stellar/errorHandler.ts (Stellar/Web3 error mapping).
 */
import { describe, it, expect } from 'vitest';

import { parseStellarError, isUserRejection } from '../lib/stellar/errorHandler';

describe('parseStellarError', () => {
  it('maps null/undefined to an unknown error', () => {
    const parsed = parseStellarError(null);
    expect(parsed.code).toBe('UNKNOWN_ERROR');
    expect(parsed.retryable).toBe(true);
  });

  it('maps JSON-RPC numeric code 4001 to a user rejection', () => {
    const parsed = parseStellarError({ code: 4001 });
    expect(parsed.code).toBe('USER_REJECTED');
    expect(parsed.retryable).toBe(true);
  });

  it('maps Horizon operation result codes to friendly errors', () => {
    const parsed = parseStellarError({
      response: {
        data: {
          extras: {
            result_codes: { operations: ['op_underfunded'] },
          },
        },
      },
    });
    expect(parsed.code).toBe('INSUFFICIENT_FUNDS');
    expect(parsed.retryable).toBe(false);
  });

  it('maps Horizon transaction result codes', () => {
    const parsed = parseStellarError({
      response: {
        data: {
          extras: {
            result_codes: { transaction: 'tx_bad_seq' },
          },
        },
      },
    });
    expect(parsed.code).toBe('BAD_SEQUENCE');
    expect(parsed.retryable).toBe(true);
  });

  it('maps string error codes', () => {
    const parsed = parseStellarError({ code: 'NETWORK_ERROR' });
    expect(parsed.code).toBe('NETWORK_ERROR');
    expect(parsed.retryable).toBe(true);
  });

  it('matches known substrings in the message', () => {
    const parsed = parseStellarError(new Error('User declined access'));
    expect(parsed.code).toBe('USER_REJECTED');
  });

  it('falls back to TRANSACTION_FAILED with the original message', () => {
    const parsed = parseStellarError(new Error('Something specific went wrong'));
    expect(parsed.code).toBe('TRANSACTION_FAILED');
    expect(parsed.message).toBe('Something specific went wrong');
    expect(parsed.retryable).toBe(false);
  });

  it('falls back to UNKNOWN_ERROR for non-objects', () => {
    expect(parseStellarError('just a string').code).toBe('UNKNOWN_ERROR');
  });
});

describe('isUserRejection', () => {
  it('detects user rejections', () => {
    expect(isUserRejection({ code: 4001 })).toBe(true);
    expect(isUserRejection(new Error('Transaction was rejected'))).toBe(true);
  });

  it('does not flag unrelated errors', () => {
    expect(isUserRejection({ code: 'op_underfunded' })).toBe(false);
  });
});
