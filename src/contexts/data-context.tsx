"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { MetricSnapshot } from '@/lib/types';

interface CapaData { [key: string]: any; }
interface ChangeActionData { [key: string]: any; }
interface NonConformanceData { [key: string]: any; }
interface TrainingData { [key: string]: any; }
interface BatchReleaseData { [key: string]: any; }
interface DocumentKpiData { [key: string]: any; }

interface DataContextType {
  capaData: CapaData[];
  changeActionData: ChangeActionData[];
  nonConformanceData: NonConformanceData[];
  trainingData: TrainingData[];
  batchReleaseData: BatchReleaseData[];
  documentKpiData: DocumentKpiData[];
  snapshots: MetricSnapshot[];
  setCapaData: React.Dispatch<React.SetStateAction<CapaData[]>>;
  setChangeActionData: React.Dispatch<React.SetStateAction<ChangeActionData[]>>;
  setNonConformanceData: React.Dispatch<React.SetStateAction<NonConformanceData[]>>;
  setTrainingData: React.Dispatch<React.SetStateAction<TrainingData[]>>;
  setBatchReleaseData: React.Dispatch<React.SetStateAction<BatchReleaseData[]>>;
  setDocumentKpiData: React.Dispatch<React.SetStateAction<DocumentKpiData[]>>;
  saveSnapshot: (metrics: MetricSnapshot['metrics']) => Promise<void>;
  refreshSnapshots: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [capaData, setCapaData] = useState<CapaData[]>([]);
  const [changeActionData, setChangeActionData] = useState<ChangeActionData[]>([]);
  const [nonConformanceData, setNonConformanceData] = useState<NonConformanceData[]>([]);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [batchReleaseData, setBatchReleaseData] = useState<BatchReleaseData[]>([]);
  const [documentKpiData, setDocumentKpiData] = useState<DocumentKpiData[]>([]);
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);

  const fetchSnapshots = async () => {
    try {
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
  }, []);

  const saveSnapshot = async (metrics: MetricSnapshot['metrics']) => {
    const timeoutMs = 15000;
    try {
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

  return (
    <DataContext.Provider value={{
      capaData,
      changeActionData,
      nonConformanceData,
      trainingData,
      batchReleaseData,
      documentKpiData,
      snapshots,
      setCapaData,
      setChangeActionData,
      setNonConformanceData,
      setTrainingData,
      setBatchReleaseData,
      setDocumentKpiData,
      saveSnapshot,
      refreshSnapshots: fetchSnapshots
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
