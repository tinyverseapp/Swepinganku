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

/** Remove a team from this account's local membership cache across all key variants. */
export function removeJoinedTeam(teamCode: string): DivisionTeam[] {
  if (!teamCode) return loadJoinedTeams();
  const normalizedCode = teamCode.trim().toUpperCase();
  try {
    const keysToCheck = [getKey(), KEY, `${KEY}:anonymous`];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY) && !keysToCheck.includes(k)) {
        keysToCheck.push(k);
      }
    }

    for (const k of keysToCheck) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
              (item) => item?.teamCode && item.teamCode.trim().toUpperCase() !== normalizedCode
            );
            localStorage.setItem(k, JSON.stringify(filtered));
          }
        }
      } catch {}
    }

    // Also check and invalidate activeTeam if it is the team being left
    try {
      const activeRaw = localStorage.getItem('sweepinganku:activeTeam');
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (active?.teamCode && active.teamCode.trim().toUpperCase() === normalizedCode) {
          localStorage.setItem(
            'sweepinganku:activeTeam',
            JSON.stringify({ teamCode: '', division: '', teamName: '', members: [] })
          );
        }
      }
    } catch {}

    return loadJoinedTeams();
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
