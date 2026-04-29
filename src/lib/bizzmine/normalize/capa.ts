import {
  unwrapCombobox,
  flattenOrgChart,
  stripHtml,
  toIntOrEmpty,
  toIsoDate,
} from './index';
import type { RawInstance, SubCollectionEntry } from '../types';

/** Output shape — keys match today's CSV-export headers. */
export interface NormalizedCapa {
  'CAPA ID': string;
  'Title': string;
  'Due Date': string;
  'Deadline for effectiveness check': string;
  'Assigned To': string;
  'Pending Steps': string;
  'Completed On': string;
  'Category of Corrective Action': string;
  'Priority': string;
  'Action taken': string;
  'Expected results of Action': string;
  'Action plan': string;
  'Description': string;
  'Proposed responsible': string;
  'Registration Time': string;
  'Registered By': string;
  /** Embedded linked records (CAPA → NCs, Incidents, Documents, Attachments). */
  _subCollections: Record<string, SubCollectionEntry[]>;
  /** Untyped passthrough for any extra fields the dashboard later consumes. */
  [key: string]: unknown;
}

const SUB_COLLECTION_KEYS = [
  'NonConformances',
  'Incidents',
  'Document',
  'Attachments',
  'CAPA_Customercomplaints',
];

export function normalizeCapaRecord(raw: RawInstance): NormalizedCapa {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  const idOrEmpty = toIntOrEmpty(raw.CAPA_CAPAID);

  return {
    'CAPA ID': idOrEmpty === '' ? '' : String(idOrEmpty),
    'Title': typeof raw.CAPA_Tittle === 'string' ? raw.CAPA_Tittle : '',
    'Due Date': toIsoDate(raw.CAPA_DueDate),
    'Deadline for effectiveness check': toIsoDate(raw.CAPA_Deadlineforeffectivenesscheck),
    'Assigned To': flattenOrgChart(raw.CAPA_AssignedTo),
    'Pending Steps': typeof raw.CAPA_PendingSteps === 'string' ? raw.CAPA_PendingSteps : '',
    'Completed On': toIsoDate(raw.CAPA_CompletedOn),
    'Category of Corrective Action': unwrapCombobox(raw.CAPA_Category),
    'Priority': unwrapCombobox(raw.CAPA_Priority),
    'Action taken': unwrapCombobox(raw.CAPA_Actiontaken),
    'Expected results of Action': stripHtml(raw.CAPA_ExpectedresultsofAction),
    'Action plan': stripHtml(raw.CAPA_Plan),
    'Description': stripHtml(raw.CAPA_Description),
    'Proposed responsible': flattenOrgChart(raw.CAPA_Proposedresponsible),
    'Registration Time': toIsoDate(raw.CAPA_RegistrationTime),
    'Registered By': flattenOrgChart(raw.CAPA_RegisteredBy),
    _subCollections: subs,
  };
}

export function normalizeCapaInstances(raws: RawInstance[]): NormalizedCapa[] {
  return raws.map(normalizeCapaRecord);
}
