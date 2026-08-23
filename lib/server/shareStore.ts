/**
 * lib/server/shareStore.ts
 *
 * Single shared, durable store for campaign share statistics.
 *
 * Previously `app/api/campaigns/[id]/shares/route.ts` kept its own
 * `shareRecords`/`shareStats` while `stats/route.ts` declared a separate
 * `shareStats` object, so the counter the POST incremented was never the one
 * the stats route read — `totalShares` was always 0. Both routes now read and
 * write through this one module.
 *
 * Durability: backed by `data/share-stats.json` (gitignored), loaded lazily
 * and persisted atomically (temp file + rename) on mutation, so counts
 * survive a server restart. Mutations are serialized through an in-process
 * promise chain; multi-instance consistency is out of scope, matching the
 * rest of the app's serverless storage story.
 *
 * Dedupe: a share is counted at most once per (campaign, wallet, platform)
 * within `SHARE_DEDUPE_WINDOW_MS`, keyed on the caller-supplied wallet
 * address. Verified wallet-binding (signature proofs) is a separate issue; a
 * forged-but-well-formed address can still be minted, which the window bounds.
 */

import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import type { CampaignShareStats, ShareRecord } from '@/types/api';

export type SharePlatform = 'twitter' | 'linkedin' | 'whatsapp' | 'copy';

export const SHARE_PLATFORMS: readonly SharePlatform[] = [
  'twitter',
  'linkedin',
  'whatsapp',
  'copy',
];

/** Repeated shares from the same wallet on the same platform within this
 *  window are not double-counted. */
export const SHARE_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ShareStats {
  twitter: number;
  linkedin: number;
  whatsapp: number;
  copy: number;
}

interface RecentShare {
  id: string;
  createdAt: string;
}

interface ShareStoreData {
  stats: Record<string, ShareStats>; // campaignId -> per-platform counts
  // campaignId -> walletAddress -> platform -> last recorded share
  recent: Record<string, Record<string, Record<string, RecentShare>>>;
}

const dataDirectory = path.join(process.cwd(), 'data');
const filePath = path.join(dataDirectory, 'share-stats.json');
const tmpFilePath = `${filePath}.tmp`;

function emptyStats(): ShareStats {
  return { twitter: 0, linkedin: 0, whatsapp: 0, copy: 0 };
}

let cache: ShareStoreData | null = null;

let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function loadStore(): Promise<ShareStoreData> {
  if (cache) return cache;

  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      cache = parsed as ShareStoreData;
      if (!cache.stats || typeof cache.stats !== 'object') cache.stats = {};
      if (!cache.recent || typeof cache.recent !== 'object') cache.recent = {};
    } else {
      cache = { stats: {}, recent: {} };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[shareStore] could not read share stats, starting empty:', error);
    }
    cache = { stats: {}, recent: {} };
  }

  return cache;
}

async function persist(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const payload = JSON.stringify(cache ?? { stats: {}, recent: {} });
  await writeFile(tmpFilePath, payload, 'utf8');
  await rename(tmpFilePath, filePath);
}

/**
 * Records a share event for a campaign, unless the same wallet already shared
 * the same platform within the dedupe window. Returns the share record and
 * whether it was newly counted.
 */
export async function recordShare(
  campaignId: string,
  walletAddress: string,
  platform: SharePlatform,
): Promise<{ recorded: boolean; record: ShareRecord }> {
  return withLock(async () => {
    const store = await loadStore();
    const now = new Date().toISOString();

    const statsByCampaign = store.stats[campaignId] ?? emptyStats();
    store.stats[campaignId] = statsByCampaign;

    const recentByWallet = store.recent[campaignId] ?? {};
    store.recent[campaignId] = recentByWallet;
    const recentByPlatform = recentByWallet[walletAddress] ?? {};
    recentByWallet[walletAddress] = recentByPlatform;

    const existing = recentByPlatform[platform];
    if (existing) {
      const age = Date.now() - new Date(existing.createdAt).getTime();
      if (age < SHARE_DEDUPE_WINDOW_MS) {
        return {
          recorded: false,
          record: {
            id: existing.id,
            campaignId,
            platform,
            createdAt: existing.createdAt,
          },
        };
      }
    }

    statsByCampaign[platform] += 1;

    const record: ShareRecord = {
      id: `share_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      campaignId,
      platform,
      createdAt: now,
    };
    recentByPlatform[platform] = { id: record.id, createdAt: now };

    await persist();
    return { recorded: true, record };
  });
}

/** Returns the current share statistics for a campaign (zeros when none). */
export async function getShareStats(campaignId: string): Promise<CampaignShareStats> {
  return withLock(async () => {
    const store = await loadStore();
    const stats = store.stats[campaignId] ?? emptyStats();

    return {
      campaignId,
      totalShares: Object.values(stats).reduce((sum, count) => sum + count, 0),
      shares: {
        twitter: stats.twitter ?? 0,
        linkedin: stats.linkedin ?? 0,
        whatsapp: stats.whatsapp ?? 0,
        copy: stats.copy ?? 0,
      },
    };
  });
}
