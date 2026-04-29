import type { ComboboxValue, OrgChartEntry } from '../types';

export function unwrapCombobox(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'object' && input !== null && 'text' in input) {
    const text = (input as ComboboxValue).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
}

export function flattenOrgChart(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (!Array.isArray(input)) return '';
  return input
    .map((e: OrgChartEntry) =>
      typeof e?.value === 'string' ? e.value : '',
    )
    .filter(Boolean)
    .join(', ');
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function stripHtml(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  if (typeof input !== 'string') return '';

  // 1. Replace <br>, </p>, </div> with spaces (preserve word boundaries)
  let s = input.replace(/<\/?(br|p|div|tr|li)\s*\/?>/gi, ' ');
  // 2. Strip remaining tags
  s = s.replace(/<[^>]+>/g, '');
  // 3. Decode common entities
  s = s.replace(
    /&(amp|lt|gt|quot|#39|nbsp);/g,
    (m) => HTML_ENTITIES[m] ?? m,
  );
  // 4. Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function toIntOrEmpty(input: unknown): number | '' {
  if (input === null || input === undefined || input === '') return '';
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(n)) return '';
  return Math.trunc(n);
}

// Matches BizzMine US-format dates like "1/24/2022 12:48:45 PM +00:00".
// V8's permissive Date parser accepts most variants but the trailing
// "+00:00" after "AM/PM" is non-standard, so we provide a fallback.
const BIZZMINE_DATE_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+([+-]\d{2}):?(\d{2})$/i;

export function toIsoDate(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  if (typeof input !== 'string') return '';

  // 1. Try native parser first (handles ISO 8601 cleanly)
  const native = new Date(input);
  if (!Number.isNaN(native.getTime())) return native.toISOString();

  // 2. Fallback: parse BizzMine US format
  const m = input.match(BIZZMINE_DATE_RE);
  if (m) {
    const [, mo, d, y, h, mi, s, ampm, tzH, tzM] = m;
    let hour = parseInt(h, 10);
    if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    const iso =
      `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` +
      `T${String(hour).padStart(2, '0')}:${mi}:${s}${tzH}:${tzM}`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return '';
}
