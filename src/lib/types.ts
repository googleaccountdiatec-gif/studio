export interface CapaData {
  'CAPA ID': string;
  'Title': string;
  'Due Date': string;
  'Deadline for effectiveness check': string;
  'Assigned To': string;
  'Pending Steps': string;
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
}
