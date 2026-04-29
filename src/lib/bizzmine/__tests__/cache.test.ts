import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveCache,
  loadCache,
  clearCache,
  CACHE_SCHEMA_VERSION,
  type CachedSync,
} from '../cache';

// idb-keyval uses IndexedDB which jsdom doesn't support natively.
// Mock the underlying module so the unit tests run in jsdom without a polyfill.
vi.mock('idb-keyval', () => {
  const store: Record<string, unknown> = {};
  return {
    get: vi.fn(async (k: string) => store[k]),
    set: vi.fn(async (k: string, v: unknown) => {
      store[k] = v;
    }),
    del: vi.fn(async (k: string) => {
      delete store[k];
    }),
    createStore: vi.fn(() => ({})),
  };
});

const sampleSnap: CachedSync = {
  schemaVersion: CACHE_SCHEMA_VERSION,
  syncedAt: '2026-04-29T10:00:00.000Z',
  collections: {
    capa: [{ 'CAPA ID': '1', Title: 'Test' }],
    nonConformance: [{ Id: '1', 'Non Conformance Title': 'NC1' }],
    changeAction: [],
    changes: [],
    batchRelease: [],
    batchRegistry: [],
    documents: [],
    training: [],
  },
};

describe('cache.saveCache / loadCache', () => {
  beforeEach(async () => {
    await clearCache();
  });

  it('round-trips a snapshot via IndexedDB', async () => {
    await saveCache(sampleSnap);
    const loaded = await loadCache();
    expect(loaded).not.toBeNull();
    expect(loaded?.syncedAt).toBe(sampleSnap.syncedAt);
    expect(loaded?.collections.capa).toHaveLength(1);
    const firstCapa = loaded?.collections.capa[0] as Record<string, unknown>;
    expect(firstCapa['Title']).toBe('Test');
  });

  it('returns null when no snapshot is stored', async () => {
    const loaded = await loadCache();
    expect(loaded).toBeNull();
  });

  it('returns null and clears the cache when stored schemaVersion is older', async () => {
    const old: CachedSync = { ...sampleSnap, schemaVersion: 0 };
    await saveCache(old);
    const loaded = await loadCache();
    expect(loaded).toBeNull();
  });

  it('clearCache removes the stored snapshot', async () => {
    await saveCache(sampleSnap);
    await clearCache();
    const loaded = await loadCache();
    expect(loaded).toBeNull();
  });
});
