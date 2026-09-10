import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { DivisionTeam } from '../types';

const COLLECTION = 'teams';

function normalize(code: string) {
  return code.trim().toUpperCase();
}

function teamRef(teamCode: string) {
  return doc(db, COLLECTION, normalize(teamCode));
}

export function getMonday(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function getSunday(date: string): string {
  const monday = new Date(`${getMonday(date)}T12:00:00`);
  monday.setDate(monday.getDate() + 6);
  return monday.toISOString().slice(0, 10);
}

export function getCurrentWeekRange(date: string) {
  return { weekStart: getMonday(date), weekEnd: getSunday(date) };
}

export function isDateInTeamWeek(date: string, team: DivisionTeam): boolean {
  if (!team.weekStart || !team.weekEnd) return true;
  return date >= team.weekStart && date <= team.weekEnd;
}

export async function getTeam(teamCode: string): Promise<DivisionTeam | null> {
  if (!teamCode.trim()) return null;
  const snap = await getDoc(teamRef(teamCode));
  if (!snap.exists()) return null;
  return snap.data() as DivisionTeam;
}

export async function createOrUpdateTeam(team: DivisionTeam, createIfMissing = true): Promise<DivisionTeam> {
  const code = normalize(team.teamCode);
  if (!code) throw new Error('PIN tim wajib diisi.');
  const existing = await getTeam(code);
  if (existing && createIfMissing) {
    if (existing.division !== team.division) throw new Error(`PIN ${code} sudah digunakan untuk divisi ${existing.division}.`);
    if (existing.weekStart && team.weekStart && existing.weekStart !== team.weekStart) {
      throw new Error(`PIN ${code} sudah terdaftar untuk pekan ${existing.weekStart}–${existing.weekEnd}.`);
    }
    return existing;
  }

  const payload = {
    ...team,
    teamCode: code,
    teamName: team.teamName.trim() || `Tim ${team.division}`,
    members: Array.from(new Set(team.members || [])),
    updatedAt: serverTimestamp(),
  };
  await setDoc(teamRef(code), payload, { merge: true });
  return { ...team, teamCode: code };
}

export async function updateTeamName(teamCode: string, teamName: string): Promise<void> {
  if (!teamCode.trim()) return;
  await setDoc(teamRef(teamCode), { teamName: teamName.trim(), updatedAt: serverTimestamp() }, { merge: true });
}

export function subscribeToTeam(teamCode: string, callback: (team: DivisionTeam | null) => void, onError?: (error: Error) => void): Unsubscribe {
  if (!teamCode.trim()) {
    callback(null);
    return () => {};
  }
  return onSnapshot(teamRef(teamCode), (snap) => callback(snap.exists() ? snap.data() as DivisionTeam : null), (error) => {
    console.error('[Firestore] subscribeToTeam error:', error);
    onError?.(error);
  });
}
