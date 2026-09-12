/**
 * Firestore synchronization layer for Swepinganku patient data.
 * Daily and weekly-history records intentionally share the existing
 * `sweepinganku` collection so the weekly recap does not require a new
 * Firestore collection/rules deployment.
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
const WEEKLY_HISTORY_TYPE = 'weeklyHistory';

type FirestorePatientRecord = Patient & {
  recordType?: string;
  weekStart?: string;
  weekEnd?: string;
  firstDate?: string;
  lastDate?: string;
  days?: Record<string, { patient: Patient; recordedAt: string }>;
};

export interface WeeklyHistoryRecord extends Patient {
  teamCode: string;
  weekStart: string;
  weekEnd: string;
  firstDate: string;
  lastDate: string;
  days: Record<string, { patient: Patient; recordedAt: string }>;
  recordType: typeof WEEKLY_HISTORY_TYPE;
}

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
  return `__WEEKLY__${safe(teamCode)}_${safe(weekStart)}_${safe(rmKey(rm))}`;
}

function isWeeklyHistory(data: FirestorePatientRecord): boolean {
  return data.recordType === WEEKLY_HISTORY_TYPE;
}

function historyPayload(patient: Patient, teamCode: string, date: string): FirestorePatientRecord {
  const recordedAt = new Date().toISOString();
  const weekStart = getWeekStart(date);
  return {
    ...patient,
    teamCode,
    date,
    recordType: WEEKLY_HISTORY_TYPE,
    weekStart,
    weekEnd: getWeekEnd(weekStart),
    firstDate: date,
    lastDate: date,
    days: { [date]: { patient: { ...patient, teamCode, date }, recordedAt } },
    updatedAt: recordedAt,
  };
}

/** Permanently record one patient occurrence for the Monday-Sunday recap. */
async function recordWeeklyHistory(patient: Patient, teamCode: string, date: string): Promise<void> {
  if (!teamCode || !date || !patient.rm) return;
  const payload = historyPayload(patient, teamCode, date);
  const ref = doc(db, COLLECTION, weeklyDocId(teamCode, payload.weekStart, patient.rm));
  await setDoc(ref, payload, { merge: true });
}

/** Save the current patient list while preserving historical occurrences. */
export async function savePatientsBatch(teamCode: string, date: string, patients: Patient[]): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  try {
    const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
    const existing = await getDocs(q);
    const batch = writeBatch(db);

    // Never delete weekly-history documents when replacing a daily list.
    existing.docs.forEach((d) => {
      const data = d.data() as FirestorePatientRecord;
      if (!isWeeklyHistory(data)) batch.delete(d.ref);
    });

    const recordedAt = new Date().toISOString();
    const weekStart = getWeekStart(date);
    const weekEnd = getWeekEnd(weekStart);

    patients.forEach((p) => {
      const normalized = { ...p, teamCode, date, updatedAt: recordedAt };
      batch.set(doc(db, COLLECTION, makeDocId(normalized)), normalized);
      if (normalized.rm) {
        const historyRef = doc(db, COLLECTION, weeklyDocId(teamCode, weekStart, normalized.rm));
        batch.set(historyRef, {
          ...normalized,
          recordType: WEEKLY_HISTORY_TYPE,
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
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as FirestorePatientRecord)
    .filter((data) => !isWeeklyHistory(data))
    .map((data) => data as Patient);
}

/** Fetch only current daily patients for the requested date range. */
export async function fetchPatientsForDateRange(teamCode: string, startDate: string, endDate: string): Promise<Patient[]> {
  if (!teamCode) return [];
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '>=', startDate), where('date', '<=', endDate));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as FirestorePatientRecord)
    .filter((data) => !isWeeklyHistory(data))
    .map((data) => data as Patient);
}

/** Backfill weekly history from existing daily records. */
export async function seedWeeklyHistory(teamCode: string, startDate: string, endDate: string, patients: Patient[]): Promise<void> {
  if (!teamCode || !patients.length) return;
  const batch = writeBatch(db);
  const recordedAt = new Date().toISOString();

  patients
    .filter((p) => p.rm && p.date && p.date >= startDate && p.date <= endDate)
    .forEach((p) => {
      const date = p.date as string;
      const weekStart = getWeekStart(date);
      const ref = doc(db, COLLECTION, weeklyDocId(teamCode, weekStart, p.rm));
      batch.set(ref, {
        ...p,
        teamCode,
        recordType: WEEKLY_HISTORY_TYPE,
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

/**
 * Realtime Monday-Sunday recap.
 *
 * The previous implementation subscribed only to weekly-history documents.
 * That made the recap depend on a separate backfill/write completing first.
 * Here we subscribe to all records for the team and combine:
 *   1. permanent weekly-history occurrences, and
 *   2. current daily patient records in the requested week.
 *
 * Therefore a patient already present on the dashboard appears immediately,
 * and later edits/deletes are reflected without losing an occurrence already
 * captured in weekly history.
 */
export function subscribeToWeeklyHistory(
  teamCode: string,
  weekStart: string,
  callback: (records: WeeklyHistoryRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!teamCode || !weekStart) { callback([]); return () => {}; }

  const weekEnd = getWeekEnd(weekStart);
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode));

  return onSnapshot(q, (snap) => {
    const recordsByRm = new Map<string, WeeklyHistoryRecord>();

    const ensureRecord = (patient: Patient, date: string, days: Record<string, { patient: Patient; recordedAt: string }>) => {
      if (!patient.rm) return;
      const key = rmKey(patient.rm);
      if (!key) return;
      const existing = recordsByRm.get(key);
      if (existing) {
        existing.days = { ...existing.days, ...days };
        return;
      }
      recordsByRm.set(key, {
        ...patient,
        teamCode,
        date,
        weekStart,
        weekEnd,
        firstDate: date,
        lastDate: date,
        days,
        recordType: WEEKLY_HISTORY_TYPE,
      });
    };

    // First load permanent history. These records survive a daily deletion.
    snap.docs.forEach((d) => {
      const data = d.data() as FirestorePatientRecord;
      if (!isWeeklyHistory(data) || data.weekStart !== weekStart || !data.rm) return;
      const days = Object.fromEntries(
        Object.entries(data.days || {}).filter(([dt]) => dt >= weekStart && dt <= weekEnd),
      );
      if (!Object.keys(days).length) return;
      ensureRecord(data as Patient, data.lastDate || weekStart, days);
    });

    // Then overlay current daily records. This is the realtime source of truth
    // for patients currently visible in the dashboard.
    snap.docs.forEach((d) => {
      const data = d.data() as FirestorePatientRecord;
      if (isWeeklyHistory(data) || !data.date || data.date < weekStart || data.date > weekEnd || !data.rm) return;
      const key = rmKey(data.rm);
      const occurrence = { patient: data as Patient, recordedAt: data.updatedAt || new Date().toISOString() };
      const existing = recordsByRm.get(key);
      if (existing) {
        existing.days = { ...existing.days, [data.date]: occurrence };
      } else {
        ensureRecord(data as Patient, data.date, { [data.date]: occurrence });
      }
    });

    // Refresh summary fields from the latest occurrence in the week.
    recordsByRm.forEach((record) => {
      const entries = Object.entries(record.days).sort(([a], [b]) => a.localeCompare(b));
      if (!entries.length) return;
      const first = entries[0][0];
      const latest = entries[entries.length - 1][0];
      const latestPatient = entries[entries.length - 1][1].patient;
      record.firstDate = first;
      record.lastDate = latest;
      Object.assign(record, latestPatient, { teamCode, weekStart, weekEnd, days: record.days, recordType: WEEKLY_HISTORY_TYPE });
    });

    callback([...recordsByRm.values()]);
  }, (err) => {
    console.error('[Firestore] subscribeToWeeklyHistory error:', err);
    onError?.(err);
  });
}

export function subscribeToPatients(teamCode: string, date: string, callback: (patients: Patient[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
  return onSnapshot(q, (snap) => {
    const patients = snap.docs
      .map((d) => d.data() as FirestorePatientRecord)
      .filter((data) => !isWeeklyHistory(data))
      .map((data) => data as Patient);
    callback(patients);
  }, (err) => {
    console.error('[Firestore] subscribeToPatients error:', err);
    onError?.(err);
  });
}

export function subscribeToTeamAllPatients(teamCode: string, callback: (patients: Patient[]) => void, onError?: (error: Error) => void): Unsubscribe {
  if (!teamCode) { callback([]); return () => {}; }
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode));
  return onSnapshot(q, (snap) => {
    const patients = snap.docs
      .map((d) => d.data() as FirestorePatientRecord)
      .filter((data) => !isWeeklyHistory(data))
      .map((data) => data as Patient);
    callback(patients);
  }, (err) => {
    console.error('[Firestore] subscribeToTeamAllPatients error:', err);
    onError?.(err);
  });
}

export async function deletePatientFromFirestore(patient: Patient & { teamCode?: string; date?: string }): Promise<void> {
  const teamCode = patient.teamCode || '';
  const date = patient.date || '';
  // Keep the weekly occurrence before deleting the daily record.
  if (teamCode && date && patient.rm) await recordWeeklyHistory(patient, teamCode, date);
  await deleteDoc(doc(db, COLLECTION, makeDocId(patient)));
}

export async function upsertPatientToFirestore(patient: Patient, teamCode: string, date: string): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  const normalized = { ...patient, teamCode, date, updatedAt: new Date().toISOString() };
  await setDoc(doc(db, COLLECTION, makeDocId(normalized)), normalized);
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
    const data = d.data() as FirestorePatientRecord;
    return !isWeeklyHistory(data) && !!patientRm && data.rm?.trim().toLowerCase() === patientRm;
  });
  if (duplicate) throw new Error(`Pasien dengan No. RM ${patient.rm || '-'} sudah ada pada ${toDate}.`);

  const movedPatient: Patient = { ...patient, teamCode, date: toDate, updatedAt: new Date().toISOString() };
  await recordWeeklyHistory(patient, teamCode, fromDate);
  await recordWeeklyHistory(movedPatient, teamCode, toDate);

  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTION, makeDocId({ ...patient, teamCode, date: fromDate })));
  batch.set(doc(db, COLLECTION, makeDocId(movedPatient)), movedPatient);
  await batch.commit();
}
