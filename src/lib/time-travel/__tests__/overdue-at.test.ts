import { describe, it, expect } from 'vitest';
import {
  wasOpenAndOverdueAt,
  countOverdueAt,
  overdueTrendSeries,
} from '../overdue-at';

interface Rec {
  Deadline?: string;
  CompletedOn?: string;
  RegistrationTime?: string;
}

const accessors = {
  getDeadline: (r: Rec) => r.Deadline,
  getCompletedOn: (r: Rec) => r.CompletedOn,
  getRegistrationTime: (r: Rec) => r.RegistrationTime,
};

const REF = new Date('2026-04-01T00:00:00.000Z');

describe('wasOpenAndOverdueAt', () => {
  it('flags an open record with a past deadline', () => {
    const r: Rec = {
      Deadline: '2026-03-01T00:00:00.000Z',
      RegistrationTime: '2026-02-01T00:00:00.000Z',
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(true);
  });

  it('does NOT flag a record completed before refDate', () => {
    const r: Rec = {
      Deadline: '2026-03-01T00:00:00.000Z',
      CompletedOn: '2026-03-15T00:00:00.000Z', // before REF
      RegistrationTime: '2026-02-01T00:00:00.000Z',
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(false);
  });

  it('flags a record completed AFTER refDate (was still open at refDate)', () => {
    const r: Rec = {
      Deadline: '2026-03-01T00:00:00.000Z',
      CompletedOn: '2026-04-15T00:00:00.000Z', // after REF
      RegistrationTime: '2026-02-01T00:00:00.000Z',
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(true);
  });

  it('does NOT flag a record completed exactly at refDate (matches isTaskOverdue)', () => {
    const r: Rec = {
      Deadline: '2026-03-01T00:00:00.000Z',
      CompletedOn: '2026-04-01T00:00:00.000Z', // === REF
      RegistrationTime: '2026-02-01T00:00:00.000Z',
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(false);
  });

  it('does NOT flag a record registered AFTER refDate (registration gate)', () => {
    const r: Rec = {
      Deadline: '2026-03-01T00:00:00.000Z',
      RegistrationTime: '2026-04-15T00:00:00.000Z', // after REF
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(false);
  });

  it('treats missing registration as always-existed (permissive fallback)', () => {
    const r: Rec = {
      Deadline: '2026-03-01T00:00:00.000Z',
      // no RegistrationTime
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(true);
  });

  it('does NOT flag a record with deadline AT refDate (must be strictly before)', () => {
    const r: Rec = {
      Deadline: '2026-04-01T00:00:00.000Z',
      RegistrationTime: '2026-02-01T00:00:00.000Z',
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(false);
  });

  it('does NOT flag a record with deadline AFTER refDate', () => {
    const r: Rec = {
      Deadline: '2026-05-01T00:00:00.000Z',
      RegistrationTime: '2026-02-01T00:00:00.000Z',
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(false);
  });

  it('does NOT flag a record with no deadline', () => {
    const r: Rec = {
      RegistrationTime: '2026-02-01T00:00:00.000Z',
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(false);
  });

  it('does NOT flag a record with an invalid deadline string', () => {
    const r: Rec = {
      Deadline: 'not a date',
      RegistrationTime: '2026-02-01T00:00:00.000Z',
    };
    expect(wasOpenAndOverdueAt(r, REF, accessors)).toBe(false);
  });

  it('skips registration gate when accessor not provided', () => {
    const minimalAcc = {
      getDeadline: (r: Rec) => r.Deadline,
      getCompletedOn: (r: Rec) => r.CompletedOn,
    };
    const r: Rec = {
      Deadline: '2026-03-01T00:00:00.000Z',
      RegistrationTime: '2026-04-15T00:00:00.000Z', // would normally exclude
    };
    // No registration gate — record is counted overdue
    expect(wasOpenAndOverdueAt(r, REF, minimalAcc)).toBe(true);
  });
});

describe('countOverdueAt', () => {
  it('counts records that were open & overdue at refDate', () => {
    const records: Rec[] = [
      // overdue: open, past deadline, registered before
      { Deadline: '2026-03-01T00:00:00.000Z', RegistrationTime: '2026-02-01T00:00:00.000Z' },
      // overdue: completed after refDate
      {
        Deadline: '2026-03-01T00:00:00.000Z',
        CompletedOn: '2026-04-15T00:00:00.000Z',
        RegistrationTime: '2026-02-01T00:00:00.000Z',
      },
      // not overdue: completed before refDate
      {
        Deadline: '2026-03-01T00:00:00.000Z',
        CompletedOn: '2026-03-15T00:00:00.000Z',
        RegistrationTime: '2026-02-01T00:00:00.000Z',
      },
      // not overdue: registered after refDate
      { Deadline: '2026-03-01T00:00:00.000Z', RegistrationTime: '2026-04-15T00:00:00.000Z' },
      // not overdue: no deadline
      { RegistrationTime: '2026-02-01T00:00:00.000Z' },
    ];
    expect(countOverdueAt(records, REF, accessors)).toBe(2);
  });

  it('returns 0 for empty input', () => {
    expect(countOverdueAt([], REF, accessors)).toBe(0);
  });
});

describe('overdueTrendSeries', () => {
  it('produces one point per refDate with the right count', () => {
    const records: Rec[] = [
      // Registered Feb, deadline March, never completed → overdue from March onward
      { Deadline: '2026-03-01T00:00:00.000Z', RegistrationTime: '2026-02-01T00:00:00.000Z' },
      // Registered Feb, deadline Feb, completed mid-March → overdue Feb→mid-March, then closed
      {
        Deadline: '2026-02-15T00:00:00.000Z',
        CompletedOn: '2026-03-15T00:00:00.000Z',
        RegistrationTime: '2026-02-01T00:00:00.000Z',
      },
    ];

    const dates = [
      new Date('2026-02-01T00:00:00.000Z'), // before any deadline
      new Date('2026-02-20T00:00:00.000Z'), // after first dl, before completion
      new Date('2026-03-10T00:00:00.000Z'), // first record overdue + second still pending past deadline
      new Date('2026-03-20T00:00:00.000Z'), // second now closed; first still pending past deadline
    ];

    const series = overdueTrendSeries(records, dates, accessors);
    expect(series.map((p) => p.count)).toEqual([0, 1, 2, 1]);
    expect(series.map((p) => p.refDate.toISOString())).toEqual(
      dates.map((d) => d.toISOString()),
    );
  });
});
