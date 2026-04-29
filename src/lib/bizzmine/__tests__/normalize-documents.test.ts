import { describe, it, expect } from 'vitest';
import {
  normalizeDocumentRecord,
  normalizeDocumentInstances,
  deriveDocumentFlow,
} from '../normalize/documents';
import type { StepMap } from '../steps';
import type { RawInstance } from '../types';

const stepMap: StepMap = new Map([
  [300, 'Document Review'],
  [301, 'QA Approval'],
]);

const sample: RawInstance = {
  DC_DCID: 1,
  DC_DocumentNumber: '0001.1',
  DC_DocumentPrefix: { value: 349, text: 'DOC' },
  DC_Title: 'Thawing and expansion of cells',
  DC_VersionDate: '10/18/2021 12:00:00 AM +00:00',
  DC_Version: '1.0',
  DC_MajorVersion: 1,
  DC_MinorVersion: 0,
  DC_DocumentFlow: '14',
  DC_PendingSteps: '',
  DC_CompletedOn: '10/18/2021 12:17:46 PM +00:00',
  DC_Author: [{ type: 1, id: 1, value: 'BizzMine Administrator' }],
  DC_RegisteredBy: [{ type: 1, id: 1, value: 'BizzMine Administrator' }],
  DC_RegistrationTime: '10/18/2021 12:17:46 PM +00:00',
  DC_DistributionList: [{ type: 2, id: 16, value: 'Production Team' }],
  DC_Responsible: [{ type: 1, id: 14, value: 'Anna Huk' }],
  DC_ChangeReason: '<p>Initial creation</p>',
};

describe('deriveDocumentFlow', () => {
  it('returns "New Document" for version 1.0', () => {
    expect(deriveDocumentFlow(1, 0)).toBe('New Document');
  });

  it('returns "Major Revision" for X.0 where X > 1', () => {
    expect(deriveDocumentFlow(2, 0)).toBe('Major Revision');
    expect(deriveDocumentFlow(5, 0)).toBe('Major Revision');
  });

  it('returns "Minor Revision" for any X.Y where Y > 0', () => {
    expect(deriveDocumentFlow(1, 1)).toBe('Minor Revision');
    expect(deriveDocumentFlow(2, 3)).toBe('Minor Revision');
    expect(deriveDocumentFlow(5, 7)).toBe('Minor Revision');
  });

  it('returns "Other" when version numbers are missing', () => {
    expect(deriveDocumentFlow(undefined, undefined)).toBe('Other');
    expect(deriveDocumentFlow(NaN, NaN)).toBe('Other');
  });
});

describe('normalizeDocumentRecord', () => {
  it('maps top-level fields to CSV-header shape', () => {
    const r = normalizeDocumentRecord(sample);
    expect(r['Doc Prefix']).toBe('DOC');
    expect(r['Doc Number']).toBe('0001.1');
    expect(r['Title']).toBe('Thawing and expansion of cells');
    expect(r['Version Date']).toBe('2021-10-18T00:00:00.000Z');
    expect(r['Version']).toBe('1.0');
    expect(r['Author']).toBe('BizzMine Administrator');
    expect(r['Distribution List']).toBe('Production Team');
    expect(r['Responsible']).toBe('Anna Huk');
    expect(r['Completed On']).toBe('2021-10-18T12:17:46.000Z');
  });

  it('derives Document Flow from version numbers', () => {
    const r = normalizeDocumentRecord(sample);
    expect(r['Document Flow']).toBe('New Document');

    const major = normalizeDocumentRecord({ ...sample, DC_MajorVersion: 3, DC_MinorVersion: 0 });
    expect(major['Document Flow']).toBe('Major Revision');

    const minor = normalizeDocumentRecord({ ...sample, DC_MajorVersion: 2, DC_MinorVersion: 5 });
    expect(minor['Document Flow']).toBe('Minor Revision');
  });

  it('strips HTML from Change Reason', () => {
    const r = normalizeDocumentRecord(sample);
    expect(r['Change Reason']).toBe('Initial creation');
  });

  it('resolves Pending Steps via stepMap', () => {
    const raw: RawInstance = { ...sample, DC_PendingSteps: 300, DC_CompletedOn: '' };
    const r = normalizeDocumentRecord(raw, stepMap);
    expect(r['Pending Steps']).toBe('Document Review');
  });
});

describe('normalizeDocumentInstances', () => {
  it('maps an array', () => {
    expect(normalizeDocumentInstances([sample]).length).toBe(1);
    expect(normalizeDocumentInstances([])).toEqual([]);
  });
});
