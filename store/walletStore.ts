import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { WalletStore } from '@/types';
import { fetchNativeBalance } from '@/lib/stellar/balance';
import { resolveHorizonUrl } from '@/lib/stellar/config';

/** How often the connected wallet's balance is re-fetched. */
const REFRESH_INTERVAL_MS = 15_000;

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function stopBalanceRefresh(): void {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Fetches the native balance from the configured network's Horizon server and
 * writes it into the store. Lookup failures set `balanceError` instead of a
 * silently wrong balance; a 404 (account not on the ledger) is a valid zero.
 */
async function refreshBalance(
  address: string,
  set: (partial: Partial<WalletStore>) => void,
): Promise<void> {
  const result = await fetchNativeBalance(address, resolveHorizonUrl());
  if (result.error) {
    set({ balanceError: result.error });
  } else {
    set({ balance: result.balance, balanceError: null });
  }
}

export const useWalletStore = create<WalletStore>()(
  devtools(
    (set) => ({
      // Initial State
      connectedWallet: null,
      address: null,
      balance: null,
      balanceError: null,
      isConnecting: false,
      error: null,

      // Actions
      connect: (wallet, address) => {
        stopBalanceRefresh();
        set({
          connectedWallet: wallet,
          address: address,
          isConnecting: false,
          error: null,
          balanceError: null,
        });
        // Fetch immediately on connect, then keep the balance fresh without
        // requiring user action.
        void refreshBalance(address, set);
        refreshTimer = setInterval(() => {
          void refreshBalance(address, set);
        }, REFRESH_INTERVAL_MS);
      },

      disconnect: () => {
        stopBalanceRefresh();
        set({
          connectedWallet: null,
          address: null,
          balance: null,
          balanceError: null,
          isConnecting: false,
          error: null,
        });
      },

      setBalance: (balance) => set({ balance }),

      refreshBalance: async () => {
        const { address } = useWalletStore.getState();
        if (address) {
          await refreshBalance(address, set);
        }
      },

      setConnecting: (connecting) => set({ isConnecting: connecting }),

      setError: (error) => set({ error }),
    }),
    {
      name: 'WalletStore',
    }
  )
);
