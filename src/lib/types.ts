export interface CapaData {
  'CAPA ID': string;
  'Tittle': string;
  'Due Date': string;
  'Deadline for effectiveness check': string;
  'Assigned To': string;
  'Pending Steps': string;
  isOverdue?: boolean;
  effectiveDueDate?: Date;
}
