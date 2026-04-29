import {
  unwrapCombobox,
  flattenOrgChart,
  stripHtml,
  toIntOrEmpty,
  toIsoDate,
} from './index';
import type { RawInstance, SubCollectionEntry } from '../types';

/** Type-of-batch enum value for "Upstream production" — defines the Upstream/Downstream split. */
const UPSTREAM_TYPE_ID = 1466;

export interface BatchRegistryPreviousBatchRef {
  'Batch number': string;
  'Type of batch': string;
  'Registration Time': string;
}

/** Output shape for the Phase 4.2 Batch Registry tab. */
export interface NormalizedBatchRegistry {
  'BRID': string;
  'Batch number': string;
  'Type of batch': string;
  'Number of units': string;
  'Preservatives': string;
  'Type of unit': string;
  'Comments': string;
  'Harvests used': string;
  'Registered By': string;
  'Registration Time': string;
  'Completed On': string;
  'Pending Steps': string;
  'Status': string;
  /** True iff Typeofbatch.value === 1466 (Upstream production). */
  'Is Upstream': boolean;
  /** Hoisted from Producedforproject sub-collection. */
  'Project Number': string;
  'Clone name': string;
  'Product Name': string;
  /** Pooling tree: which BR records were used to produce this batch. */
  'Previous Batches': BatchRegistryPreviousBatchRef[];
  _subCollections: Record<string, SubCollectionEntry[]>;
  [key: string]: unknown;
}

const SUB_COLLECTION_KEYS = [
  'Refpreviousbatch',
  'MaximiserUpstream',
  'batchnotusedinproject',
  'Producedforproject',
];

function firstOf<T = RawInstance>(raw: unknown): T | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw[0] as T;
}

function strOrEmpty(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : String(Math.trunc(v));
  }
  return String(v);
}

function previousBatchesFrom(raw: unknown): BatchRegistryPreviousBatchRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: RawInstance) => ({
    'Batch number':
      typeof entry?.Refpreviousbatch_Batchnumber === 'string'
        ? entry.Refpreviousbatch_Batchnumber
        : '',
    'Type of batch': unwrapCombobox(entry?.Refpreviousbatch_Typeofbatch),
    'Registration Time': toIsoDate(entry?.Refpreviousbatch_RegistrationTime),
  }));
}

export function normalizeBatchRegistryRecord(raw: RawInstance): NormalizedBatchRegistry {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  // Producedforproject hoisting
  const project = firstOf(raw.Producedforproject);
  const clone = firstOf(project?.Clone);
  const prodName = firstOf(project?.ProdName);

  const projectNumber =
    typeof project?.Producedforproject_ProjectNumber === 'string'
      ? project.Producedforproject_ProjectNumber
      : '';
  const cloneName =
    typeof clone?.Producedforproject_Clonename === 'string'
      ? clone.Producedforproject_Clonename
      : '';
  const productName =
    typeof prodName?.Producedforproject_ProdName_ProductName === 'string'
      ? prodName.Producedforproject_ProdName_ProductName
      : '';

  const typeOfBatchObj = raw.BR_Typeofbatch as { value?: number; text?: string } | undefined;
  const isUpstream = typeOfBatchObj?.value === UPSTREAM_TYPE_ID;

  const idOrEmpty = toIntOrEmpty(raw.BR_BRID);

  return {
    'BRID': idOrEmpty === '' ? '' : String(idOrEmpty),
    'Batch number': typeof raw.BR_Batchnumber === 'string' ? raw.BR_Batchnumber : '',
    'Type of batch': unwrapCombobox(raw.BR_Typeofbatch),
    'Number of units': strOrEmpty(raw.BR_Numberofunits),
    'Preservatives': unwrapCombobox(raw.BR_Preservatives),
    'Type of unit': unwrapCombobox(raw.BR_Typeofunit),
    'Comments': stripHtml(raw.BR_Comments),
    'Harvests used': stripHtml(raw.BR_Harvestsused),
    'Registered By': flattenOrgChart(raw.BR_RegisteredBy),
    'Registration Time': toIsoDate(raw.BR_RegistrationTime),
    'Completed On': toIsoDate(raw.BR_CompletedOn),
    'Pending Steps': typeof raw.BR_PendingSteps === 'string' ? raw.BR_PendingSteps : '',
    'Status': raw.BR_Status === undefined || raw.BR_Status === null ? '' : String(raw.BR_Status),
    'Is Upstream': isUpstream,
    'Project Number': projectNumber,
    'Clone name': cloneName,
    'Product Name': productName,
    'Previous Batches': previousBatchesFrom(raw.Refpreviousbatch),
    _subCollections: subs,
  };
}

export function normalizeBatchRegistryInstances(
  raws: RawInstance[],
): NormalizedBatchRegistry[] {
  return raws.map(normalizeBatchRegistryRecord);
}
