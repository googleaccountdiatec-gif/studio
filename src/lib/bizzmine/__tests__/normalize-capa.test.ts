import { describe, it, expect } from 'vitest';
import fixtureSingle from '../fixtures/capa-instance.fixture.json';
import fixtureArray from '../fixtures/capa-instance-array.fixture.json';
import { normalizeCapaRecord, normalizeCapaInstances } from '../normalize/capa';
import type { RawInstance } from '../types';

describe('normalizeCapaRecord', () => {
  it('maps core fields to CSV-header shape', () => {
    const r = normalizeCapaRecord(fixtureSingle as RawInstance);
    expect(r['CAPA ID']).toBe('1');
    expect(r['Title']).toBe('Sample CAPA title');
    expect(r['Due Date']).toBe('2022-03-31T00:00:00.000Z');
    expect(r['Assigned To']).toBe('Test User Alpha');
    expect(r['Priority']).toBe('Normal');
    expect(r['Category of Corrective Action']).toBe('System /process');
    expect(r['Action taken']).toBe('Action performed');
    expect(r['Pending Steps']).toBe('');
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
});
