import { describe, it, expect } from 'vitest';
import {
  normalizeChangeRecord,
  normalizeChangeInstances,
  classifyChangePhase,
} from '../normalize/changes';
import type { StepMap } from '../steps';
import type { RawInstance } from '../types';

const stepMap: StepMap = new Map([
  [200, 'Change Proposal Review'],
  [201, 'Change Planning'],
  [202, 'Implementation'],
  [203, 'Change Review'],
  [204, 'Final Approval'],
]);

const sample: RawInstance = {
  CM_CMID: 1,
  CM_ChangeTitle: 'Extending tank medium shelf life',
  CM_Category: { value: 100, text: 'Major' },
  CM_PendingSteps: '',
  CM_Changefrom: '<p>12 months</p>',
  CM_Changeto: '<p>18 months</p>',
  CM_JustificationforChange: '<p>Stability data supports it</p>',
  CM_AdditionalInformation: '<p>Impacted: production</p>',
  CM_Comments: '<p>Plan for next quarter</p>',
  CM_PlannedDate: '6/1/2025 12:00:00 AM +00:00',
  CM_ImplementationDate: '6/15/2025 12:00:00 AM +00:00',
  CM_FinalChangeStatus: { value: 110, text: 'Approved' },
  CM_ChangeRequestor: [{ type: 1, id: 12, value: 'Johanna Lindskog Frydendal' }],
  CM_DepartmentManager: [{ type: 1, id: 9, value: 'Marthe Heldal' }],
  CM_RegisteredBy: [{ type: 1, id: 14, value: 'Anna Huk' }],
  CM_RegistrationTime: '5/1/2025 9:00:00 AM +00:00',
  CM_CompletedOn: '7/1/2025 10:00:00 AM +00:00',
  CM_Status: 3,
};

describe('normalizeChangeRecord — base mapping', () => {
  it('maps CSV-header fields', () => {
    const r = normalizeChangeRecord(sample);
    expect(r['CMID']).toBe('1');
    expect(r['Change Title']).toBe('Extending tank medium shelf life');
    expect(r['Category']).toBe('Major');
    expect(r['Change from:']).toBe('12 months');
    expect(r['Change to']).toBe('18 months');
    expect(r['Justification for Change']).toBe('Stability data supports it');
    expect(r['Impacted areas of the organization and risk assessment']).toBe('Impacted: production');
    expect(r['Planned Implementation Date']).toBe('2025-06-01T00:00:00.000Z');
    expect(r['Implementation Date']).toBe('2025-06-15T00:00:00.000Z');
    expect(r['Final Change Status']).toBe('Approved');
    expect(r['Change Requestor']).toBe('Johanna Lindskog Frydendal');
    expect(r['Department Manager']).toBe('Marthe Heldal');
    expect(r['Registered By']).toBe('Anna Huk');
    expect(r['Completed On']).toBe('2025-07-01T10:00:00.000Z');
  });

  it('strips HTML from memo fields', () => {
    const r = normalizeChangeRecord(sample);
    expect(r['Change from:']).not.toContain('<p>');
    expect(r['Justification for Change']).not.toContain('<p>');
  });
});

describe('classifyChangePhase', () => {
  it('classifies review/approval/proposal as pending_review', () => {
    expect(classifyChangePhase('Change Proposal Review', '')).toBe('pending_review');
    expect(classifyChangePhase('Final Approval', '')).toBe('pending_review');
    expect(classifyChangePhase('Change Review', '')).toBe('pending_review');
  });

  it('classifies planning/implementation as pending_implementation', () => {
    expect(classifyChangePhase('Change Planning', '')).toBe('pending_implementation');
    expect(classifyChangePhase('Implementation', '')).toBe('pending_implementation');
  });

  it('returns closed when CompletedOn set or no pending step', () => {
    expect(classifyChangePhase('Change Review', '2024-01-01T00:00:00.000Z')).toBe('closed');
    expect(classifyChangePhase('', '')).toBe('closed');
  });
});

describe('normalizeChangeRecord — step ID resolution', () => {
  it('resolves numeric step ID and classifies Phase', () => {
    const raw: RawInstance = { ...sample, CM_PendingSteps: 200, CM_CompletedOn: '' };
    const r = normalizeChangeRecord(raw, stepMap);
    expect(r['Pending Steps']).toBe('Change Proposal Review');
    expect(r['Phase']).toBe('pending_review');
  });

  it('falls back to passthrough when no stepMap', () => {
    const raw: RawInstance = { ...sample, CM_PendingSteps: 'Implementation', CM_CompletedOn: '' };
    const r = normalizeChangeRecord(raw);
    expect(r['Pending Steps']).toBe('Implementation');
    expect(r['Phase']).toBe('pending_implementation');
  });
});

describe('normalizeChangeInstances', () => {
  it('maps an array', () => {
    expect(normalizeChangeInstances([sample]).length).toBe(1);
    expect(normalizeChangeInstances([])).toEqual([]);
  });
});
