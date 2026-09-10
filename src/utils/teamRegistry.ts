import { DivisionTeam } from '../types';

const KEY = 'sweepinganku:joinedTeams';

export function loadJoinedTeams(): DivisionTeam[] {
  try {
    const raw = localStorage.getItem(KEY);
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
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable; the active team still remains usable in memory.
  }
}

export function getJoinedDivisions(): string[] {
  return Array.from(new Set(loadJoinedTeams().map((team) => team.division).filter(Boolean)));
}

export function getSavedActiveTeam(): DivisionTeam | null {
  try {
    const raw = localStorage.getItem('sweepinganku:activeTeam');
    if (!raw) return null;
    const team = JSON.parse(raw);
    return team && team.teamCode && team.division ? team : null;
  } catch {
    return null;
  }
}
