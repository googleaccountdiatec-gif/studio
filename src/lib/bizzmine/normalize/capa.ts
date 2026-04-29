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
 * Phase classification for CAPA records, derived from step name and CompletedOn.
 *
 * - `closed`        — CompletedOn is set, OR no pending step (workflow ended)
 * - `effectiveness` — pending step is "CAPA Effectiveness Evaluation" or "...check - QA Approval"
 * - `execution`     — pending step is "CAPA Execution" or "...QA Approval"
 * - `initiation`    — Gateway / Initiation / Verification / QA approval steps before Execution
 * - `other`         — anything else (defensive fallback)
 */
export type CapaPhase = 'execution' | 'effectiveness' | 'initiation' | 'closed' | 'other';

export function classifyCapaPhase(stepName: string, completedOnIso: string): CapaPhase {
  if (completedOnIso) return 'closed';
  const trimmed = (stepName ?? '').trim();
  if (!trimmed) return 'closed';
  const lower = trimmed.toLowerCase();
  if (lower.includes('effectiveness')) return 'effectiveness';
  if (lower.includes('execution')) return 'execution';
  if (
    lower.includes('gateway') ||
    lower.includes('initiation') ||
    lower.includes('verification')
  ) {
    return 'initiation';
  }
  return 'other';
}

/** Output shape — keys match today's CSV-export headers PLUS structured Phase + Effective Deadline. */
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
  /** Structured phase classification — robust replacement for substring matching on Pending Steps. */
  'Phase': CapaPhase;
  /**
   * Pre-computed deadline that callers should compare against today:
   * - effectiveness phase -> Deadline for effectiveness check (fall back to Due Date)
   * - else                -> Due Date
   * Empty string when neither is set.
   */
  'Effective Deadline': string;
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

export function normalizeCapaRecord(
  raw: RawInstance,
  stepMap?: StepMap,
): NormalizedCapa {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  const idOrEmpty = toIntOrEmpty(raw.CAPA_CAPAID);

  // Resolve Pending Steps: API returns numeric ID; CSV legacy was the name.
  // resolveStepName handles both. If no stepMap provided (test path), fall back
  // to whatever shape the raw value already is.
  const pendingStepName = stepMap
    ? resolveStepName(raw.CAPA_PendingSteps, stepMap)
    : typeof raw.CAPA_PendingSteps === 'string'
      ? raw.CAPA_PendingSteps
      : '';

  const completedOnIso = toIsoDate(raw.CAPA_CompletedOn);
  const phase = classifyCapaPhase(pendingStepName, completedOnIso);

  const dueDateIso = toIsoDate(raw.CAPA_DueDate);
  const effDeadlineIso = toIsoDate(raw.CAPA_Deadlineforeffectivenesscheck);
  const effective =
    phase === 'effectiveness'
      ? effDeadlineIso || dueDateIso
      : dueDateIso;

  return {
    'CAPA ID': idOrEmpty === '' ? '' : String(idOrEmpty),
    'Title': typeof raw.CAPA_Tittle === 'string' ? raw.CAPA_Tittle : '',
    'Due Date': dueDateIso,
    'Deadline for effectiveness check': effDeadlineIso,
    'Assigned To': flattenOrgChart(raw.CAPA_AssignedTo),
    'Pending Steps': pendingStepName,
    'Completed On': completedOnIso,
    'Category of Corrective Action': unwrapCombobox(raw.CAPA_Category),
    'Priority': unwrapCombobox(raw.CAPA_Priority),
    'Action taken': unwrapCombobox(raw.CAPA_Actiontaken),
    'Expected results of Action': stripHtml(raw.CAPA_ExpectedresultsofAction),
    'Action plan': stripHtml(raw.CAPA_Plan),
    'Description': stripHtml(raw.CAPA_Description),
    'Proposed responsible': flattenOrgChart(raw.CAPA_Proposedresponsible),
    'Registration Time': toIsoDate(raw.CAPA_RegistrationTime),
    'Registered By': flattenOrgChart(raw.CAPA_RegisteredBy),
    'Phase': phase,
    'Effective Deadline': effective,
    _subCollections: subs,
  };
}

export function normalizeCapaInstances(
  raws: RawInstance[],
  stepMap?: StepMap,
): NormalizedCapa[] {
  return raws.map((r) => normalizeCapaRecord(r, stepMap));
}
