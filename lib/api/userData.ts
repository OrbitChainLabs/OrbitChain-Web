import type { ProjectDraft } from '@/hooks/useDraftManager';
import type { UserDataSnapshot, UserPreferences } from '@/types/userData';
import { useWalletStore } from '@/store/walletStore';
import { signWalletMessage } from '@/lib/stellar/walletSigner';

interface UserDataPayload {
  bookmarks: string[];
  drafts: ProjectDraft[];
  preferences: UserPreferences;
}

/** Must match CHALLENGE_PREFIX in app/api/user-data/route.ts. */
const CHALLENGE_PREFIX = 'orbitchain:user-data:';

function buildChallenge(): string {
  return `${CHALLENGE_PREFIX}${Math.floor(Date.now() / 1000)}`;
}

/**
 * Signs the challenge with the connected wallet and returns the headers that
 * prove control of `walletAddress`. Throws when no signer is available.
 */
async function buildAuthHeaders(walletAddress: string): Promise<Record<string, string>> {
  const { connectedWallet, address } = useWalletStore.getState();

  if (!connectedWallet || address !== walletAddress) {
    throw new Error('No matching connected wallet for user data sync');
  }

  const challenge = buildChallenge();
  const signed = await signWalletMessage(connectedWallet, walletAddress, challenge);

  return {
    'x-wallet-address': walletAddress,
    'x-wallet-challenge': challenge,
    'x-wallet-signature': signed.signature,
  };
}

async function requestUserData<T>(
  walletAddress: string,
  init?: RequestInit
): Promise<T> {
  const authHeaders = await buildAuthHeaders(walletAddress);

  const response = await fetch('/api/user-data', {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`User data request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export const userDataApi = {
  get: async (walletAddress: string): Promise<UserDataSnapshot | null> => {
    return requestUserData<UserDataSnapshot | null>(walletAddress);
  },
  save: async (walletAddress: string, payload: UserDataPayload): Promise<UserDataSnapshot> => {
    return requestUserData<UserDataSnapshot>(walletAddress, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  remove: async (walletAddress: string): Promise<void> => {
    await requestUserData<{ deleted: true }>(walletAddress, {
      method: 'DELETE',
    });
  },
};
