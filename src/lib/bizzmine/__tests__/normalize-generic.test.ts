import { describe, it, expect } from 'vitest';
import {
  unwrapCombobox,
  flattenOrgChart,
  stripHtml,
  toIntOrEmpty,
  toIsoDate,
} from '../normalize';

describe('unwrapCombobox', () => {
  it('returns the .text from a combobox object', () => {
    expect(unwrapCombobox({ value: 64, text: 'Normal' })).toBe('Normal');
  });

  it('returns empty string for an empty/undefined value', () => {
    expect(unwrapCombobox(undefined)).toBe('');
    expect(unwrapCombobox(null)).toBe('');
    expect(unwrapCombobox('')).toBe('');
  });

  it('returns the original string when already a string', () => {
    expect(unwrapCombobox('Already a string')).toBe('Already a string');
  });
});

describe('flattenOrgChart', () => {
  it('returns the .value from a single-entry array', () => {
    expect(
      flattenOrgChart([{ type: 1, id: 14, value: 'Anna Huk' }]),
    ).toBe('Anna Huk');
  });

  it('joins multiple entries with commas', () => {
    expect(
      flattenOrgChart([
        { type: 1, id: 14, value: 'Anna Huk' },
        { type: 2, id: 15, value: 'QA Team' },
      ]),
    ).toBe('Anna Huk, QA Team');
  });

  it('returns empty string for empty/undefined input', () => {
    expect(flattenOrgChart([])).toBe('');
    expect(flattenOrgChart(undefined)).toBe('');
    expect(flattenOrgChart(null)).toBe('');
  });
});

describe('stripHtml', () => {
  it('strips <div> and <p> tags but keeps text', () => {
    expect(stripHtml('<div><p>Hello</p> world</div>')).toBe('Hello world');
  });

  it('collapses whitespace', () => {
    expect(stripHtml('<div>foo   <br>  bar</div>')).toBe('foo bar');
  });

  it('returns empty string for empty/undefined input', () => {
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml('')).toBe('');
  });

  it('decodes common HTML entities', () => {
    // &nbsp; -> regular space, then whitespace collapse merges adjacent spaces
    expect(stripHtml('&amp; &lt;tag&gt; &nbsp;ok')).toBe('& <tag> ok');
  });
});

describe('toIntOrEmpty', () => {
  it('converts numeric floats like 1.0 to 1', () => {
    expect(toIntOrEmpty(1.0)).toBe(1);
    expect(toIntOrEmpty(213)).toBe(213);
  });

  it('parses numeric strings', () => {
    expect(toIntOrEmpty('42')).toBe(42);
  });

  it('returns empty string for empty/undefined/non-numeric', () => {
    expect(toIntOrEmpty('')).toBe('');
    expect(toIntOrEmpty(undefined)).toBe('');
    expect(toIntOrEmpty('not a number')).toBe('');
  });
});

describe('toIsoDate', () => {
  it('converts US-format BizzMine dates to ISO 8601', () => {
    // BizzMine: "1/24/2022 12:48:45 PM +00:00"
    const result = toIsoDate('1/24/2022 12:48:45 PM +00:00');
    expect(result).toBe('2022-01-24T12:48:45.000Z');
  });

  it('passes through ISO 8601 unchanged-shape', () => {
    expect(toIsoDate('2022-11-30T15:38:05.2395774+00:00')).toBe(
      '2022-11-30T15:38:05.239Z',
    );
  });

  it('returns empty string for empty/undefined', () => {
    expect(toIsoDate('')).toBe('');
    expect(toIsoDate(undefined)).toBe('');
  });

  it('returns empty string for unparseable input', () => {
    expect(toIsoDate('not a date')).toBe('');
  });
});
