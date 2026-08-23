/**
 * lib/server/draftStore.ts
 *
 * Shared, durable, per-user draft store for the drafts API.
 *
 * Previously `app/api/drafts/route.ts` and `app/api/drafts/[id]/route.ts`
 * each declared their own module-level `Map<string, any[]>`. Next.js compiles
 * route handlers as separate modules, so POST wrote to one Map while GET and
 * DELETE read an always-empty second Map — every read 404'd and deletes never
 * landed server-side. All draft routes now read and write through this single
 * module.
 *
 * Durability: the store is backed by `data/drafts-store.json` (gitignored),
 * loaded lazily into an in-process cache and persisted atomically (temp file
 * + rename) on every mutation, so drafts survive a server restart. Mutations
 * are serialized through an in-process promise chain so concurrent handlers
 * cannot interleave read-modify-write cycles on the file. Cross-process /
 * multi-instance consistency is out of scope, matching the rest of the app's
 * serverless storage story.
 *
 * Identity: drafts are keyed by the *verified* user id from
 * `lib/auth/verifyToken.ts` — never by an unsigned JWT decode, which is
 * attacker-controlled.
 */

import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';

export interface ProjectDraft {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentStep: number;
  formData: Record<string, unknown>;
}

export interface DraftPayload {
  id: string;
  title: string;
  currentStep: number;
  formData: Record<string, unknown>;
}

/** Maximum drafts kept per user; the oldest (by updatedAt) is evicted. */
export const MAX_DRAFTS_PER_USER = 5;

/**
 * Maximum serialized size of a single draft. `formData` can carry image data
 * URLs, so the store refuses to persist arbitrarily large payloads.
 */
export const MAX_DRAFT_SIZE_BYTES = 256 * 1024; // 256 KB

const dataDirectory = path.join(process.cwd(), 'data');
const filePath = path.join(dataDirectory, 'drafts-store.json');
const tmpFilePath = `${filePath}.tmp`;

type DraftsStore = Record<string, ProjectDraft[]>; // userId -> drafts

let cache: DraftsStore | null = null;

// Serializes mutations so concurrent requests cannot interleave
// read-modify-write cycles on the file.
let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function loadStore(): Promise<DraftsStore> {
  if (cache) return cache;

  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    cache =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as DraftsStore)
        : {};
  } catch (error) {
    // Missing file is the first run — start empty. A corrupt file logs and
    // resets rather than failing every drafts request; drafts are low-value
    // state and the client keeps its own localStorage copy.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[draftStore] could not read drafts store, starting empty:', error);
    }
    cache = {};
  }

  return cache;
}

async function persist(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const payload = JSON.stringify(cache ?? {});
  await writeFile(tmpFilePath, payload, 'utf8');
  await rename(tmpFilePath, filePath);
}

/**
 * Validates an incoming draft payload. Returns an error message when the
 * payload does not match the draft schema, or null when it is acceptable.
 */
export function validateDraftPayload(
  payload: unknown,
): payload is DraftPayload {
  if (typeof payload !== 'object' || payload === null) return false;

  const draft = payload as Record<string, unknown>;
  return (
    typeof draft.id === 'string' &&
    draft.id.length > 0 &&
    typeof draft.title === 'string' &&
    typeof draft.currentStep === 'number' &&
    typeof draft.formData === 'object' &&
    draft.formData !== null &&
    !Array.isArray(draft.formData)
  );
}

export function draftSerializedSizeBytes(draft: DraftPayload): number {
  return Buffer.byteLength(JSON.stringify(draft), 'utf8');
}

/** Lists the user's drafts, newest first (by updatedAt). */
export async function listDrafts(userId: string): Promise<ProjectDraft[]> {
  return withLock(async () => {
    const store = await loadStore();
    const drafts = store[userId] ?? [];
    return [...drafts].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  });
}

export async function getDraft(
  userId: string,
  id: string,
): Promise<ProjectDraft | null> {
  return withLock(async () => {
    const store = await loadStore();
    return store[userId]?.find((d) => d.id === id) ?? null;
  });
}

/** Creates or updates a draft, evicting the oldest when at the per-user cap. */
export async function saveDraft(
  userId: string,
  payload: DraftPayload,
): Promise<ProjectDraft> {
  return withLock(async () => {
    const store = await loadStore();
    const drafts = store[userId] ?? [];
    const now = new Date().toISOString();

    const existingIndex = drafts.findIndex((d) => d.id === payload.id);
    let saved: ProjectDraft;

    if (existingIndex >= 0) {
      saved = {
        ...drafts[existingIndex],
        title: payload.title,
        formData: payload.formData,
        currentStep: payload.currentStep,
        updatedAt: now,
      };
      drafts[existingIndex] = saved;
    } else {
      // Enforce the per-user cap: evict the oldest draft.
      if (drafts.length >= MAX_DRAFTS_PER_USER) {
        drafts.sort(
          (a, b) =>
            new Date(a.updatedAt).getTime() -
            new Date(b.updatedAt).getTime(),
        );
        drafts.shift();
      }

      saved = {
        id: payload.id,
        title: payload.title,
        formData: payload.formData,
        currentStep: payload.currentStep,
        createdAt: now,
        updatedAt: now,
      };
      drafts.push(saved);
    }

    store[userId] = drafts;
    await persist();
    return saved;
  });
}

/** Deletes a draft. Returns false when the draft did not exist. */
export async function deleteDraft(
  userId: string,
  id: string,
): Promise<boolean> {
  return withLock(async () => {
    const store = await loadStore();
    const drafts = store[userId] ?? [];
    const filtered = drafts.filter((d) => d.id !== id);

    if (filtered.length === drafts.length) return false;

    store[userId] = filtered;
    await persist();
    return true;
  });
}
