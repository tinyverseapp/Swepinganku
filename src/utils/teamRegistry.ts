import { DivisionTeam } from '../types';
import { auth } from '../lib/firebase';

const KEY = 'sweepinganku:joinedTeams';
const LEGACY_KEY = 'sweepinganku:joinedTeams';

function getKey(): string {
  return `${KEY}:${auth.currentUser?.uid || 'anonymous'}`;
}

export function loadJoinedTeams(): DivisionTeam[] {
  try {
    const raw = localStorage.getItem(getKey()) || (auth.currentUser ? null : localStorage.getItem(LEGACY_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((team) => team && typeof team.teamCode === 'string' && typeof team.division === 'string');
  } catch {
    return [];
  }
}

export function saveJoinedTeam(team: DivisionTeam): void {
  try {
    const current = loadJoinedTeams();
    const normalizedCode = team.teamCode.trim().toUpperCase();
    const next = current.filter((item) => item.teamCode.trim().toUpperCase() !== normalizedCode);
    next.push({ ...team, teamCode: normalizedCode, lastUpdated: new Date().toISOString() });
    localStorage.setItem(getKey(), JSON.stringify(next));
  } catch {
    // localStorage may be unavailable.
  }
}

/** Remove a team from this account's joined-team list. */
export function removeJoinedTeam(teamCode: string): DivisionTeam[] {
  try {
    const normalizedCode = teamCode.trim().toUpperCase();
    const next = loadJoinedTeams().filter((team) => team.teamCode.trim().toUpperCase() !== normalizedCode);
    localStorage.setItem(getKey(), JSON.stringify(next));
    return next;
  } catch {
    return loadJoinedTeams();
  }
}

export function getJoinedDivisions(): string[] {
  return Array.from(new Set(loadJoinedTeams().map((team) => team.division).filter(Boolean)));
}

export const DEFAULT_DIGESTIF_TEAM: DivisionTeam = {
  teamCode: 'DIGESTIF',
  division: 'Bedah Digestif & Umum',
  teamName: 'Tim Bedah Digestif',
  members: ['dr. Muda / Koas Bedah']
};

export function getSavedActiveTeam(): DivisionTeam | null {
  try {
    const raw = localStorage.getItem('sweepinganku:activeTeam');
    if (raw) {
      const active = JSON.parse(raw);
      if (active?.teamCode && active?.division) {
        const joined = loadJoinedTeams();
        if (joined.some((team) => team.teamCode === active.teamCode)) return active;
      }
      // An explicit empty active team means the account intentionally left its last team.
      if (active && !active.teamCode) return null;
    }
  } catch {
    // Fall through to the latest joined team.
  }
  const teams = loadJoinedTeams();
  if (teams.length) return teams[teams.length - 1];
  
  // Default to Bedah Digestif team so users can immediately use the app with the Excel data.
  // This remains only for accounts that have never explicitly left/cleared a team.
  saveJoinedTeam(DEFAULT_DIGESTIF_TEAM);
  return DEFAULT_DIGESTIF_TEAM;
}
