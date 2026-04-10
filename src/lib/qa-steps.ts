/**
 * Centralized QA step identification logic.
 * Used by Change Action and Compendium dashboards to filter by QA-related steps.
 */

/** Sentinel value for the "QA Steps" grouped filter option */
export const QA_GROUP_VALUE = '__qa_steps__';

/** Sentinel value for the "Non-QA Steps" grouped filter option */
export const NON_QA_GROUP_VALUE = '__non_qa_steps__';

/**
 * Determines if a pending step is QA-related.
 * - Steps containing "QA" (case-insensitive) are considered QA steps.
 * - "Complete and Approve" is a QA step specific to Change Actions.
 */
export function isQaStep(pendingStep: string, domain?: string): boolean {
  const step = pendingStep.trim().toLowerCase();
  if (!step) return false;
  if (step.includes('qa')) return true;
  if (step === 'complete and approve') return true;
  return false;
}
