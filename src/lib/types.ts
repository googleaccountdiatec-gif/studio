export interface CapaData {
  'CAPA ID': string;
  'Title': string;
  'Due Date': string;
  'Deadline for effectiveness check': string;
  'Assigned To': string;
  'Pending Steps': string;
  'Completed On'?: string;
  'Category of Corrective Action'?: string;
  'Priority'?: string;
  'Action taken'?: string;
  'Expected results of Action'?: string;
  'Action plan'?: string;
  'Description'?: string;
  'Proposed responsible'?: string;
  isOverdue?: boolean;
  effectiveDueDate?: Date;
  [key: string]: any;
}

export interface DocumentKpiData {
  'Doc Prefix': string;
  'Doc Number': string;
  'Title': string;
  'Version Date': string;
  'Document Flow': string;
  'Pending Steps': string;
  'Completed On': string;
  'Author': string;
  'Version'?: string;
  'Change Reason'?: string;
  'Responsible'?: string;
  'Authorized copy'?: string;
  'Periodic review of document'?: string;
  'Distribution List'?: string;
}

export interface DocumentsInFlowMetrics {
  total: number;
  majorRevisions: number;
  minorRevisions: number;
  newDocuments: number;
}

