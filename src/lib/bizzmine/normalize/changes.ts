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
 * Change Management workflow phases.
 *   - pending_review        — proposal / approval / change-review steps
 *   - pending_implementation — planning / execution / implementation steps
 *   - closed                — CompletedOn set OR no pending step
 *   - other
 */
export type ChangePhase =
  | 'pending_review'
  | 'pending_implementation'
  | 'closed'
  | 'other';

export function classifyChangePhase(stepName: string, completedOnIso: string): ChangePhase {
  if (completedOnIso) return 'closed';
  const trimmed = (stepName ?? '').trim();
  if (!trimmed) return 'closed';
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('review') ||
    lower.includes('approval') ||
    lower.includes('proposal') ||
    lower.includes('decision')
  ) {
    return 'pending_review';
  }
  if (
    lower.includes('plan') ||
    lower.includes('implement') ||
    lower.includes('execution')
  ) {
    return 'pending_implementation';
  }
  return 'other';
}

/** Output shape — keys match today's CSV-export headers (see changes-dashboard.tsx). */
export interface NormalizedChange {
  'CMID': string;
  'Change Title': string;
  'Pending Steps': string;
  'Department Manager': string;
  'Category': string;
  'Change from:': string;
  'Change to': string;
  'Justification for Change': string;
  'Impacted areas of the organization and risk assessment': string;
  'Planned implementation data - comment': string;
  'Planned Implementation Date': string;
  'Implementation Date': string;
  'Final Change Status': string;
  'Change Requestor': string;
  'Registration Time': string;
  'Registered By': string;
  'Completed On': string;
  'Phase': ChangePhase;
  /** Effective Deadline = Planned Implementation Date (closest analogue). */
  'Effective Deadline': string;
  _subCollections: Record<string, SubCollectionEntry[]>;
  [key: string]: unknown;
}

const SUB_COLLECTION_KEYS = ['Actions_Required', 'ChangeAttachment'];

export function normalizeChangeRecord(
  raw: RawInstance,
  stepMap?: StepMap,
): NormalizedChange {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  const idOrEmpty = toIntOrEmpty(raw.CM_CMID);

  const pendingStepName = stepMap
    ? resolveStepName(raw.CM_PendingSteps, stepMap)
    : typeof raw.CM_PendingSteps === 'string'
      ? raw.CM_PendingSteps
      : '';

  const completedOnIso = toIsoDate(raw.CM_CompletedOn);
  const phase = classifyChangePhase(pendingStepName, completedOnIso);
  const plannedIso = toIsoDate(raw.CM_PlannedDate);

  return {
    'CMID': idOrEmpty === '' ? '' : String(idOrEmpty),
    'Change Title': typeof raw.CM_ChangeTitle === 'string' ? raw.CM_ChangeTitle : '',
    'Pending Steps': pendingStepName,
    'Department Manager': flattenOrgChart(raw.CM_DepartmentManager),
    'Category': unwrapCombobox(raw.CM_Category),
    'Change from:': stripHtml(raw.CM_Changefrom),
    'Change to': stripHtml(raw.CM_Changeto),
    'Justification for Change': stripHtml(raw.CM_JustificationforChange),
    'Impacted areas of the organization and risk assessment': stripHtml(raw.CM_AdditionalInformation),
    'Planned implementation data - comment': stripHtml(raw.CM_Comments),
    'Planned Implementation Date': plannedIso,
    'Implementation Date': toIsoDate(raw.CM_ImplementationDate),
    'Final Change Status': unwrapCombobox(raw.CM_FinalChangeStatus),
    'Change Requestor': flattenOrgChart(raw.CM_ChangeRequestor),
    'Registration Time': toIsoDate(raw.CM_RegistrationTime),
    'Registered By': flattenOrgChart(raw.CM_RegisteredBy),
    'Completed On': completedOnIso,
    'Phase': phase,
    'Effective Deadline': plannedIso,
    _subCollections: subs,
  };
}

export function normalizeChangeInstances(
  raws: RawInstance[],
  stepMap?: StepMap,
): NormalizedChange[] {
  return raws.map((r) => normalizeChangeRecord(r, stepMap));
}
