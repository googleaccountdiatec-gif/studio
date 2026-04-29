import { describe, it, expect } from 'vitest';
import {
  normalizeBatchRegistryRecord,
  normalizeBatchRegistryInstances,
} from '../normalize/batch-registry';
import type { RawInstance } from '../types';

const upstreamSample: RawInstance = {
  BR_BRID: 5,
  BR_Batchnumber: 'B9441',
  BR_Numberofunits: 100,
  BR_Typeofbatch: { value: 1466, text: 'Upstream production' },
  BR_Comments: '<div>Upstream batch comment</div>',
  BR_Preservatives: { value: 1468, text: 'No Azide' },
  BR_RegistrationTime: '12/3/2025 7:20:00 AM +00:00',
  BR_RegisteredBy: [{ type: 1, id: 15, value: 'Øyvind Røe' }],
  BR_CompletedOn: '12/3/2025 7:25:19 AM +00:00',
  BR_Status: 3,
  BR_PendingSteps: '',
  BR_Harvestsused: '<div>H2+H5+H7</div>',
};

const downstreamSample: RawInstance = {
  BR_BRID: 6,
  BR_Batchnumber: 'B9442',
  BR_Typeofbatch: { value: 1464, text: 'FPLC' },
  BR_RegistrationTime: '12/4/2025 8:00:00 AM +00:00',
  BR_RegisteredBy: [{ type: 1, id: 15, value: 'Øyvind Røe' }],
  BR_CompletedOn: '',
  BR_Status: 1,
  BR_PendingSteps: 'FPLC Step',
  Refpreviousbatch: [
    {
      Refpreviousbatch_Batchnumber: 'B9441',
      Refpreviousbatch_Typeofbatch: { value: 1466, text: 'Upstream production' },
      Refpreviousbatch_RegistrationTime: '12/3/2025 7:20:00 AM +00:00',
    },
  ],
  Producedforproject: [
    {
      Producedforproject_ProjectNumber: '2025-12',
      Producedforproject_Project_Specifics: '<p>Test project</p>',
      Clone: [{ Producedforproject_Clonename: 'mAb12' }],
      ProdName: [{ Producedforproject_ProdName_ProductName: 'Anti-Calprotectin' }],
    },
  ],
};

describe('normalizeBatchRegistryRecord — base fields', () => {
  it('maps top-level BR fields', () => {
    const r = normalizeBatchRegistryRecord(upstreamSample);
    expect(r['BRID']).toBe('5');
    expect(r['Batch number']).toBe('B9441');
    expect(r['Type of batch']).toBe('Upstream production');
    expect(r['Number of units']).toBe('100');
    expect(r['Preservatives']).toBe('No Azide');
    expect(r['Registered By']).toBe('Øyvind Røe');
    expect(r['Registration Time']).toBe('2025-12-03T07:20:00.000Z');
    expect(r['Completed On']).toBe('2025-12-03T07:25:19.000Z');
  });

  it('strips HTML from comment / harvests fields', () => {
    const r = normalizeBatchRegistryRecord(upstreamSample);
    expect(r['Comments']).toBe('Upstream batch comment');
    expect(r['Harvests used']).toBe('H2+H5+H7');
  });
});

describe('normalizeBatchRegistryRecord — Upstream/Downstream classification', () => {
  it('flags Upstream production as Is Upstream=true', () => {
    const r = normalizeBatchRegistryRecord(upstreamSample);
    expect(r['Is Upstream']).toBe(true);
  });

  it('flags non-Upstream Typeofbatch as Is Upstream=false', () => {
    const r = normalizeBatchRegistryRecord(downstreamSample);
    expect(r['Is Upstream']).toBe(false);
  });
});

describe('normalizeBatchRegistryRecord — sub-collection hoisting', () => {
  it('hoists Project info from Producedforproject', () => {
    const r = normalizeBatchRegistryRecord(downstreamSample);
    expect(r['Project Number']).toBe('2025-12');
    expect(r['Clone name']).toBe('mAb12');
    expect(r['Product Name']).toBe('Anti-Calprotectin');
  });

  it('exposes Refpreviousbatch as a structured pooling tree', () => {
    const r = normalizeBatchRegistryRecord(downstreamSample);
    expect(r['Previous Batches']).toHaveLength(1);
    expect(r['Previous Batches'][0]).toMatchObject({
      'Batch number': 'B9441',
      'Type of batch': 'Upstream production',
    });
  });

  it('returns empty arrays / strings when sub-collections are absent', () => {
    const r = normalizeBatchRegistryRecord(upstreamSample);
    expect(r['Project Number']).toBe('');
    expect(r['Previous Batches']).toEqual([]);
  });
});

describe('normalizeBatchRegistryInstances', () => {
  it('maps an array', () => {
    expect(normalizeBatchRegistryInstances([upstreamSample, downstreamSample]).length).toBe(2);
    expect(normalizeBatchRegistryInstances([])).toEqual([]);
  });
});
