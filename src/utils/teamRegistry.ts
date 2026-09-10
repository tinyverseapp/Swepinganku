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

export function getJoinedDivisions(): string[] {
  return Array.from(new Set(loadJoinedTeams().map((team) => team.division).filter(Boolean)));
}

export function getSavedActiveTeam(): DivisionTeam | null {
  try {
    const raw = localStorage.getItem('sweepinganku:activeTeam');
    if (raw) {
      const active = JSON.parse(raw);
      if (active?.teamCode && active?.division) {
        const joined = loadJoinedTeams();
        if (joined.some((team) => team.teamCode === active.teamCode)) return active;
      }
    }
  } catch {
    // Fall through to the latest joined team.
  }
  const teams = loadJoinedTeams();
  return teams.length ? teams[teams.length - 1] : null;
}
