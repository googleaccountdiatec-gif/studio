/**
 * Centralized QA step identification logic.
 * Used by Change Action, Changes, and Compendium dashboards to filter by QA-related steps.
 */

/** Sentinel value for the "QA Steps" grouped filter option */
export const QA_GROUP_VALUE = '__qa_steps__';

/** Sentinel value for the "Non-QA Steps" grouped filter option */
export const NON_QA_GROUP_VALUE = '__non_qa_steps__';

/**
 * Determines if a pending step is QA-related.
 * - Steps containing "QA" (case-insensitive) are QA.
 * - Steps containing "Approve"/"Approval" are QA (general rule across all domains).
 * - For Change KPI: steps starting with "3.", "5.", "6." are QA.
 */
export function isQaStep(pendingStep: string, domain?: string): boolean {
  const step = pendingStep.trim().toLowerCase();
  if (!step) return false;
  if (step.includes('qa')) return true;
  if (step.includes('approv')) return true;

  // Change KPI: Steps 3, 5, 6 are QA
  if (domain === 'change-kpi') {
    if (step.startsWith('3.') || step.startsWith('5.') || step.startsWith('6.')) return true;
  }

  return false;
}
