import { describe, it, expect } from 'vitest';
import fixtureSingle from '../fixtures/capa-instance.fixture.json';
import fixtureArray from '../fixtures/capa-instance-array.fixture.json';
import {
  normalizeCapaRecord,
  normalizeCapaInstances,
  classifyCapaPhase,
} from '../normalize/capa';
import type { StepMap } from '../steps';
import type { RawInstance } from '../types';

// Sample step map covering both old and current CAPA workflow revisions
// (mirrors the live tenant — see api/probe/capa-steps.json).
const stepMap: StepMap = new Map([
  [32, 'Start'],
  [33, 'CAPA Execution'],
  [38, 'CAPA Effectiveness Evaluation'],
  [499, 'CAPA Effectiveness Evaluation'],
  [1252, 'CAPA Execution'],
  [1253, 'CAPA Effectiveness Evaluation'],
  [1413, 'CAPA Execution'],
  [1414, 'CAPA Effectiveness Evaluation'],
  [1428, 'CAPA Effectiveness Evaluation'],
  [1432, 'CAPA Execution - QA Approval'],
  [1435, 'CAPA Initiation'],
  [1436, 'CAPA Gateway 1'],
  [1438, 'CAPA Initiation - verification'],
]);

describe('normalizeCapaRecord — base mapping', () => {
  it('maps core fields to CSV-header shape', () => {
    const r = normalizeCapaRecord(fixtureSingle as RawInstance);
    expect(r['CAPA ID']).toBe('1');
    expect(r['Title']).toBe('Sample CAPA title');
    expect(r['Due Date']).toBe('2022-03-31T00:00:00.000Z');
    expect(r['Assigned To']).toBe('Test User Alpha');
    expect(r['Priority']).toBe('Normal');
    expect(r['Category of Corrective Action']).toBe('System /process');
    expect(r['Action taken']).toBe('Action performed');
    expect(r['Completed On']).toBe('2022-11-24T19:22:17.000Z');
  });

  it('strips HTML from memo fields', () => {
    const r = normalizeCapaRecord(fixtureSingle as RawInstance);
    expect(r['Action plan']).not.toContain('<p>');
    expect(r['Action plan']).not.toContain('<div>');
    expect(r['Expected results of Action']).not.toContain('<div>');
  });

  it('passes through embedded sub-collections under _subCollections', () => {
    const r = normalizeCapaRecord(fixtureSingle as RawInstance);
    expect(Array.isArray(r._subCollections?.NonConformances)).toBe(true);
    expect(r._subCollections?.NonConformances?.[0]?.NonConformances_NC_Title).toBe(
      'Linked NC title',
    );
  });

  it('handles a record with empty CompletedOn (still pending)', () => {
    const pending = (fixtureArray as RawInstance[])[1];
    const r = normalizeCapaRecord(pending);
    expect(r['Completed On']).toBe('');
    // Without stepMap, falls back to passthrough — string "CAPA Execution"
    expect(r['Pending Steps']).toBe('CAPA Execution');
    expect(r['Deadline for effectiveness check']).toBe('2024-08-15T00:00:00.000Z');
  });

  it('joins multi-entry OrgChart fields with commas', () => {
    const multi = {
      ...(fixtureArray as RawInstance[])[1],
      CAPA_Proposedresponsible: [
        { type: 1, id: 14, value: 'Test User Beta' },
        { type: 2, id: 99, value: 'QA Team' },
      ],
    };
    const r = normalizeCapaRecord(multi);
    expect(r['Proposed responsible']).toBe('Test User Beta, QA Team');
  });
});

describe('normalizeCapaRecord — step ID resolution', () => {
  it('resolves a numeric step ID to a name via stepMap', () => {
    const raw: RawInstance = {
      CAPA_CAPAID: 100,
      CAPA_PendingSteps: 1413, // numeric ID — what the live API returns
      CAPA_DueDate: '5/1/2025 12:00:00 AM +00:00',
      CAPA_CompletedOn: '',
    };
    const r = normalizeCapaRecord(raw, stepMap);
    expect(r['Pending Steps']).toBe('CAPA Execution');
  });

  it('resolves an effectiveness step ID and classifies phase correctly', () => {
    const raw: RawInstance = {
      CAPA_CAPAID: 101,
      CAPA_PendingSteps: 1414,
      CAPA_DueDate: '5/1/2025 12:00:00 AM +00:00',
      CAPA_Deadlineforeffectivenesscheck: '8/1/2025 12:00:00 AM +00:00',
      CAPA_CompletedOn: '',
    };
    const r = normalizeCapaRecord(raw, stepMap);
    expect(r['Pending Steps']).toBe('CAPA Effectiveness Evaluation');
    expect(r['Phase']).toBe('effectiveness');
  });

  it('falls back to passthrough when no stepMap provided (legacy CSV path)', () => {
    const raw: RawInstance = {
      CAPA_CAPAID: 102,
      CAPA_PendingSteps: 'CAPA Execution', // CSV-style name
      CAPA_DueDate: '5/1/2025 12:00:00 AM +00:00',
      CAPA_CompletedOn: '',
    };
    const r = normalizeCapaRecord(raw); // no stepMap
    expect(r['Pending Steps']).toBe('CAPA Execution');
    expect(r['Phase']).toBe('execution');
  });
});

describe('classifyCapaPhase', () => {
  it('returns closed when CompletedOn is set', () => {
    expect(classifyCapaPhase('CAPA Execution', '2024-01-01T00:00:00.000Z')).toBe('closed');
  });

  it('returns closed when no pending step name', () => {
    expect(classifyCapaPhase('', '')).toBe('closed');
    expect(classifyCapaPhase('   ', '')).toBe('closed');
  });

  it('returns effectiveness for any "Effectiveness" step', () => {
    expect(classifyCapaPhase('CAPA Effectiveness Evaluation', '')).toBe('effectiveness');
    expect(classifyCapaPhase('CAPA Effectiveness check - QA Approval', '')).toBe('effectiveness');
  });

  it('returns execution for any "Execution" step (including QA Approval)', () => {
    expect(classifyCapaPhase('CAPA Execution', '')).toBe('execution');
    expect(classifyCapaPhase('CAPA Execution - QA Approval', '')).toBe('execution');
  });

  it('returns initiation for Gateway / Initiation / Verification', () => {
    expect(classifyCapaPhase('CAPA Initiation', '')).toBe('initiation');
    expect(classifyCapaPhase('CAPA Gateway 4', '')).toBe('initiation');
    expect(classifyCapaPhase('CAPA Initiation - verification', '')).toBe('initiation');
  });

  it('returns other for anything else', () => {
    expect(classifyCapaPhase('Mystery Step', '')).toBe('other');
  });
});

describe('Effective Deadline computation', () => {
  it('uses Effectiveness deadline when phase=effectiveness', () => {
    const raw: RawInstance = {
      CAPA_PendingSteps: 1414,
      CAPA_DueDate: '5/1/2025 12:00:00 AM +00:00',
      CAPA_Deadlineforeffectivenesscheck: '8/1/2025 12:00:00 AM +00:00',
      CAPA_CompletedOn: '',
    };
    const r = normalizeCapaRecord(raw, stepMap);
    expect(r['Effective Deadline']).toBe('2025-08-01T00:00:00.000Z');
  });

  it('falls back to Due Date when Effectiveness deadline is empty in effectiveness phase', () => {
    const raw: RawInstance = {
      CAPA_PendingSteps: 1414,
      CAPA_DueDate: '5/1/2025 12:00:00 AM +00:00',
      CAPA_Deadlineforeffectivenesscheck: '',
      CAPA_CompletedOn: '',
    };
    const r = normalizeCapaRecord(raw, stepMap);
    expect(r['Effective Deadline']).toBe('2025-05-01T00:00:00.000Z');
  });

  it('uses Due Date when phase=execution', () => {
    const raw: RawInstance = {
      CAPA_PendingSteps: 1413,
      CAPA_DueDate: '5/1/2025 12:00:00 AM +00:00',
      CAPA_Deadlineforeffectivenesscheck: '8/1/2025 12:00:00 AM +00:00',
      CAPA_CompletedOn: '',
    };
    const r = normalizeCapaRecord(raw, stepMap);
    expect(r['Effective Deadline']).toBe('2025-05-01T00:00:00.000Z');
  });

  it('returns empty string when both deadlines are missing', () => {
    const raw: RawInstance = {
      CAPA_PendingSteps: 1413,
      CAPA_DueDate: '',
      CAPA_Deadlineforeffectivenesscheck: '',
      CAPA_CompletedOn: '',
    };
    const r = normalizeCapaRecord(raw, stepMap);
    expect(r['Effective Deadline']).toBe('');
  });
});

describe('normalizeCapaInstances', () => {
  it('maps an array of records', () => {
    const out = normalizeCapaInstances(fixtureArray as RawInstance[]);
    expect(out).toHaveLength(2);
    expect(out[0]['Title']).toBe('Sample CAPA title');
    expect(out[1]['Title']).toBe('Second CAPA');
  });

  it('returns empty array for empty input', () => {
    expect(normalizeCapaInstances([])).toEqual([]);
  });

  it('threads stepMap through to every record', () => {
    const raws: RawInstance[] = [
      { CAPA_CAPAID: 1, CAPA_PendingSteps: 1413, CAPA_DueDate: '', CAPA_CompletedOn: '' },
      { CAPA_CAPAID: 2, CAPA_PendingSteps: 1414, CAPA_DueDate: '', CAPA_CompletedOn: '' },
    ];
    const out = normalizeCapaInstances(raws, stepMap);
    expect(out[0]['Pending Steps']).toBe('CAPA Execution');
    expect(out[0]['Phase']).toBe('execution');
    expect(out[1]['Pending Steps']).toBe('CAPA Effectiveness Evaluation');
    expect(out[1]['Phase']).toBe('effectiveness');
  });
});
