// src/lib/teams.ts

const TEAM_STORAGE_KEY = 'productionTeam';

const defaultTeam: string[] = [
  "Aumkar Logendran",
  "Caitlin Martinsen",
  "Gudrun Richstad",
  "Hans Petter Johansen",
  "Jenny Havstad",
  "Jim Eero Lamppu",
  "Nina Granum",
  "Øyvind Røe",
  "Sigrid Eisner",
  "Yngve Ness"
];

const isBrowser = () => typeof window !== 'undefined';

export const getProductionTeam = (): string[] => {
  if (!isBrowser()) return defaultTeam;

  try {
    const storedTeam = window.localStorage.getItem(TEAM_STORAGE_KEY);
    return storedTeam ? JSON.parse(storedTeam) : defaultTeam;
  } catch (error) {
    console.error("Failed to parse team from localStorage", error);
    return defaultTeam;
  }
};

export const setProductionTeam = (team: string[]): void => {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(team));
  } catch (error) {
    console.error("Failed to save team to localStorage", error);
  }
};

/**
 * Membership check for the "Production Only" filter.
 *
 * BizzMine OrgChart fields are flattened into a single string by the
 * normalizer (see flattenOrgChart). For records assigned to a single
 * person that's just the name (e.g. "Anna Huk"). For multi-assignee
 * records — rare on the live tenant today, but possible — it's a
 * comma-separated join ("Anna Huk, Øyvind Røe"), in which case a
 * naive `team.includes(value)` would fail to match either name.
 *
 * This helper handles both shapes plus stray whitespace from
 * manually-typed Settings entries. Case-sensitive: BizzMine canonical
 * capitalization is the source of truth.
 */
export function isInTeam(value: unknown, team: string[]): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (team.includes(trimmed)) return true;
  if (!trimmed.includes(',')) return false;
  return trimmed.split(',').some((name) => team.includes(name.trim()));
}
