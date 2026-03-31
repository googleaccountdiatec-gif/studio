import { parse, isValid } from 'date-fns';

/**
 * Comprehensive date formats covering both standard BizzMine CSV exports
 * (semicolon-delimited, dd/MM/yyyy hh:mm a) and alternate locale exports
 * (comma-delimited, dd MMM yyyy HH:mm).
 *
 * Order matters: more specific formats first, ambiguous US formats last.
 */
const DATE_FORMATS = [
  // Date + time (12h with AM/PM) — standard BizzMine export
  'dd/MM/yyyy hh:mm a',
  'dd.MM.yyyy hh:mm a',
  // Date + time (24h)
  'dd/MM/yyyy HH:mm',
  'dd.MM.yyyy HH:mm:ss',
  'dd.MM.yyyy HH:mm',
  // Date + time with abbreviated month (24h) — alternate locale export
  'dd MMM yyyy HH:mm',
  'd MMM yyyy HH:mm',
  // Date only — slash/dot separators
  'dd/MM/yyyy',
  'd/M/yyyy',
  'dd.MM.yyyy',
  'd.M.yyyy',
  // Date only — abbreviated month names
  'dd MMM yyyy',
  'd MMM yyyy',
  'dd.MMM.yyyy',
  'dd-MMM-yyyy',
  'd-MMM-yyyy',
  'dd.MMM.yy',
  'dd MMM yy',
  'dd-MMM-yy',
  // ISO
  'yyyy-MM-dd',
  // US formats (last — only match when nothing else does)
  'M/d/yyyy',
  'MM/dd/yyyy',
  'M-d-yyyy',
  'MM-dd-yyyy',
];

/**
 * Robust date parser for BizzMine CSV exports.
 * Handles multiple date formats, invisible characters, and BOM artifacts.
 */
export function parseDate(dateString: any): Date {
  if (!dateString) return new Date('invalid');

  // Clean: remove BOM, zero-width chars, trim
  const str = String(dateString)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  if (!str) return new Date('invalid');

  // Special handling for DD.MM.YYYY to avoid day/month ambiguity
  const ddMMyyyy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddMMyyyy) {
    const [, day, month, year] = ddMMyyyy;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (isValid(d)) return d;
  }

  // Try each known format
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(str, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }

  // Fallback: native Date constructor (ISO strings, etc.)
  const native = new Date(str);
  if (isValid(native)) return native;

  return new Date('invalid');
}
