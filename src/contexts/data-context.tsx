"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the structure for your data types
// (You might want to move these to a central types file, e.g., src/lib/types.ts)
interface CapaData { [key: string]: any; }
interface ChangeActionData { [key: string]: any; }
interface NonConformanceData { [key: string]: any; }
interface TrainingData { [key: string]: any; }

interface DataContextType {
  capaData: CapaData[];
  changeActionData: ChangeActionData[];
  nonConformanceData: NonConformanceData[];
  trainingData: TrainingData[];
  setCapaData: React.Dispatch<React.SetStateAction<CapaData[]>>;
  setChangeActionData: React.Dispatch<React.SetStateAction<ChangeActionData[]>>;
  setNonConformanceData: React.Dispatch<React.SetStateAction<NonConformanceData[]>>;
  setTrainingData: React.Dispatch<React.SetStateAction<TrainingData[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [capaData, setCapaData] = useState<CapaData[]>([]);
  const [changeActionData, setChangeActionData] = useState<ChangeActionData[]>([]);
  const [nonConformanceData, setNonConformanceData] = useState<NonConformanceData[]>([]);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);

  return (
    <DataContext.Provider value={{
      capaData,
      changeActionData,
      nonConformanceData,
      trainingData,
      setCapaData,
      setChangeActionData,
      setNonConformanceData,
      setTrainingData
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
