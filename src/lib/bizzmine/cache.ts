import { get, set, del } from 'idb-keyval';

/**
 * Bump this when any normalizer's output shape changes in a way that
 * would break older cached data. The cache loader treats older versions
 * as a miss and clears them so the next sync writes the new shape.
 */
export const CACHE_SCHEMA_VERSION = 1;

const CACHE_KEY = 'bizzmine.cachedSync';

export interface CachedSync {
  schemaVersion: number;
  /** ISO timestamp from the sync that produced this snapshot. */
  syncedAt: string;
  collections: {
    capa: unknown[];
    nonConformance: unknown[];
    changeAction: unknown[];
    changes: unknown[];
    batchRelease: unknown[];
    batchRegistry: unknown[];
    documents: unknown[];
    training: unknown[];
  };
}

/**
 * Save a sync snapshot to IndexedDB. Best-effort — quota / private-mode
 * failures are logged but never thrown to the caller.
 */
export async function saveCache(snap: CachedSync): Promise<void> {
  try {
    await set(CACHE_KEY, snap);
  } catch (e) {
    console.warn('Failed to save BizzMine cache to IndexedDB:', e);
  }
}

/**
 * Load the last sync snapshot from IndexedDB. Returns null when no cache
 * is present, when IndexedDB isn't available, or when the cached snapshot
 * uses an older schemaVersion (in which case it's also wiped).
 */
export async function loadCache(): Promise<CachedSync | null> {
  try {
    const stored = (await get(CACHE_KEY)) as CachedSync | undefined;
    if (!stored) return null;
    if (stored.schemaVersion !== CACHE_SCHEMA_VERSION) {
      await del(CACHE_KEY);
      return null;
    }
    return stored;
  } catch (e) {
    console.warn('Failed to load BizzMine cache from IndexedDB:', e);
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    await del(CACHE_KEY);
  } catch (e) {
    console.warn('Failed to clear BizzMine cache:', e);
  }
}
