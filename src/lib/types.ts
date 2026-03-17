export interface CapaData {
  'CAPA ID': string;
  'Title': string;
  'Due Date': string;
  'Deadline for effectiveness check': string;
  'Assigned To': string;
  'Pending Steps': string;
  'Completed On'?: string;
  isOverdue?: boolean;
  effectiveDueDate?: Date;
}

export interface DocumentKpiData {
  'Doc Prefix': string;
  'Doc Number': string;
  'Title': string;
  'Version Date': string;
  'Document Flow': string;
  'Pending Steps': string;
  'Completed On': string;
  'Responsible': string;
}

export interface DocumentsInFlowMetrics {
  total: number;
  majorRevisions: number;
  minorRevisions: number;
  newDocuments: number;
}

export interface MetricSnapshot {
  id?: string;
  timestamp: any; // Firestore Timestamp or Date
  metrics: {
    nonConformance: number;
    capaExecution: number;
    capaEffectiveness: number;
    changeActions: number;
    training: number;
    documentsInFlow?: DocumentsInFlowMetrics;
  };
}
