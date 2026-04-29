import { describe, it, expect } from 'vitest';
import {
  normalizeA004Record,
  normalizeA007Record,
  normalizeTrainingInstances,
} from '../normalize/training';
import type { RawInstance } from '../types';

const a004: RawInstance = {
  A004_A004ID: 1,
  A004_Trainee: [{ type: 1, id: 39, value: 'Yngve Ness' }],
  A004_Position: 'Production Engineer',
  A004_Deadlineforcompletingtraining: '8/31/2022 12:00:00 AM +00:00',
  A004_PendingSteps: '',
  A004_CompletedOn: '6/24/2022 10:50:27 AM +00:00',
  A004_Finaltrainingapproval: { value: 100, text: 'Approved' },
  A004_RegistrationTime: '6/7/2022 11:46:25 AM +00:00',
  Trainingmodules: [
    { Trainingmodules_Title: 'Cleaning and Maintenance routines' },
  ],
};

const a007: RawInstance = {
  A007_A007ID: 1,
  A007_Trainee: [{ type: 1, id: 39, value: 'Yngve Ness' }],
  A007_Position: 'Production engineer',
  A007_Deadlinefortrainingexecution: '8/31/2022 12:00:00 AM +00:00',
  A007_PendingSteps: '',
  A007_CompletedOn: '8/17/2022 1:26:06 PM +00:00',
  A007_Trainingapproval: '8/17/2022 12:00:00 AM +00:00',
  A007_RegistrationTime: '6/7/2022 11:17:26 AM +00:00',
  Modules: [{ Modules_Title: 'On boarding process' }],
};

describe('normalizeA004Record', () => {
  it('maps to CSV-header shape with Training category="Regular"', () => {
    const r = normalizeA004Record(a004);
    expect(r['Record training ID']).toBe('A004-1');
    expect(r['Title']).toBe('Cleaning and Maintenance routines');
    expect(r['Trainee']).toBe('Yngve Ness');
    expect(r['Training category']).toBe('Regular');
    expect(r['Deadline for completing training']).toBe('2022-08-31T00:00:00.000Z');
    expect(r['Final training approval']).toBe('Approved');
    expect(r['Pending Steps']).toBe('');
    expect(r['Completed On']).toBe('2022-06-24T10:50:27.000Z');
    expect(r['Position']).toBe('Production Engineer');
  });

  it('falls back to Position as Title when sub-collection title is missing', () => {
    const r = normalizeA004Record({ ...a004, Trainingmodules: undefined });
    expect(r['Title']).toBe('Production Engineer');
  });
});

describe('normalizeA007Record', () => {
  it('maps to CSV-header shape with Training category="Introduction"', () => {
    const r = normalizeA007Record(a007);
    expect(r['Record training ID']).toBe('A007-1');
    expect(r['Title']).toBe('On boarding process');
    expect(r['Trainee']).toBe('Yngve Ness');
    expect(r['Training category']).toBe('Introduction');
    expect(r['Deadline for completing training']).toBe('2022-08-31T00:00:00.000Z');
    expect(r['Pending Steps']).toBe('');
    expect(r['Completed On']).toBe('2022-08-17T13:26:06.000Z');
    expect(r['Position']).toBe('Production engineer');
  });

  it('falls back to "Introduction Training" as Title when sub-collection missing', () => {
    const r = normalizeA007Record({ ...a007, Modules: undefined, A007_Position: '' });
    expect(r['Title']).toBe('Introduction Training');
  });
});

describe('normalizeTrainingInstances — merged A004 + A007', () => {
  it('merges both streams into one ordered array', () => {
    const out = normalizeTrainingInstances([a004, a004], [a007]);
    expect(out).toHaveLength(3);
    const cats = out.map((r) => r['Training category']);
    expect(cats).toContain('Regular');
    expect(cats).toContain('Introduction');
  });

  it('produces unique Record training IDs across the two streams', () => {
    const out = normalizeTrainingInstances([a004], [a007]);
    expect(out[0]['Record training ID']).toBe('A004-1');
    expect(out[1]['Record training ID']).toBe('A007-1');
  });

  it('handles empty inputs', () => {
    expect(normalizeTrainingInstances([], [])).toEqual([]);
  });
});
