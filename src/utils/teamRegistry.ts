import { DivisionTeam } from '../types';

const KEY = 'sweepinganku:joinedTeams';

// Capture the team before the legacy startup logic can rewrite its division.
let startupActiveTeam: DivisionTeam | null = null;
try {
  const raw = localStorage.getItem('sweepinganku:activeTeam');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.teamCode && parsed?.division) startupActiveTeam = parsed;
  }
} catch {
  startupActiveTeam = null;
}

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
    // localStorage may be unavailable.
  }
}

export function getJoinedDivisions(): string[] {
  const divisions = new Set<string>();
  loadJoinedTeams().forEach((team) => divisions.add(team.division));
  if (startupActiveTeam?.division) divisions.add(startupActiveTeam.division);

  // Newer cached patient records carry division metadata. This preserves
  // divisions that were used before this registry was introduced.
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sweepinganku')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((patient) => {
          if (patient?.division) divisions.add(String(patient.division));
        });
      }
    }
  } catch {
    // Ignore malformed legacy cache entries.
  }

  return Array.from(divisions);
}

export function getSavedActiveTeam(): DivisionTeam | null {
  return startupActiveTeam;
}
