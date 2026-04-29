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
 * NC workflow phases. Current workflow (per BizzMine instruction file §8.1):
 *   Registration -> NC Gateway1 -> Classification -> NC Gateway2 ->
 *   Investigation and root cause analysis -> Technical verification ->
 *   NC Gateway4 -> QA approval -> NC Gateway5 -> Stop
 *
 * Older workflow revisions also surface in the data with numbered steps
 * like "7. Effectiveness Check & Closing" — those map to 'closing'.
 */
export type NcPhase =
  | 'registration'   // Registration, Classification, any Gateway
  | 'investigation'  // Investigation and root cause analysis
  | 'verification'   // Technical verification
  | 'qa_approval'    // QA approval
  | 'closing'        // Effectiveness Check & Closing (legacy workflow step)
  | 'closed'         // CompletedOn set OR no pending step
  | 'other';

export function classifyNcPhase(stepName: string, completedOnIso: string): NcPhase {
  if (completedOnIso) return 'closed';
  const trimmed = (stepName ?? '').trim();
  if (!trimmed) return 'closed';
  const lower = trimmed.toLowerCase();
  if (lower.includes('investigation') || lower.includes('root cause')) return 'investigation';
  if (lower.includes('verification')) return 'verification';
  if (lower.includes('qa approval')) return 'qa_approval';
  // 'Effectiveness Check & Closing' / 'Closing' steps from older workflow revisions
  if (lower.includes('closing') || lower.includes('effectiveness check')) return 'closing';
  if (lower.includes('approval')) return 'qa_approval';
  if (
    lower.includes('registration') ||
    lower.includes('classification') ||
    lower.includes('gateway')
  ) {
    return 'registration';
  }
  return 'other';
}

/** Output shape — keys match today's CSV-export headers (see non-conformance-dashboard.tsx). */
export interface NormalizedNc {
  'Id': string;
  'Non Conformance Title': string;
  'Classification': string;
  'Pending Steps': string;
  'Case Worker': string;
  'Status': string;
  'Registration Time': string;
  'Registered By': string;
  'Reoccurrence': string;
  'Completed On': string;
  'Impact Other': string;
  'Investigation summary': string;
  'Impact Assessment': string;
  'Root cause description': string;
  'Classification justification': string;
  'Segregation of product': string;
  'Discarded product': string;
  'Started new production': string;
  'Repeated operation/analysis': string;
  /** Structured phase classification — robust replacement for substring matching. */
  'Phase': NcPhase;
  /**
   * Pre-computed deadline: DeadlineInvestigation when in registration/investigation
   * phase, empty otherwise. NC's workflow doesn't have a single Due Date field
   * shared across phases — this is the closest analogue of CAPA's Effective Deadline.
   */
  'Effective Deadline': string;
  /** Embedded linked records (NC -> CAPA, Attachments, Suppliers, etc.). */
  _subCollections: Record<string, SubCollectionEntry[]>;
  [key: string]: unknown;
}

const SUB_COLLECTION_KEYS = [
  'CAPA',
  'Attachments',
  'Projects',
  'Relevant Supplier',
  'CauseCategory',
  'Instrument',
  'Nonconformance_downstream_batch',
  'Process_Impacted_Nonconformance',
  'Procedure_deviatedfrom',
  'Noncoformance_reoccurance',
  'Batchnonc',
  'roomNC',
  'Nonconformance_trending',
];

export function normalizeNcRecord(raw: RawInstance, stepMap?: StepMap): NormalizedNc {
  const subs: Record<string, SubCollectionEntry[]> = {};
  for (const k of SUB_COLLECTION_KEYS) {
    if (Array.isArray(raw[k])) {
      subs[k] = raw[k] as SubCollectionEntry[];
    }
  }

  const idOrEmpty = toIntOrEmpty(raw.NC_NCID);

  const pendingStepName = stepMap
    ? resolveStepName(raw.NC_PendingSteps, stepMap)
    : typeof raw.NC_PendingSteps === 'string'
      ? raw.NC_PendingSteps
      : '';

  const completedOnIso = toIsoDate(raw.NC_CompletedOn);
  const phase = classifyNcPhase(pendingStepName, completedOnIso);

  const deadlineInvestigation = toIsoDate(raw.NC_DeadlineInvestigation);
  // Effective Deadline = investigation deadline for any NOT-yet-closed record.
  // (Originally only set for registration/investigation phases, which missed
  // records that are past their deadline but already advanced to verification
  // or QA approval — those are exactly the records that should still flag
  // as overdue until the NC is fully closed.)
  const effective = phase === 'closed' ? '' : deadlineInvestigation;

  // Status: EnumList numeric code; emit as string for now (dashboards rarely
  // depend on specific text values, and resolving the EnumList lookup is a
  // separate Phase 4 concern).
  const statusStr =
    raw.NC_Status === undefined || raw.NC_Status === null
      ? ''
      : String(raw.NC_Status);

  return {
    'Id': idOrEmpty === '' ? '' : String(idOrEmpty),
    'Non Conformance Title': typeof raw.NC_Title === 'string' ? raw.NC_Title : '',
    'Classification': unwrapCombobox(raw.NC_Classification),
    'Pending Steps': pendingStepName,
    'Case Worker': flattenOrgChart(raw.NC_CaseWorker),
    'Status': statusStr,
    'Registration Time': toIsoDate(raw.NC_RegistrationTime),
    'Registered By': flattenOrgChart(raw.NC_RegisteredBy),
    'Reoccurrence': unwrapCombobox(raw.NC_Reoccurrence),
    'Completed On': completedOnIso,
    'Impact Other': stripHtml(raw.NC_ImpactOther),
    'Investigation summary': stripHtml(raw.NC_Investigationsummary),
    'Impact Assessment': stripHtml(raw.NC_ImpactAssessment),
    'Root cause description': stripHtml(raw.NC_RootcauseDescription),
    'Classification justification': stripHtml(raw.NC_Classificationjustification),
    'Segregation of product': typeof raw.NC_Segregation === 'string' ? raw.NC_Segregation : '',
    'Discarded product': typeof raw.NC_Discardedproduct === 'string' ? raw.NC_Discardedproduct : '',
    'Started new production': typeof raw.NC_Startednewproduction === 'string' ? raw.NC_Startednewproduction : '',
    'Repeated operation/analysis': typeof raw.NC_Repeatedoperation === 'string' ? raw.NC_Repeatedoperation : '',
    'Phase': phase,
    'Effective Deadline': effective,
    _subCollections: subs,
  };
}

export function normalizeNcInstances(
  raws: RawInstance[],
  stepMap?: StepMap,
): NormalizedNc[] {
  return raws.map((r) => normalizeNcRecord(r, stepMap));
}
