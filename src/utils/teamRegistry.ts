import { DivisionTeam } from '../types';
import { auth } from '../lib/firebase';

const KEY = 'sweepinganku:joinedTeams';

function getKey(): string {
  return `${KEY}:${auth.currentUser?.uid || 'anonymous'}`;
}

/**
 * Local cache only. Firebase team membership remains the source of truth.
 * An empty list is a valid state: it means the account has not joined a team.
 */
export function loadJoinedTeams(): DivisionTeam[] {
  try {
    const raw = localStorage.getItem(getKey());
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

/** Remove a team from this account's local membership cache. */
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

/**
 * Returns the explicitly selected/joined team, or null when the account has
 * no active team. There is intentionally NO legacy/default team fallback.
 */
export function getSavedActiveTeam(): DivisionTeam | null {
  try {
    const raw = localStorage.getItem('sweepinganku:activeTeam');
    if (raw) {
      const active = JSON.parse(raw);
      if (active?.teamCode && active?.division) {
        const joined = loadJoinedTeams();
        if (joined.some((team) => team.teamCode.trim().toUpperCase() === String(active.teamCode).trim().toUpperCase())) {
          return active;
        }
      }
      // An explicit empty active team means the account intentionally has no team.
      if (active && !active.teamCode) return null;
    }
  } catch {
    // Fall through to the joined-team cache.
  }

  const teams = loadJoinedTeams();
  return teams.length ? teams[teams.length - 1] : null;
}
