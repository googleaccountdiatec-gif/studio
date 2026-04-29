import { NextResponse } from 'next/server';
import { BizzmineClient } from '@/lib/bizzmine/client';
import { COLLECTION_CODES, type CollectionKey } from '@/lib/bizzmine/config';
import { normalizeCapaInstances } from '@/lib/bizzmine/normalize/capa';
import {
  harvestUsersFromRecords,
  loadPersistedUsers,
  mergeUserMaps,
  persistUsers,
} from '@/lib/bizzmine/users';
import type { RawInstance } from '@/lib/bizzmine/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

interface SyncResultPerCollection {
  code: string;
  count: number;
  normalized: boolean;
  ok: boolean;
  error?: string;
  records?: unknown[];
}

interface FetchResult {
  key: CollectionKey;
  code: string;
  raw: RawInstance[] | null;
  error?: string;
}

const CONCURRENCY = 3;

async function fetchOne(key: CollectionKey): Promise<FetchResult> {
  const code = COLLECTION_CODES[key];
  try {
    const raw = await BizzmineClient.get<RawInstance[]>(
      `/collection/${code}/instances`,
    );
    return { key, code, raw };
  } catch (e) {
    return {
      key,
      code,
      raw: null,
      error: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
    };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    results[i] = await worker(items[i]);
    return next();
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next()),
  );
  return results;
}

export async function POST() {
  const startedAt = new Date().toISOString();
  const keys = Object.keys(COLLECTION_CODES) as CollectionKey[];

  // 1. Fetch every collection in parallel (capped concurrency)
  const fetched = await runWithConcurrency(keys, fetchOne, CONCURRENCY);

  // 2. Build harvest source from RAW records (before normalization strips OrgChart)
  const harvestSource: Record<string, RawInstance[]> = {};
  for (const f of fetched) {
    if (f.raw) harvestSource[f.code] = f.raw;
  }

  // 3. Harvest + persist user map (best-effort; failures don't break sync)
  let userCount = 0;
  try {
    const previous = await loadPersistedUsers();
    const fresh = harvestUsersFromRecords(harvestSource);
    const merged = mergeUserMaps(previous, fresh);
    await persistUsers(merged);
    userCount = Object.keys(merged).length;
  } catch (e) {
    console.error('User harvest/persist failed:', e);
  }

  // 4. Normalize per-collection (only CAPA in Phase 2)
  const perCollection: SyncResultPerCollection[] = fetched.map((f) => {
    if (!f.raw) {
      return {
        code: f.code,
        count: 0,
        normalized: false,
        ok: false,
        error: f.error,
      };
    }
    if (f.key === 'capa') {
      return {
        code: f.code,
        count: f.raw.length,
        normalized: true,
        ok: true,
        records: normalizeCapaInstances(f.raw),
      };
    }
    return {
      code: f.code,
      count: f.raw.length,
      normalized: false,
      ok: true,
      records: f.raw,
    };
  });

  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    startedAt,
    collections: perCollection,
    userCount,
  });
}
