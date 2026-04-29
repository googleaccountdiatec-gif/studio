import { describe, it, expect } from 'vitest';
import {
  normalizeNcRecord,
  normalizeNcInstances,
  classifyNcPhase,
} from '../normalize/nc';
import type { StepMap } from '../steps';
import type { RawInstance } from '../types';

const ncStepMap: StepMap = new Map([
  [1666, 'Registration'],
  [1667, 'NC Gateway1'],
  [1668, 'Classification'],
  [1669, 'NC Gateway2'],
  [1670, 'Investigation and root cause analysis'],
  [1671, 'Technical verification'],
  [1672, 'NC Gateway4'],
  [1673, 'QA approval'],
  [1674, 'NC Gateway5'],
  [1675, 'NC Gateway3'],
  [1676, 'Stop'],
]);

const sampleNc: RawInstance = {
  NC_NCID: 1,
  NC_Title: 'The control batch was not tested',
  NC_Classification: { value: 1224, text: 'Low risk' },
  NC_PendingSteps: '',
  NC_CaseWorker: [{ type: 1, id: 14, value: 'Anna Huk' }],
  NC_Status: 3,
  NC_RegistrationTime: '12/14/2021 9:30:00 AM +00:00',
  NC_RegisteredBy: [{ type: 1, id: 14, value: 'Anna Huk' }],
  NC_Reoccurrence: { value: 200, text: 'No' },
  NC_CompletedOn: '2/28/2022 11:35:00 AM +00:00',
  NC_NCRClassification: { value: 164, text: 'Minor' },
  NC_ImpactOther: 'NA',
  NC_Investigationsummary: '<p>Investigation done</p>',
  NC_ImpactAssessment: '<div>Impact assessed</div>',
  NC_RootcauseDescription: '<p>Root cause</p>',
  NC_Classificationjustification: '<p>Justified</p>',
  NC_Segregation: '1',
  NC_Discardedproduct: '',
  NC_Startednewproduction: '1',
  NC_Repeatedoperation: '',
  NC_Dateoccurred: '12/14/2021 12:00:00 AM +00:00',
  NC_DeadlineInvestigation: '2/11/2022 12:00:00 AM +00:00',
};

describe('normalizeNcRecord — base mapping', () => {
  it('maps core CSV-header fields', () => {
    const r = normalizeNcRecord(sampleNc);
    expect(r['Id']).toBe('1');
    expect(r['Non Conformance Title']).toBe('The control batch was not tested');
    expect(r['Classification']).toBe('Low risk');
    expect(r['Case Worker']).toBe('Anna Huk');
    expect(r['Registration Time']).toBe('2021-12-14T09:30:00.000Z');
    expect(r['Registered By']).toBe('Anna Huk');
    expect(r['Reoccurrence']).toBe('No');
    expect(r['Completed On']).toBe('2022-02-28T11:35:00.000Z');
  });

  it('strips HTML from memo fields', () => {
    const r = normalizeNcRecord(sampleNc);
    expect(r['Investigation summary']).toBe('Investigation done');
    expect(r['Impact Assessment']).toBe('Impact assessed');
    expect(r['Root cause description']).toBe('Root cause');
  });

  it('passes through Boolean checkbox values as "1" / "" (dashboard uses isTruthy)', () => {
    const r = normalizeNcRecord(sampleNc);
    expect(r['Segregation of product']).toBe('1');
    expect(r['Discarded product']).toBe('');
    expect(r['Started new production']).toBe('1');
    expect(r['Repeated operation/analysis']).toBe('');
  });

  it('emits a string Status (numeric code passthrough — EnumList resolution is a follow-up)', () => {
    const r = normalizeNcRecord(sampleNc);
    expect(r['Status']).toBe('3');
  });
});

describe('normalizeNcRecord — step ID resolution + Phase', () => {
  it('resolves numeric Pending Steps ID via step map and classifies Phase', () => {
    const raw: RawInstance = {
      ...sampleNc,
      NC_PendingSteps: 1670, // Investigation and root cause analysis
      NC_CompletedOn: '',
    };
    const r = normalizeNcRecord(raw, ncStepMap);
    expect(r['Pending Steps']).toBe('Investigation and root cause analysis');
    expect(r['Phase']).toBe('investigation');
  });

  it('classifies QA approval phase', () => {
    const raw: RawInstance = {
      ...sampleNc,
      NC_PendingSteps: 1673,
      NC_CompletedOn: '',
    };
    const r = normalizeNcRecord(raw, ncStepMap);
    expect(r['Phase']).toBe('qa_approval');
  });

  it('classifies verification phase', () => {
    const raw: RawInstance = {
      ...sampleNc,
      NC_PendingSteps: 1671,
      NC_CompletedOn: '',
    };
    const r = normalizeNcRecord(raw, ncStepMap);
    expect(r['Phase']).toBe('verification');
  });

  it('classifies registration / classification / gateway as "registration"', () => {
    expect(classifyNcPhase('Registration', '')).toBe('registration');
    expect(classifyNcPhase('Classification', '')).toBe('registration');
    expect(classifyNcPhase('NC Gateway1', '')).toBe('registration');
    expect(classifyNcPhase('NC Gateway5', '')).toBe('registration');
  });

  it('marks closed when CompletedOn is set OR pending step is empty', () => {
    expect(classifyNcPhase('Investigation and root cause analysis', '2024-01-01T00:00:00.000Z')).toBe('closed');
    expect(classifyNcPhase('', '')).toBe('closed');
  });

  it('falls back to passthrough when no stepMap provided', () => {
    const raw: RawInstance = {
      ...sampleNc,
      NC_PendingSteps: 'Investigation and root cause analysis',
      NC_CompletedOn: '',
    };
    const r = normalizeNcRecord(raw);
    expect(r['Pending Steps']).toBe('Investigation and root cause analysis');
    expect(r['Phase']).toBe('investigation');
  });
});

describe('normalizeNcRecord — Effective Deadline', () => {
  it('uses DeadlineInvestigation in investigation/registration phase', () => {
    const raw: RawInstance = {
      ...sampleNc,
      NC_PendingSteps: 1670,
      NC_DeadlineInvestigation: '5/1/2025 12:00:00 AM +00:00',
      NC_CompletedOn: '',
    };
    const r = normalizeNcRecord(raw, ncStepMap);
    expect(r['Effective Deadline']).toBe('2025-05-01T00:00:00.000Z');
  });

  it('returns empty string when no deadline available and not closed', () => {
    const raw: RawInstance = {
      ...sampleNc,
      NC_PendingSteps: 1670,
      NC_DeadlineInvestigation: '',
      NC_CompletedOn: '',
    };
    const r = normalizeNcRecord(raw, ncStepMap);
    expect(r['Effective Deadline']).toBe('');
  });
});

describe('normalizeNcInstances', () => {
  it('threads stepMap through to every record', () => {
    const raws: RawInstance[] = [
      { NC_NCID: 1, NC_PendingSteps: 1670, NC_CompletedOn: '' },
      { NC_NCID: 2, NC_PendingSteps: 1673, NC_CompletedOn: '' },
    ];
    const out = normalizeNcInstances(raws, ncStepMap);
    expect(out[0]['Phase']).toBe('investigation');
    expect(out[1]['Phase']).toBe('qa_approval');
  });
});
