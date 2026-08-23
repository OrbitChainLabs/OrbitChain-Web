/**
 * lib/stellar/balance.ts
 *
 * Native-balance lookup against a Horizon server. Kept free of app imports so
 * it can be unit-tested directly with Node's built-in test runner and mocked
 * fetch responses.
 *
 * Failure semantics matter here:
 *  - Horizon 404 (account does not exist yet) is a VALID zero balance — a
 *    brand-new account must show 0 without an error.
 *  - Any other HTTP error or network failure is a real lookup failure and is
 *    surfaced as an error instead of a silently wrong balance.
 */

export const ZERO_BALANCE = '0.0000000';

export interface BalanceFetchResult {
  /** Native balance when the lookup succeeded; null when it failed. */
  balance: string | null;
  /** Human-readable error when the lookup failed; null otherwise (404 included). */
  error: string | null;
}

interface HorizonAccountResponse {
  balances?: Array<{ asset_type?: string; balance?: string }>;
}

/** Extracts the native (XLM) balance from a Horizon account response. */
export function parseNativeBalance(data: HorizonAccountResponse): string {
  const native = data.balances?.find((b) => b.asset_type === 'native');
  return native?.balance ?? ZERO_BALANCE;
}

/**
 * Fetches the native balance for `address` from the given Horizon base URL.
 *
 * @param address    Stellar account address (G...).
 * @param horizonUrl Horizon base URL for the configured network (no trailing slash needed).
 */
export async function fetchNativeBalance(
  address: string,
  horizonUrl: string,
): Promise<BalanceFetchResult> {
  const baseUrl = horizonUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/accounts/${encodeURIComponent(address)}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return {
      balance: null,
      error: err instanceof Error ? err.message : 'Failed to reach Horizon',
    };
  }

  if (res.status === 404) {
    // Account not found on the ledger — a new/empty account, not an error.
    return { balance: ZERO_BALANCE, error: null };
  }

  if (!res.ok) {
    return { balance: null, error: `Horizon returned HTTP ${res.status}` };
  }

  try {
    const data = (await res.json()) as HorizonAccountResponse;
    return { balance: parseNativeBalance(data), error: null };
  } catch {
    return { balance: null, error: 'Horizon returned an unparseable response' };
  }
}
