/**
 * Pure helpers for the Batch Registry dashboard.
 *
 * The headline view lists "downstream batches that are not yet released" —
 * any BR record whose Type of batch is NOT Upstream production AND whose
 * batch number is not present in any KPI_batch_release record (either as
 * the released batch's own Batch number, or as one of its FinalBatch
 * sub-collection batch numbers, surfaced by the normalizer as
 * 'Batch number from list').
 */

interface BatchReleaseLike {
  'Batch number'?: unknown;
  'Batch number from list'?: unknown;
}

interface BatchRegistryLike {
  'Batch number'?: unknown;
  'Is Upstream'?: unknown;
  'Registration Time'?: unknown;
}

/**
 * Set of batch numbers that have been released — i.e., the cross-link
 * "this BR has a corresponding KPI_batch_release entry". Built from the
 * normalized KPI_batch_release stream.
 */
export function getReleasedBatchNumbers(
  batchReleaseData: BatchReleaseLike[],
): Set<string> {
  const out = new Set<string>();
  for (const rec of batchReleaseData) {
    const a = rec['Batch number'];
    if (typeof a === 'string' && a.trim() !== '') out.add(a.trim());
    const b = rec['Batch number from list'];
    if (typeof b === 'string' && b.trim() !== '') out.add(b.trim());
  }
  return out;
}

/**
 * Filter BR records to those that are downstream AND have not yet been
 * released. Sorted oldest-first by Registration Time so the operator sees
 * the longest-pending batches at the top.
 */
export function getDownstreamNotReleased<T extends BatchRegistryLike>(
  batchRegistryData: T[],
  releasedBatchNumbers: Set<string>,
): T[] {
  return batchRegistryData
    .filter((r) => r['Is Upstream'] === false)
    .filter((r) => {
      const bn = r['Batch number'];
      return typeof bn === 'string' && bn.trim() !== '' && !releasedBatchNumbers.has(bn.trim());
    })
    .sort((a, b) => {
      const ta = typeof a['Registration Time'] === 'string' ? Date.parse(a['Registration Time']) : NaN;
      const tb = typeof b['Registration Time'] === 'string' ? Date.parse(b['Registration Time']) : NaN;
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb;
    });
}

/**
 * Days between an ISO timestamp and a reference date (default: now).
 * Returns null when the input cannot be parsed.
 */
export function daysSince(iso: unknown, ref: Date = new Date()): number | null {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const ms = ref.getTime() - t;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
