import { describe, it, expect } from 'vitest';
import {
  getReleasedBatchNumbers,
  getDownstreamNotReleased,
  daysSince,
} from '../filter';

describe('getReleasedBatchNumbers', () => {
  it('collects Batch number AND Batch number from list', () => {
    const set = getReleasedBatchNumbers([
      { 'Batch number': 'B100', 'Batch number from list': 'B100-FINAL' },
      { 'Batch number': 'B200', 'Batch number from list': '' },
      { 'Batch number': '', 'Batch number from list': 'B300' },
    ]);
    expect(set.has('B100')).toBe(true);
    expect(set.has('B100-FINAL')).toBe(true);
    expect(set.has('B200')).toBe(true);
    expect(set.has('B300')).toBe(true);
    expect(set.size).toBe(4);
  });

  it('trims whitespace and ignores empty', () => {
    const set = getReleasedBatchNumbers([
      { 'Batch number': '  B500  ' },
      { 'Batch number': '   ' },
    ]);
    expect(set.has('B500')).toBe(true);
    expect(set.size).toBe(1);
  });

  it('returns an empty set for empty input', () => {
    expect(getReleasedBatchNumbers([]).size).toBe(0);
  });
});

describe('getDownstreamNotReleased', () => {
  const sample = [
    {
      'BRID': '1',
      'Batch number': 'B9441',
      'Is Upstream': true,
      'Registration Time': '2025-12-03T07:00:00.000Z',
    },
    {
      'BRID': '2',
      'Batch number': 'B9466',
      'Is Upstream': false,
      'Registration Time': '2025-12-10T08:00:00.000Z',
    },
    {
      'BRID': '3',
      'Batch number': 'B9469',
      'Is Upstream': false,
      'Registration Time': '2025-12-05T08:00:00.000Z',
    },
    {
      'BRID': '4',
      'Batch number': 'B9470',
      'Is Upstream': false,
      'Registration Time': '2025-12-12T08:00:00.000Z',
    },
  ];

  it('filters to downstream records not in the released set', () => {
    const released = new Set(['B9470']); // one of the downstream is released
    const out = getDownstreamNotReleased(sample, released);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r['Batch number'])).toEqual(['B9469', 'B9466']);
  });

  it('excludes upstream records even when not in the released set', () => {
    const released = new Set<string>();
    const out = getDownstreamNotReleased(sample, released);
    expect(out.every((r) => r['Is Upstream'] === false)).toBe(true);
  });

  it('sorts oldest-first by Registration Time', () => {
    const out = getDownstreamNotReleased(sample, new Set());
    expect(out.map((r) => r['Batch number'])).toEqual(['B9469', 'B9466', 'B9470']);
  });

  it('places records with unparseable Registration Time at the end', () => {
    const withBadDate = [
      ...sample,
      { 'BRID': '5', 'Batch number': 'B9999', 'Is Upstream': false, 'Registration Time': '' },
    ];
    const out = getDownstreamNotReleased(withBadDate, new Set());
    expect(out[out.length - 1]['Batch number']).toBe('B9999');
  });

  it('skips records with empty batch numbers', () => {
    const out = getDownstreamNotReleased(
      [{ 'Batch number': '', 'Is Upstream': false, 'Registration Time': '' }],
      new Set(),
    );
    expect(out).toHaveLength(0);
  });
});

describe('daysSince', () => {
  it('computes whole days from ISO timestamp', () => {
    const ref = new Date('2026-04-29T00:00:00.000Z');
    expect(daysSince('2026-04-22T00:00:00.000Z', ref)).toBe(7);
    expect(daysSince('2026-04-29T00:00:00.000Z', ref)).toBe(0);
  });

  it('returns null for invalid input', () => {
    expect(daysSince('', new Date())).toBeNull();
    expect(daysSince('not a date', new Date())).toBeNull();
    expect(daysSince(undefined, new Date())).toBeNull();
    expect(daysSince(null, new Date())).toBeNull();
  });
});
