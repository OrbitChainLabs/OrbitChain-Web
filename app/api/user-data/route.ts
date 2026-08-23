import { NextRequest, NextResponse } from 'next/server';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { deleteUserData, getUserData, saveUserData } from '@/lib/server/userDataStore';
import type { UserDataSnapshot } from '@/types/userData';

/**
 * Challenge format and freshness window. The challenge embeds a unix
 * timestamp; signatures older than the window are rejected so a captured
 * request cannot be replayed to mutate a wallet's snapshot later.
 */
const CHALLENGE_PREFIX = 'orbitchain:user-data:';
const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verifies that the request proves control of the claimed wallet: the
 * `x-wallet-signature` header must be a valid Ed25519 signature (base64 or
 * hex) by the wallet's public key over the `x-wallet-challenge` string, and
 * the challenge must be fresh. Returns the verified wallet address, or null.
 *
 * The `x-wallet-address` header alone is never sufficient.
 */
function verifyWalletSignature(request: NextRequest): { walletAddress: string } | null {
  const walletAddress = request.headers.get('x-wallet-address')?.trim();
  const signature = request.headers.get('x-wallet-signature')?.trim();
  const challenge = request.headers.get('x-wallet-challenge')?.trim();

  if (!walletAddress || !signature || !challenge) {
    return null;
  }

  if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
    return null;
  }

  if (!challenge.startsWith(CHALLENGE_PREFIX)) {
    return null;
  }

  const timestamp = Number(challenge.slice(CHALLENGE_PREFIX.length));
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  if (Math.abs(Date.now() - timestamp * 1000) > CHALLENGE_MAX_AGE_MS) {
    return null;
  }

  const messageBytes = Buffer.from(challenge, 'utf8');
  const keypair = Keypair.fromPublicKey(walletAddress);

  // Accept both base64 (Freighter) and hex (Albedo) signature encodings.
  const candidateSignatures = [
    Buffer.from(signature, 'base64'),
    Buffer.from(signature, 'hex'),
  ];

  const valid = candidateSignatures.some((signatureBytes) =>
    keypair.verify(messageBytes, signatureBytes)
  );

  if (!valid) {
    return null;
  }

  return { walletAddress };
}

export async function GET(request: NextRequest) {
  const identity = verifyWalletSignature(request);

  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshot = await getUserData(identity.walletAddress);
  return NextResponse.json({ data: snapshot, status: 200 });
}

export async function PUT(request: NextRequest) {
  const identity = verifyWalletSignature(request);

  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const walletAddress = identity.walletAddress;
  const body = (await request.json()) as Omit<UserDataSnapshot, 'walletAddress' | 'updatedAt'>;
  const snapshot: UserDataSnapshot = {
    walletAddress,
    bookmarks: body.bookmarks ?? [],
    drafts: body.drafts ?? [],
    preferences: body.preferences ?? {
      theme: 'system',
      analyticsConsent: null,
    },
    updatedAt: new Date().toISOString(),
  };

  const saved = await saveUserData(snapshot);
  return NextResponse.json({ data: saved, status: 200 });
}

export async function DELETE(request: NextRequest) {
  const identity = verifyWalletSignature(request);

  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await deleteUserData(identity.walletAddress);
  return NextResponse.json({ data: { deleted: true }, status: 200 });
}
