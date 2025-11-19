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
