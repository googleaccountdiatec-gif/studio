"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { MetricSnapshot } from '@/lib/types';

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
    // Restore lastSyncedAt from localStorage
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(LAST_SYNCED_LS_KEY);
      if (stored) {
        const d = new Date(stored);
        if (!isNaN(d.getTime())) {
          setLastSyncedAt(d);
          setHasEverSynced(true);
        }
      }
    }
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

      // Dispatch each collection's records into the appropriate setter
      for (const c of data.collections) {
        if (!c.ok || !c.records) continue;
        const setterKey = COLLECTION_TO_SETTER_KEY[c.code];
        switch (setterKey) {
          case 'capa': setCapaData(c.records); break;
          case 'nc': setNonConformanceData(c.records); break;
          case 'changeActions': setChangeActionData(c.records); break;
          case 'changes': setChangeKpiData(c.records); break;
          case 'batchRelease': setBatchReleaseData(c.records); break;
          case 'documents': setDocumentKpiData(c.records); break;
          case 'training':
          case 'introTraining':
            // Phase 3 will merge A004 + A007. For Phase 2, A004 wins.
            if (setterKey === 'training') setTrainingData(c.records);
            break;
          // batchRegistry has no existing setter — Phase 3 introduces a new state slot
          default: break;
        }
      }

      const synced = new Date(data.syncedAt);
      setLastSyncedAt(synced);
      setHasEverSynced(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_SYNCED_LS_KEY, synced.toISOString());
      }
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
