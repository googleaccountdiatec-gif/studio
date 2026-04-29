import {
  unwrapCombobox,
  flattenOrgChart,
  stripHtml,
  toIntOrEmpty,
  toIsoDate,
} from './index';
import type { RawInstance, SubCollectionEntry } from '../types';

/** Output shape — keys match today's CSV-export headers (see batch-release-dashboard.tsx). */
export interface NormalizedBatchRelease {
  'Batch number': string;
  'Batch number from list': string;
  'Project Number': string;
  'Product number': string;
  'Product Name': string;
  'Final batch status': string;
  'Clone name': string;
  'High-risk nonconformance': string;
  'Low-risk nonconformances': string;
  'Type of Production': string;
  'Type of production': string;     // dashboard checks both casings
  'Company': string;
  'Company aliases': string;
  'Completed On': string;
  'Registration Time': string;
  'Registered By': string;
  'Product approval': string;
  'Product approved by': string;
  _subCollections: Record<string, SubCollectionEntry[]>;
  [key: string]: unknown;
}

/** Pull the first object out of a sub-collection array, or return undefined. */
function firstOf<T = RawInstance>(raw: unknown): T | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw[0] as T;
}

/** Stringify a numeric/string value, preferring integer formatting for floats. */
function strOrEmpty(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : String(Math.trunc(v));
  }
  return String(v);
}

const SUB_COLLECTION_KEYS = [
  'FinalBatch',
  'Batch_release_project',
  'InvolvedBatches',
  'Batch_release_nonconformance',
];

export function normalizeBatchReleaseRecord(raw: RawInstance): NormalizedBatchRelease {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  // Sub-collection hoisting
  const finalBatch = firstOf(raw.FinalBatch);
  const project = firstOf(raw.Batch_release_project);
  const clone = firstOf(project?.Clone);
  const co = firstOf(project?.CO);
  const prodName = firstOf(project?.ProdName);

  const batchNumberFromList =
    typeof finalBatch?.FinalBatch_Batchnumber === 'string'
      ? finalBatch.FinalBatch_Batchnumber
      : '';

  const projectNumber =
    typeof project?.Batch_release_project_ProjectNumber === 'string'
      ? project.Batch_release_project_ProjectNumber
      : '';

  const cloneName =
    typeof clone?.Batch_release_project_Clonename === 'string'
      ? clone.Batch_release_project_Clonename
      : '';

  // Prefer AlphaNumeric ProdName.ProductNumber over Numeric Clone.Productnumber
  const productNumber =
    (typeof prodName?.Batch_release_project_ProductNumber === 'string'
      ? prodName.Batch_release_project_ProductNumber
      : '') ||
    strOrEmpty(clone?.Batch_release_project_Clone_Productnumber);

  const productName =
    typeof prodName?.Batch_release_project_ProductName === 'string'
      ? prodName.Batch_release_project_ProductName
      : '';

  const company =
    typeof co?.Batch_release_project_Company === 'string'
      ? co.Batch_release_project_Company
      : '';

  const companyAliases =
    typeof co?.Batch_release_project_CO_Companyaliases === 'string'
      ? co.Batch_release_project_CO_Companyaliases
      : '';

  const typeOfProduction = unwrapCombobox(raw.KPI_batch_release_Typeofproduction);

  return {
    'Batch number': typeof raw.KPI_batch_release_Batchnumber === 'string' ? raw.KPI_batch_release_Batchnumber : '',
    'Batch number from list': batchNumberFromList,
    'Project Number': projectNumber,
    'Product number': productNumber,
    'Product Name': productName,
    'Final batch status': unwrapCombobox(raw.KPI_batch_release_Finalbatchstatus),
    'Clone name': cloneName,
    'High-risk nonconformance': strOrEmpty(raw.KPI_batch_release_Highrisknonconformance),
    'Low-risk nonconformances': strOrEmpty(raw.KPI_batch_release_Lowrisknonconformances),
    'Type of Production': typeOfProduction,
    'Type of production': typeOfProduction,
    'Company': company,
    'Company aliases': companyAliases,
    'Completed On': toIsoDate(raw.KPI_batch_release_CompletedOn),
    'Registration Time': toIsoDate(raw.KPI_batch_release_RegistrationTime),
    'Registered By': flattenOrgChart(raw.KPI_batch_release_RegisteredBy),
    'Product approval': toIsoDate(raw.KPI_batch_release_Productapproval),
    'Product approved by': flattenOrgChart(raw.KPI_batch_release_Productapprovedby),
    _subCollections: subs,
  };
}

export function normalizeBatchReleaseInstances(
  raws: RawInstance[],
): NormalizedBatchRelease[] {
  return raws.map(normalizeBatchReleaseRecord);
}
