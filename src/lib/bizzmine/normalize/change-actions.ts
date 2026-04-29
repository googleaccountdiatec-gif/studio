import {
  unwrapCombobox,
  flattenOrgChart,
  stripHtml,
  toIntOrEmpty,
  toIsoDate,
} from './index';
import { resolveStepName, type StepMap } from '../steps';
import type { RawInstance, SubCollectionEntry } from '../types';

/**
 * Change_Actions phases. The collection's workflow has fewer formal phases
 * than CAPA — it's mostly Action Required -> Action Review -> Closed —
 * so the Phase enum is correspondingly compact.
 */
export type ChangeActionPhase =
  | 'pending_action'  // execution step (Action Required, Required, etc.)
  | 'pending_review'  // QA / Action Review steps
  | 'closed'          // CompletedOn set OR no pending step
  | 'other';

export function classifyChangeActionPhase(stepName: string, completedOnIso: string): ChangeActionPhase {
  if (completedOnIso) return 'closed';
  const trimmed = (stepName ?? '').trim();
  if (!trimmed) return 'closed';
  const lower = trimmed.toLowerCase();
  if (lower.includes('review') || lower.includes('approval')) return 'pending_review';
  if (lower.includes('action') || lower.includes('required')) return 'pending_action';
  return 'other';
}

/** Output shape — keys match today's CSV-export headers (see change-action-dashboard.tsx). */
export interface NormalizedChangeAction {
  'Change_ActionID': string;
  'Action required prior to change': string;
  'Responsible': string;
  'Pending Steps': string;
  'Deadline': string;
  'Change Title': string;          // hoisted from Change_Management sub-collection
  'Change ID (CMID)': string;      // hoisted from Change_Management sub-collection
  'Approve': string;
  'Registration Time': string;
  'Registered By': string;
  'Completed On': string;
  'Action Review': string;
  'Comments': string;
  'Phase': ChangeActionPhase;
  /** Effective Deadline = Deadline (Change_Actions has a single deadline field). */
  'Effective Deadline': string;
  _subCollections: Record<string, SubCollectionEntry[]>;
  [key: string]: unknown;
}

const SUB_COLLECTION_KEYS = [
  'Change_Management',
  'Training',
  'Documents',
  'Attachments',
  'Changeaction_internalprocess',
];

function hoistChangeManagement(raw: RawInstance): { cmid: string; title: string } {
  const arr = raw.Change_Management;
  if (!Array.isArray(arr) || arr.length === 0) return { cmid: '', title: '' };
  const first = arr[0] as RawInstance;
  const cmidRaw = toIntOrEmpty(first.Change_Management_CMID);
  const titleRaw = first.Change_Management_CM_ChangeTitle;
  return {
    cmid: cmidRaw === '' ? '' : String(cmidRaw),
    title: typeof titleRaw === 'string' ? titleRaw : '',
  };
}

export function normalizeChangeActionRecord(
  raw: RawInstance,
  stepMap?: StepMap,
): NormalizedChangeAction {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  const idOrEmpty = toIntOrEmpty(raw.Change_Actions_Change_ActionID);
  const pendingStepName = stepMap
    ? resolveStepName(raw.Change_Actions_PendingSteps, stepMap)
    : typeof raw.Change_Actions_PendingSteps === 'string'
      ? raw.Change_Actions_PendingSteps
      : '';

  const completedOnIso = toIsoDate(raw.Change_Actions_CompletedOn);
  const phase = classifyChangeActionPhase(pendingStepName, completedOnIso);

  const deadlineIso = toIsoDate(raw.Change_Actions_Deadline);

  const { cmid, title } = hoistChangeManagement(raw);

  return {
    'Change_ActionID': idOrEmpty === '' ? '' : String(idOrEmpty),
    'Action required prior to change': typeof raw.Change_Actions_Required === 'string' ? raw.Change_Actions_Required : '',
    'Responsible': flattenOrgChart(raw.Change_Actions_Responsible),
    'Pending Steps': pendingStepName,
    'Deadline': deadlineIso,
    'Change Title': title,
    'Change ID (CMID)': cmid,
    'Approve': unwrapCombobox(raw.Change_Actions_Approve),
    'Registration Time': toIsoDate(raw.Change_Actions_RegistrationTime),
    'Registered By': flattenOrgChart(raw.Change_Actions_RegisteredBy),
    'Completed On': completedOnIso,
    'Action Review': unwrapCombobox(raw.Change_Actions_ActionReview),
    'Comments': stripHtml(raw.Change_Actions_CommentsChangeAction),
    'Phase': phase,
    'Effective Deadline': deadlineIso,
    _subCollections: subs,
  };
}

export function normalizeChangeActionInstances(
  raws: RawInstance[],
  stepMap?: StepMap,
): NormalizedChangeAction[] {
  return raws.map((r) => normalizeChangeActionRecord(r, stepMap));
}
