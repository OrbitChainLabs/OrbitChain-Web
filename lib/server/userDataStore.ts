import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import type { UserDataSnapshot } from '@/types/userData';

type UserDataStore = Record<string, UserDataSnapshot>;

const dataDirectory = path.join(process.cwd(), 'data');
const filePath = path.join(dataDirectory, 'user-data-store.json');
const tmpFilePath = `${filePath}.tmp`;

// Serializes mutations so concurrent PUTs for the same wallet cannot
// interleave read-modify-write cycles and silently drop one snapshot.
let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureStore(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(filePath, 'utf8');
  } catch {
    await writeFile(filePath, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<UserDataStore> {
  await ensureStore();
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as UserDataStore;
}

/** Atomic write: temp file + rename so a crash never leaves a truncated file. */
async function writeStore(store: UserDataStore): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(tmpFilePath, JSON.stringify(store, null, 2), 'utf8');
  await rename(tmpFilePath, filePath);
}

export async function getUserData(walletAddress: string): Promise<UserDataSnapshot | null> {
  return withLock(async () => {
    const store = await readStore();
    return store[walletAddress] ?? null;
  });
}

export async function saveUserData(snapshot: UserDataSnapshot): Promise<UserDataSnapshot> {
  return withLock(async () => {
    const store = await readStore();
    store[snapshot.walletAddress] = snapshot;
    await writeStore(store);
    return snapshot;
  });
}

export async function deleteUserData(walletAddress: string): Promise<void> {
  return withLock(async () => {
    const store = await readStore();
    delete store[walletAddress];
    await writeStore(store);
  });
}
