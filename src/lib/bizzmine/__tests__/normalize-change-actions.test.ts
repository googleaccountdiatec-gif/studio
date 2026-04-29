import { describe, it, expect } from 'vitest';
import {
  normalizeChangeActionRecord,
  normalizeChangeActionInstances,
  classifyChangeActionPhase,
} from '../normalize/change-actions';
import type { StepMap } from '../steps';
import type { RawInstance } from '../types';

const stepMap: StepMap = new Map([
  [100, 'Action Required'],
  [101, 'Action Review'],
  [102, 'QA Approval'],
  [103, 'Closed'],
]);

const sample: RawInstance = {
  Change_Actions_Change_ActionID: 1,
  Change_Actions_Required: 'Create pre-printed labels',
  Change_Actions_Responsible: [{ type: 1, id: 12, value: 'Johanna Lindskog Frydendal' }],
  Change_Actions_Deadline: '1/31/2022 12:00:00 AM +00:00',
  Change_Actions_PendingSteps: '',
  Change_Actions_RegistrationTime: '1/19/2022 9:04:00 PM +00:00',
  Change_Actions_RegisteredBy: [{ type: 1, id: 14, value: 'Anna Huk' }],
  Change_Actions_CompletedOn: '2/11/2022 8:15:27 AM +00:00',
  Change_Actions_Status: 3,
  Change_Actions_Approve: { value: 268, text: 'Approved' },
  Change_Actions_ActionReview: { value: 563, text: 'Action completed' },
  Change_Actions_CommentsChangeAction: 'Pre-printed label completed',
  Change_Management: [
    {
      Change_Management_CMID: 10,
      Change_Management_CM_ChangeTitle: 'Extending tank medium shelf life',
    },
  ],
};

describe('normalizeChangeActionRecord — base mapping', () => {
  it('maps core CSV-header fields', () => {
    const r = normalizeChangeActionRecord(sample);
    expect(r['Change_ActionID']).toBe('1');
    expect(r['Action required prior to change']).toBe('Create pre-printed labels');
    expect(r['Responsible']).toBe('Johanna Lindskog Frydendal');
    expect(r['Deadline']).toBe('2022-01-31T00:00:00.000Z');
    expect(r['Registration Time']).toBe('2022-01-19T21:04:00.000Z');
    expect(r['Completed On']).toBe('2022-02-11T08:15:27.000Z');
    expect(r['Approve']).toBe('Approved');
  });

  it('hoists Change Title + CMID from the linked Change_Management sub-collection', () => {
    const r = normalizeChangeActionRecord(sample);
    expect(r['Change ID (CMID)']).toBe('10');
    expect(r['Change Title']).toBe('Extending tank medium shelf life');
  });

  it('handles missing Change_Management sub-collection gracefully', () => {
    const r = normalizeChangeActionRecord({ ...sample, Change_Management: undefined });
    expect(r['Change ID (CMID)']).toBe('');
    expect(r['Change Title']).toBe('');
  });
});

describe('classifyChangeActionPhase', () => {
  it('returns closed for CompletedOn set or empty pending step', () => {
    expect(classifyChangeActionPhase('Action Required', '2024-01-01T00:00:00.000Z')).toBe('closed');
    expect(classifyChangeActionPhase('', '')).toBe('closed');
  });

  it('returns pending_review for review/approval steps', () => {
    expect(classifyChangeActionPhase('Action Review', '')).toBe('pending_review');
    expect(classifyChangeActionPhase('QA Approval', '')).toBe('pending_review');
  });

  it('returns pending_action for action-execution steps', () => {
    expect(classifyChangeActionPhase('Action Required', '')).toBe('pending_action');
  });

  it('returns other for unrecognized step names', () => {
    expect(classifyChangeActionPhase('Mystery', '')).toBe('other');
  });
});

describe('normalizeChangeActionRecord — step ID resolution', () => {
  it('resolves a numeric step ID and classifies Phase', () => {
    const raw: RawInstance = {
      ...sample,
      Change_Actions_PendingSteps: 100,
      Change_Actions_CompletedOn: '',
    };
    const r = normalizeChangeActionRecord(raw, stepMap);
    expect(r['Pending Steps']).toBe('Action Required');
    expect(r['Phase']).toBe('pending_action');
  });

  it('falls back to passthrough when no stepMap provided', () => {
    const raw: RawInstance = {
      ...sample,
      Change_Actions_PendingSteps: 'Action Review',
      Change_Actions_CompletedOn: '',
    };
    const r = normalizeChangeActionRecord(raw);
    expect(r['Pending Steps']).toBe('Action Review');
    expect(r['Phase']).toBe('pending_review');
  });
});

describe('normalizeChangeActionInstances', () => {
  it('maps an array', () => {
    const out = normalizeChangeActionInstances([sample, sample]);
    expect(out).toHaveLength(2);
    expect(out[0]['Change_ActionID']).toBe('1');
  });

  it('returns empty array for empty input', () => {
    expect(normalizeChangeActionInstances([])).toEqual([]);
  });
});
