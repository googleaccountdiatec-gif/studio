import { describe, it, expect } from 'vitest';
import { isInTeam } from '../teams';

const team = ['Anna Huk', 'Øyvind Røe', 'Aumkar Logendran'];

describe('isInTeam', () => {
  it('matches a single-name string', () => {
    expect(isInTeam('Anna Huk', team)).toBe(true);
    expect(isInTeam('Suyog Basnet', team)).toBe(false);
  });

  it('matches any name in a comma-separated multi-assignee string', () => {
    expect(isInTeam('Anna Huk, Suyog Basnet', team)).toBe(true);
    expect(isInTeam('Suyog Basnet, Øyvind Røe', team)).toBe(true);
    expect(isInTeam('Suyog Basnet, Other Person', team)).toBe(false);
  });

  it('trims surrounding whitespace before comparing', () => {
    expect(isInTeam('  Anna Huk  ', team)).toBe(true);
    expect(isInTeam(' Anna Huk , Other ', team)).toBe(true);
  });

  it('returns false for empty / non-string inputs', () => {
    expect(isInTeam('', team)).toBe(false);
    expect(isInTeam('   ', team)).toBe(false);
    expect(isInTeam(undefined, team)).toBe(false);
    expect(isInTeam(null, team)).toBe(false);
    expect(isInTeam(42, team)).toBe(false);
    expect(isInTeam([], team)).toBe(false);
  });

  it('preserves diacritics in matching', () => {
    expect(isInTeam('Øyvind Røe', team)).toBe(true);
    expect(isInTeam('Oyvind Roe', team)).toBe(false);
  });

  it('is case-sensitive (BizzMine canonical capitalization is authoritative)', () => {
    expect(isInTeam('anna huk', team)).toBe(false);
    expect(isInTeam('ANNA HUK', team)).toBe(false);
  });
});
