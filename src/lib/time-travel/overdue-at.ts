import { isValid, isBefore } from 'date-fns';
import { parseDate } from '@/lib/date-utils';

/**
 * Snapshot-free time-travel: given a record set and a historical reference
 * date, compute how many records were OPEN AND OVERDUE at that point.
 *
 * Replaces the persisted-snapshot model for the overdue trend visual on the
 * Compendium. The dataset is its own time machine because every BizzMine
 * record carries Registration Time + Completed On + Deadline fields — we
 * can replay the state at any past timestamp.
 *
 * Caveats:
 *   1. Pushed deadlines are lost: if the deadline was once X but has since
 *      been moved to Y, only Y is retained on the record. The replay shows
 *      "overdue against current deadline", which is a reasonable proxy.
 *   2. Records that didn't exist at refDate are excluded via the
 *      Registration Time gate — without this, the count would over-count
 *      historical windows by including everything created since.
 *   3. Records missing Registration Time are treated as "always existed"
 *      so CSV-shaped legacy data (which sometimes lacks the field) keeps
 *      working — i.e., this falls back to the same semantics as the
 *      existing isTaskOverdue() helper.
 */
export interface OverdueAtAccessors<T> {
  /** Returns the deadline string (or undefined). */
  getDeadline: (record: T) => unknown;
  /** Returns the completion timestamp (Completed On). */
  getCompletedOn: (record: T) => unknown;
  /** Returns the registration timestamp. Optional but recommended for accuracy. */
  getRegistrationTime?: (record: T) => unknown;
}

/**
 * True iff the record was both open (existed and not yet completed) AND
 * overdue (past deadline) at refDate.
 */
export function wasOpenAndOverdueAt<T>(
  record: T,
  refDate: Date,
  acc: OverdueAtAccessors<T>,
): boolean {
  // 1. Registration gate — exclude records that didn't exist at refDate.
  //    Missing/invalid registration is intentionally permissive (treated as
  //    "always existed") so CSV-shaped legacy data keeps working.
  if (acc.getRegistrationTime) {
    const registered = parseDate(acc.getRegistrationTime(record));
    if (isValid(registered) && registered.getTime() > refDate.getTime()) {
      return false;
    }
  }

  // 2. Deadline must exist and be before refDate.
  const deadline = parseDate(acc.getDeadline(record));
  if (!isValid(deadline)) return false;
  if (!isBefore(deadline, refDate)) return false;

  // 3. If completed at or before refDate, it wasn't open then.
  const completedAt = parseDate(acc.getCompletedOn(record));
  if (isValid(completedAt)) {
    if (
      isBefore(completedAt, refDate) ||
      completedAt.getTime() === refDate.getTime()
    ) {
      return false;
    }
  }
  return true;
}

/** Count of records open & overdue at refDate. */
export function countOverdueAt<T>(
  records: T[],
  refDate: Date,
  acc: OverdueAtAccessors<T>,
): number {
  let n = 0;
  for (const r of records) {
    if (wasOpenAndOverdueAt(r, refDate, acc)) n++;
  }
  return n;
}

export interface OverdueSeriesPoint {
  refDate: Date;
  count: number;
}

/** Compute counts at a sequence of historical reference dates. */
export function overdueTrendSeries<T>(
  records: T[],
  refDates: Date[],
  acc: OverdueAtAccessors<T>,
): OverdueSeriesPoint[] {
  return refDates.map((d) => ({
    refDate: d,
    count: countOverdueAt(records, d, acc),
  }));
}
