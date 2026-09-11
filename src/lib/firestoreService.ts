/**
 * Firestore synchronization layer for Swepinganku patient data.
 * Daily collection: sweepinganku/{patientId}
 * Weekly historical collection: sweepingankuWeekly/{team_week_rm}
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { Patient } from '../types';

const COLLECTION = 'sweepinganku';
const WEEKLY_COLLECTION = 'sweepingankuWeekly';

type WeeklyHistoryRecord = Patient & {
  teamCode: string;
  weekStart: string;
  weekEnd: string;
  firstDate: string;
  lastDate: string;
  days: Record<string, { patient: Patient; recordedAt: string }>;
};

function makeDocId(patient: Patient & { teamCode?: string; date?: string }): string {
  const safe = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_\-.:]/g, '_').substring(0, 40);
  return `${safe(patient.teamCode || 'NOTEAM')}_${safe(patient.date)}_${safe(patient.rm || patient.id)}`;
}

function rmKey(rm?: string | null): string {
  const clean = String(rm || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean.replace(/^0+/, '') || clean;
}

function getWeekStart(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function weeklyDocId(teamCode: string, weekStart: string, rm: string): string {
  const safe = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_\-.:]/g, '_').substring(0, 40);
  return `${safe(teamCode)}_${safe(weekStart)}_${safe(rmKey(rm))}`;
}

function historyPayload(patient: Patient, teamCode: string, date: string) {
  const recordedAt = new Date().toISOString();
  const weekStart = getWeekStart(date);
  return {
    ...patient,
    teamCode,
    date,
    weekStart,
    weekEnd: getWeekEnd(weekStart),
    firstDate: date,
    lastDate: date,
    days: {
      [date]: { patient: { ...patient, teamCode, date }, recordedAt },
    },
    updatedAt: recordedAt,
  } satisfies WeeklyHistoryRecord;
}

/** Record a patient occurrence permanently for the Monday-Sunday weekly recap. */
async function recordWeeklyHistory(patient: Patient, teamCode: string, date: string): Promise<void> {
  if (!teamCode || !date || !patient.rm) return;
  const payload = historyPayload(patient, teamCode, date);
  const ref = doc(db, WEEKLY_COLLECTION, weeklyDocId(teamCode, payload.weekStart, patient.rm));
  await setDoc(ref, payload, { merge: true });
}

/** Save the complete patient list for one team/date and preserve weekly history. */
export async function savePatientsBatch(teamCode: string, date: string, patients: Patient[]): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  try {
    const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
    const existing = await getDocs(q);
    const batch = writeBatch(db);
    existing.docs.forEach((d) => batch.delete(d.ref));
    const recordedAt = new Date().toISOString();
    const weekStart = getWeekStart(date);
    const weekEnd = getWeekEnd(weekStart);

    patients.forEach((p) => {
      const normalized = { ...p, teamCode, date, updatedAt: recordedAt };
      const ref = doc(db, COLLECTION, makeDocId(normalized));
      batch.set(ref, normalized);

      if (normalized.rm) {
        const historyRef = doc(db, WEEKLY_COLLECTION, weeklyDocId(teamCode, weekStart, normalized.rm));
        batch.set(historyRef, {
          ...normalized,
          weekStart,
          weekEnd,
          firstDate: date,
          lastDate: date,
          updatedAt: recordedAt,
          [`days.${date}`]: { patient: normalized, recordedAt },
        }, { merge: true });
      }
    });
    await batch.commit();
  } catch (err) {
    console.error('[Firestore] savePatientsBatch gagal:', err);
    throw err;
  }
}

export async function fetchPatientsFromFirestore(teamCode: string, date: string): Promise<Patient[] | null> {
  try {
    const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map((d) => d.data() as Patient);
  } catch (err) {
    console.error('[Firestore] fetchPatientsFromFirestore gagal:', err);
    throw err;
  }
}

/** Fetch every current patient for a team in the requested date range. */
export async function fetchPatientsForDateRange(teamCode: string, startDate: string, endDate: string): Promise<Patient[]> {
  if (!teamCode) return [];
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '>=', startDate), where('date', '<=', endDate));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Patient);
}

/** Fetch current weekly-history records once. Used to backfill history for legacy daily data. */
export async function seedWeeklyHistory(teamCode: string, startDate: string, endDate: string, patients: Patient[]): Promise<void> {
  if (!teamCode || !patients.length) return;
  const batch = writeBatch(db);
  const recordedAt = new Date().toISOString();
  patients.filter((p) => p.rm && p.date && p.date >= startDate && p.date <= endDate).forEach((p) => {
    const date = p.date as string;
    const weekStart = getWeekStart(date);
    const ref = doc(db, WEEKLY_COLLECTION, weeklyDocId(teamCode, weekStart, p.rm));
    batch.set(ref, {
      ...p,
      teamCode,
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      firstDate: date,
      lastDate: date,
      updatedAt: recordedAt,
      [`days.${date}`]: { patient: { ...p, teamCode, date }, recordedAt },
    }, { merge: true });
  });
  await batch.commit();
}

/** Realtime subscription to the permanent Monday-Sunday weekly history. */
export function subscribeToWeeklyHistory(teamCode: string, weekStart: string, callback: (patients: Patient[]) => void, onError?: (error: Error) => void): Unsubscribe {
  if (!teamCode || !weekStart) { callback([]); return () => {}; }
  const q = query(collection(db, WEEKLY_COLLECTION), where('teamCode', '==', teamCode), where('weekStart', '==', weekStart));
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map((d) => d.data() as WeeklyHistoryRecord);
    const patients: Patient[] = records.map((record) => {
      const days = record.days || {};
      const occurrences = Object.entries(days).sort(([a], [b]) => a.localeCompare(b));
      const latest = occurrences.length ? occurrences[occurrences.length - 1][1].patient : record;
      return { ...latest, teamCode, lastDate: record.lastDate || latest.date };
    });
    callback(patients);
  }, (err) => {
    console.error('[Firestore] subscribeToWeeklyHistory error:', err);
    onError?.(err);
  });
}

export function subscribeToPatients(teamCode: string, date: string, callback: (patients: Patient[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as Patient)), (err) => {
    console.error('[Firestore] subscribeToPatients error:', err);
    onError?.(err);
  });
}

export function subscribeToTeamAllPatients(teamCode: string, callback: (patients: Patient[]) => void, onError?: (error: Error) => void): Unsubscribe {
  if (!teamCode) { callback([]); return () => {}; }
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as Patient)), (err) => {
    console.error('[Firestore] subscribeToTeamAllPatients error:', err);
    onError?.(err);
  });
}

export async function deletePatientFromFirestore(patient: Patient & { teamCode?: string; date?: string }): Promise<void> {
  const teamCode = patient.teamCode || '';
  const date = patient.date || '';
  // Intentionally keep weekly history. Deleting today's record must not erase the fact
  // that the patient was present in this Monday-Sunday period.
  if (teamCode && date && patient.rm) await recordWeeklyHistory(patient, teamCode, date);
  await deleteDoc(doc(db, COLLECTION, makeDocId(patient)));
}

export async function upsertPatientToFirestore(patient: Patient, teamCode: string, date: string): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  const normalized = { ...patient, teamCode, date, updatedAt: new Date().toISOString() };
  const docId = makeDocId(normalized);
  await setDoc(doc(db, COLLECTION, docId), normalized);
  await recordWeeklyHistory(normalized, teamCode, date);
}

export async function movePatientToDateFirestore(patient: Patient, teamCode: string, fromDate: string, toDate: string): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  if (!fromDate || !toDate) throw new Error('Tanggal asal/tujuan tidak valid.');
  if (fromDate === toDate) throw new Error('Tanggal tujuan sama dengan tanggal asal.');
  const targetQuery = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', toDate));
  const targetSnap = await getDocs(targetQuery);
  const patientRm = patient.rm?.trim().toLowerCase();
  const duplicate = targetSnap.docs.some((d) => {
    const data = d.data() as Patient;
    return !!patientRm && data.rm?.trim().toLowerCase() === patientRm;
  });
  if (duplicate) throw new Error(`Pasien dengan No. RM ${patient.rm || '-'} sudah ada pada ${toDate}.`);
  const movedPatient: Patient = { ...patient, teamCode, date: toDate, updatedAt: new Date().toISOString() };
  // Preserve the source occurrence and also record the destination occurrence.
  await recordWeeklyHistory(patient, teamCode, fromDate);
  await recordWeeklyHistory(movedPatient, teamCode, toDate);
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTION, makeDocId({ ...patient, teamCode, date: fromDate })));
  batch.set(doc(db, COLLECTION, makeDocId(movedPatient)), movedPatient);
  await batch.commit();
}
