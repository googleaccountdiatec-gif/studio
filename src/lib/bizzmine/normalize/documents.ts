import {
  unwrapCombobox,
  flattenOrgChart,
  stripHtml,
  toIsoDate,
} from './index';
import { resolveStepName, type StepMap } from '../steps';
import type { RawInstance, SubCollectionEntry } from '../types';

/**
 * Derive Document Flow type from MajorVersion / MinorVersion.
 *
 * Why not use DC_DocumentFlow? It's an EnumList that returns numeric codes
 * (e.g. "14", "13", "7") whose text mapping isn't exposed via the API.
 * Version numbers give the same information directly.
 *
 *   1.0       -> New Document
 *   X.0 (X>1) -> Major Revision
 *   X.Y (Y>0) -> Minor Revision
 *   missing   -> Other
 */
export function deriveDocumentFlow(major: unknown, minor: unknown): string {
  const M = typeof major === 'number' ? major : Number(major);
  const m = typeof minor === 'number' ? minor : Number(minor);
  if (!Number.isFinite(M) || !Number.isFinite(m)) return 'Other';
  if (m > 0) return 'Minor Revision';
  if (M === 1 && m === 0) return 'New Document';
  if (M > 1 && m === 0) return 'Major Revision';
  return 'Other';
}

/** Output shape — keys match today's CSV-export headers (see documents-in-flow-dashboard.tsx). */
export interface NormalizedDocument {
  'Doc Prefix': string;
  'Doc Number': string;
  'Title': string;
  'Version Date': string;
  'Document Flow': string;
  'Pending Steps': string;
  'Completed On': string;
  'Author': string;
  'Version': string;
  'Change Reason': string;
  'Responsible': string;
  'Authorized copy': string;
  'Periodic review of document': string;
  'Distribution List': string;
  'Registration Time': string;
  'Registered By': string;
  _subCollections: Record<string, SubCollectionEntry[]>;
  [key: string]: unknown;
}

const SUB_COLLECTION_KEYS = [
  'Documentmanagement_folderlist',
  'Documentmanagement_documentmanagement_references',
  'Documentmanagement_internalprocess',
];

export function normalizeDocumentRecord(
  raw: RawInstance,
  stepMap?: StepMap,
): NormalizedDocument {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  const pendingStepName = stepMap
    ? resolveStepName(raw.DC_PendingSteps, stepMap)
    : typeof raw.DC_PendingSteps === 'string'
      ? raw.DC_PendingSteps
      : '';

  return {
    'Doc Prefix': unwrapCombobox(raw.DC_DocumentPrefix),
    'Doc Number': typeof raw.DC_DocumentNumber === 'string' ? raw.DC_DocumentNumber : '',
    'Title': typeof raw.DC_Title === 'string' ? raw.DC_Title : '',
    'Version Date': toIsoDate(raw.DC_VersionDate),
    'Document Flow': deriveDocumentFlow(raw.DC_MajorVersion, raw.DC_MinorVersion),
    'Pending Steps': pendingStepName,
    'Completed On': toIsoDate(raw.DC_CompletedOn),
    'Author': flattenOrgChart(raw.DC_Author),
    'Version': typeof raw.DC_Version === 'string' ? raw.DC_Version : '',
    'Change Reason': stripHtml(raw.DC_ChangeReason),
    'Responsible': flattenOrgChart(raw.DC_Responsible),
    'Authorized copy': unwrapCombobox(raw.DC_Autorizedcopy),
    'Periodic review of document': unwrapCombobox(raw.DC_Periodicreviewofdocument),
    'Distribution List': flattenOrgChart(raw.DC_DistributionList),
    'Registration Time': toIsoDate(raw.DC_RegistrationTime),
    'Registered By': flattenOrgChart(raw.DC_RegisteredBy),
    _subCollections: subs,
  };
}

export function normalizeDocumentInstances(
  raws: RawInstance[],
  stepMap?: StepMap,
): NormalizedDocument[] {
  return raws.map((r) => normalizeDocumentRecord(r, stepMap));
}
