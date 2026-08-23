/**
 * lib/stellar/walletSigner.ts
 *
 * Signs an arbitrary message with the connected Stellar wallet, proving the
 * caller controls the wallet's private key. Used by the user-data sync to
 * authenticate API mutations; the server verifies the signature against the
 * wallet's public key with @stellar/stellar-sdk.
 *
 * Supported wallets (the two the connect flow offers):
 * - Freighter: `window.freighter.signMessage(message)` → base64 signature
 * - Albedo:    `window.albedo.sign({ message, pubkey })` → hex signature
 *
 * The returned signature is passed through with its encoding so the server
 * can try both decodings.
 */

export type SignatureEncoding = 'base64' | 'hex';

export interface WalletSignature {
  signature: string;
  encoding: SignatureEncoding;
}

interface FreighterWindow {
  freighter?: {
    signMessage?: (message: string) => Promise<string>;
  };
}

interface AlbedoWindow {
  albedo?: {
    sign?: (params: { message: string; pubkey: string }) => Promise<{ signature: string }>;
  };
}

type WalletGlobals = Window & FreighterWindow & AlbedoWindow;

export async function signWalletMessage(
  walletId: string | null,
  address: string,
  message: string,
): Promise<WalletSignature> {
  if (typeof window === 'undefined') {
    throw new Error('Wallet signing is only available in the browser');
  }

  const globals = window as WalletGlobals;

  if (walletId === 'freighter' && typeof globals.freighter?.signMessage === 'function') {
    const signature = await globals.freighter.signMessage(message);
    if (typeof signature !== 'string' || signature.length === 0) {
      throw new Error('Freighter returned an empty signature');
    }
    return { signature, encoding: 'base64' };
  }

  if (walletId === 'albedo' && typeof globals.albedo?.sign === 'function') {
    const result = await globals.albedo.sign({ message, pubkey: address });
    if (typeof result?.signature !== 'string' || result.signature.length === 0) {
      throw new Error('Albedo returned an empty signature');
    }
    return { signature: result.signature, encoding: 'hex' };
  }

  throw new Error(`No signer available for wallet "${walletId ?? 'none'}"`);
}
