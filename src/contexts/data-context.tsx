"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { MetricSnapshot } from '@/lib/types';
import { saveCache, loadCache, type CachedSync, CACHE_SCHEMA_VERSION } from '@/lib/bizzmine/cache';

interface CapaData { [key: string]: any; }
interface ChangeActionData { [key: string]: any; }
interface NonConformanceData { [key: string]: any; }
interface TrainingData { [key: string]: any; }
interface BatchReleaseData { [key: string]: any; }
interface DocumentKpiData { [key: string]: any; }
interface ChangeKpiData { [key: string]: any; }

type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncCollectionResult {
  code: string;
  count: number;
  normalized: boolean;
  ok: boolean;
  error?: string;
  records?: any[];
}

interface SyncResponse {
  syncedAt: string;
  startedAt: string;
  collections: SyncCollectionResult[];
  userCount: number;
}

const COLLECTION_TO_SETTER_KEY: Record<string, string> = {
  CAPA: 'capa',
  NC: 'nc',
  Change_Actions: 'changeActions',
  CM: 'changes',
  KPI_batch_release: 'batchRelease',
  BR: 'batchRegistry',
  DC: 'documents',
  A004: 'training',
  A007: 'introTraining',
};

interface DataContextType {
  capaData: CapaData[];
  changeActionData: ChangeActionData[];
  nonConformanceData: NonConformanceData[];
  trainingData: TrainingData[];
  batchReleaseData: BatchReleaseData[];
  documentKpiData: DocumentKpiData[];
  changeKpiData: ChangeKpiData[];
  snapshots: MetricSnapshot[];
  setCapaData: React.Dispatch<React.SetStateAction<CapaData[]>>;
  setChangeActionData: React.Dispatch<React.SetStateAction<ChangeActionData[]>>;
  setNonConformanceData: React.Dispatch<React.SetStateAction<NonConformanceData[]>>;
  setTrainingData: React.Dispatch<React.SetStateAction<TrainingData[]>>;
  setBatchReleaseData: React.Dispatch<React.SetStateAction<BatchReleaseData[]>>;
  setDocumentKpiData: React.Dispatch<React.SetStateAction<DocumentKpiData[]>>;
  setChangeKpiData: React.Dispatch<React.SetStateAction<ChangeKpiData[]>>;
  saveSnapshot: (metrics: MetricSnapshot['metrics']) => Promise<void>;
  refreshSnapshots: () => Promise<void>;
  // Sync from BizzMine
  lastSyncedAt: Date | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  hasEverSynced: boolean;
  sync: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const LAST_SYNCED_LS_KEY = 'bizzmine.lastSyncedAt';

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [capaData, setCapaData] = useState<CapaData[]>([]);
  const [changeActionData, setChangeActionData] = useState<ChangeActionData[]>([]);
  const [nonConformanceData, setNonConformanceData] = useState<NonConformanceData[]>([]);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [batchReleaseData, setBatchReleaseData] = useState<BatchReleaseData[]>([]);
  const [documentKpiData, setDocumentKpiData] = useState<DocumentKpiData[]>([]);
  const [changeKpiData, setChangeKpiData] = useState<ChangeKpiData[]>([]);
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasEverSynced, setHasEverSynced] = useState(false);

  const fetchSnapshots = async () => {
    try {
      const { getDb } = await import('@/lib/firebase');
      const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
      const db = getDb();
      const q = query(collection(db, 'biweekly_snapshots'), orderBy('timestamp', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const fetchedSnapshots: MetricSnapshot[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedSnapshots.push({
          id: doc.id,
          timestamp: data.timestamp,
          metrics: data.metrics,
        });
      });
      setSnapshots(fetchedSnapshots);
    } catch (error) {
      console.error("Error fetching snapshots:", error);
    }
  };

  useEffect(() => {
    fetchSnapshots();
    // Restore lastSyncedAt from localStorage AND hydrate dashboard data
    // from IndexedDB cache so the dashboards render immediately on cold load.
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') return;

      const storedTs = window.localStorage.getItem(LAST_SYNCED_LS_KEY);
      const cached = await loadCache();
      if (cancelled) return;

      if (cached) {
        // Hydrate per-collection state from the cached snapshot
        setCapaData(cached.collections.capa as any[]);
        setNonConformanceData(cached.collections.nonConformance as any[]);
        setChangeActionData(cached.collections.changeAction as any[]);
        setChangeKpiData(cached.collections.changes as any[]);
        setBatchReleaseData(cached.collections.batchRelease as any[]);
        setDocumentKpiData(cached.collections.documents as any[]);
        setTrainingData(cached.collections.training as any[]);
        // batchRegistry has no dedicated state slot yet (Phase 4.2 introduces one)
      }

      // Prefer the cache's syncedAt over the localStorage timestamp — they
      // should match in normal usage, but if they ever diverge the cache is
      // the authoritative source of "what data is currently loaded".
      const tsSource = cached?.syncedAt ?? storedTs;
      if (tsSource) {
        const d = new Date(tsSource);
        if (!isNaN(d.getTime())) {
          setLastSyncedAt(d);
          setHasEverSynced(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveSnapshot = async (metrics: MetricSnapshot['metrics']) => {
    const timeoutMs = 15000;
    try {
      const { getDb } = await import('@/lib/firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const db = getDb();
      const savePromise = addDoc(collection(db, 'biweekly_snapshots'), {
        timestamp: serverTimestamp(),
        metrics
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          `Firestore addDoc timed out after ${timeoutMs / 1000}s. ` +
          `Check that your Firestore database exists and is named "(default)". ` +
          `Project: ${db.app.options.projectId}`
        )), timeoutMs)
      );
      await Promise.race([savePromise, timeoutPromise]);
      await fetchSnapshots();
    } catch (error) {
      console.error("Error saving snapshot:", error);
      throw error;
    }
  };

  const sync = useCallback(async () => {
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const r = await fetch('/api/bizzmine/sync', { method: 'POST' });
      if (!r.ok) {
        throw new Error(`Sync HTTP ${r.status}`);
      }
      const data: SyncResponse = await r.json();

      // Build the cache payload alongside dispatching to React state
      const cachePayload: CachedSync = {
        schemaVersion: CACHE_SCHEMA_VERSION,
        syncedAt: data.syncedAt,
        collections: {
          capa: [],
          nonConformance: [],
          changeAction: [],
          changes: [],
          batchRelease: [],
          batchRegistry: [],
          documents: [],
          training: [],
        },
      };

      for (const c of data.collections) {
        if (!c.ok || !c.records) continue;
        const setterKey = COLLECTION_TO_SETTER_KEY[c.code];
        switch (setterKey) {
          case 'capa':
            setCapaData(c.records);
            cachePayload.collections.capa = c.records;
            break;
          case 'nc':
            setNonConformanceData(c.records);
            cachePayload.collections.nonConformance = c.records;
            break;
          case 'changeActions':
            setChangeActionData(c.records);
            cachePayload.collections.changeAction = c.records;
            break;
          case 'changes':
            setChangeKpiData(c.records);
            cachePayload.collections.changes = c.records;
            break;
          case 'batchRelease':
            setBatchReleaseData(c.records);
            cachePayload.collections.batchRelease = c.records;
            break;
          case 'batchRegistry':
            cachePayload.collections.batchRegistry = c.records;
            break;
          case 'documents':
            setDocumentKpiData(c.records);
            cachePayload.collections.documents = c.records;
            break;
          case 'training':
            // Phase 3 sync route emits the merged A004 + A007 stream under
            // the 'training' (A004) entry; the 'introTraining' entry has empty
            // records[] so it intentionally falls through here.
            setTrainingData(c.records);
            cachePayload.collections.training = c.records;
            break;
          default:
            break;
        }
      }

      const synced = new Date(data.syncedAt);
      setLastSyncedAt(synced);
      setHasEverSynced(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_SYNCED_LS_KEY, synced.toISOString());
      }
      // Best-effort persist; failures don't block the user
      saveCache(cachePayload).catch(() => undefined);
      setSyncStatus('idle');
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : 'Unknown sync error');
    }
  }, []);

  return (
    <DataContext.Provider value={{
      capaData,
      changeActionData,
      nonConformanceData,
      trainingData,
      batchReleaseData,
      documentKpiData,
      changeKpiData,
      snapshots,
      setCapaData,
      setChangeActionData,
      setNonConformanceData,
      setTrainingData,
      setBatchReleaseData,
      setDocumentKpiData,
      setChangeKpiData,
      saveSnapshot,
      refreshSnapshots: fetchSnapshots,
      lastSyncedAt,
      syncStatus,
      syncError,
      hasEverSynced,
      sync,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
