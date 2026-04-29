import { describe, it, expect } from 'vitest';
import { harvestUsersFromRecords } from '../users';
import fixtureArray from '../fixtures/capa-instance-array.fixture.json';
import type { RawInstance } from '../types';

describe('harvestUsersFromRecords', () => {
  it('extracts unique user ids and names from OrgChart fields', () => {
    const map = harvestUsersFromRecords({
      CAPA: fixtureArray as RawInstance[],
    });
    expect(map[12]).toMatchObject({ name: 'Test User Alpha', type: 1 });
    expect(map[14]).toMatchObject({ name: 'Test User Beta', type: 1 });
    expect(map[84]).toMatchObject({ name: 'Test User Gamma', type: 1 });
  });

  it('captures groups (type 2) the same way', () => {
    const map = harvestUsersFromRecords({ CAPA: fixtureArray as RawInstance[] });
    expect(map[99]).toMatchObject({ name: 'QA Team', type: 2 });
  });

  it('records sourceCollections for each id', () => {
    const map = harvestUsersFromRecords({ CAPA: fixtureArray as RawInstance[] });
    expect(map[12].sourceCollections).toContain('CAPA');
  });

  it('merges across multiple collections without duplicating', () => {
    const map = harvestUsersFromRecords({
      CAPA: fixtureArray as RawInstance[],
      NC: [
        {
          NC_RegisteredBy: [{ type: 1, id: 12, value: 'Test User Alpha' }],
        },
      ],
    });
    expect(map[12].sourceCollections.sort()).toEqual(['CAPA', 'NC']);
  });

  it('skips non-OrgChart fields gracefully', () => {
    const map = harvestUsersFromRecords({
      CAPA: [
        {
          CAPA_Tittle: 'Just a title',
          CAPA_Priority: { value: 64, text: 'Normal' },
          CAPA_AssignedTo: [{ type: 1, id: 7, value: 'Solo User' }],
        },
      ],
    });
    expect(Object.keys(map)).toEqual(['7']);
  });

  it('stamps lastSeenAt with an ISO timestamp', () => {
    const map = harvestUsersFromRecords({ CAPA: fixtureArray as RawInstance[] });
    expect(map[12].lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
