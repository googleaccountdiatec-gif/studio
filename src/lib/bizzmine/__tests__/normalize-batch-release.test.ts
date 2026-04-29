import { describe, it, expect } from 'vitest';
import {
  normalizeBatchReleaseRecord,
  normalizeBatchReleaseInstances,
} from '../normalize/batch-release';
import type { RawInstance } from '../types';

const sample: RawInstance = {
  KPI_batch_release_Batchnumber: 'B8794',
  KPI_batch_release_Finalbatchstatus: { value: 1200, text: 'Approved' },
  KPI_batch_release_Typeofproduction: { value: 1194, text: 'Production in CL1000 bioreactor' },
  KPI_batch_release_Lowrisknonconformances: 3,
  KPI_batch_release_Highrisknonconformance: 0,
  KPI_batch_release_RegistrationTime: '1/4/2024 5:02:20 PM +00:00',
  KPI_batch_release_RegisteredBy: [{ type: 1, id: 14, value: 'Anna Huk' }],
  KPI_batch_release_CompletedOn: '1/4/2024 5:02:20 PM +00:00',
  KPI_batch_release_Status: 3,
  KPI_batch_release_Productapproval: '1/11/2024 12:00:00 AM +00:00',
  KPI_batch_release_Productapprovedby: [{ type: 1, id: 14, value: 'Anna Huk' }],
  FinalBatch: [{ FinalBatch_Batchnumber: 'B8794-FINAL' }],
  Batch_release_project: [
    {
      Batch_release_project_ProjectNumber: '2023-50',
      Batch_release_project_Project_Production: { value: 578, text: 'CL1000' },
      Clone: [
        {
          Batch_release_project_Clonename: 'mAb12 (3-1C11-2/2/29)',
          Batch_release_project_Clone_Productnumber: 8820.0,
        },
      ],
      CO: [
        {
          Batch_release_project_Company: 'Calpro AS',
          Batch_release_project_CO_Companyaliases: 'CalproAS, Calpro',
        },
      ],
      ProdName: [
        {
          Batch_release_project_ProductName: 'mAb12',
          Batch_release_project_ProductNumber: '9990',
        },
      ],
    },
  ],
};

describe('normalizeBatchReleaseRecord', () => {
  it('maps top-level CSV-header fields', () => {
    const r = normalizeBatchReleaseRecord(sample);
    expect(r['Batch number']).toBe('B8794');
    expect(r['Final batch status']).toBe('Approved');
    expect(r['Type of Production']).toBe('Production in CL1000 bioreactor');
    expect(r['Type of production']).toBe('Production in CL1000 bioreactor');
    expect(r['Low-risk nonconformances']).toBe('3');
    expect(r['High-risk nonconformance']).toBe('0');
    expect(r['Completed On']).toBe('2024-01-04T17:02:20.000Z');
  });

  it('hoists Batch number from list from FinalBatch sub-collection', () => {
    const r = normalizeBatchReleaseRecord(sample);
    expect(r['Batch number from list']).toBe('B8794-FINAL');
  });

  it('hoists Project Number from Batch_release_project sub-collection', () => {
    const r = normalizeBatchReleaseRecord(sample);
    expect(r['Project Number']).toBe('2023-50');
  });

  it('hoists Clone name and Product number from nested Clone sub-collection', () => {
    const r = normalizeBatchReleaseRecord(sample);
    expect(r['Clone name']).toBe('mAb12 (3-1C11-2/2/29)');
    // Prefer AlphaNumeric ProdName.ProductNumber over Numeric Clone.Productnumber
    expect(r['Product number']).toBe('9990');
  });

  it('hoists Company + aliases from CO sub-collection', () => {
    const r = normalizeBatchReleaseRecord(sample);
    expect(r['Company']).toBe('Calpro AS');
    expect(r['Company aliases']).toBe('CalproAS, Calpro');
  });

  it('hoists Product Name from ProdName sub-collection', () => {
    const r = normalizeBatchReleaseRecord(sample);
    expect(r['Product Name']).toBe('mAb12');
  });

  it('falls back to Clone Productnumber when ProdName missing', () => {
    const variant: RawInstance = {
      ...sample,
      Batch_release_project: [
        {
          Batch_release_project_ProjectNumber: '2023-50',
          Clone: [{ Batch_release_project_Clone_Productnumber: 8820.0 }],
        },
      ],
    };
    const r = normalizeBatchReleaseRecord(variant);
    expect(r['Product number']).toBe('8820');
  });

  it('handles missing sub-collections gracefully', () => {
    const r = normalizeBatchReleaseRecord({
      KPI_batch_release_Batchnumber: 'B0001',
      KPI_batch_release_Finalbatchstatus: '',
    });
    expect(r['Batch number']).toBe('B0001');
    expect(r['Project Number']).toBe('');
    expect(r['Clone name']).toBe('');
    expect(r['Company']).toBe('');
    expect(r['Product Name']).toBe('');
  });

  it('counts NC sub-collection entries', () => {
    const variant: RawInstance = {
      ...sample,
      Batch_release_nonconformance: [
        { Batch_release_nonconformance_NCID: 1 },
        { Batch_release_nonconformance_NCID: 2 },
      ],
    };
    const r = normalizeBatchReleaseRecord(variant);
    expect(r._subCollections.Batch_release_nonconformance).toHaveLength(2);
  });
});

describe('normalizeBatchReleaseInstances', () => {
  it('maps an array', () => {
    expect(normalizeBatchReleaseInstances([sample]).length).toBe(1);
    expect(normalizeBatchReleaseInstances([])).toEqual([]);
  });
});
