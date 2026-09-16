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
import { db, auth } from './firebase';
import { Patient } from '../types';
import { parseDateSafely, formatDateIso, OLD_FAHAD_REGEX, TARGET_FAHAD_NAME, normalizeTargetDoctorName } from '../utils/storage';

const COLLECTION = 'sweepinganku';
const WEEKLY_HISTORY_TYPE = 'weeklyHistory';

export function sanitizePatientDoctorNames(patient: Patient): Patient {
  const norm = { ...patient };
  if (norm.dpjp) {
    norm.dpjp = normalizeTargetDoctorName(norm.dpjp);
  }
  if (norm.supervisingDpjp) {
    norm.supervisingDpjp = normalizeTargetDoctorName(norm.supervisingDpjp);
  }
  return norm;
}

// Firestore rejects `undefined` anywhere in a document. Optional patient
// fields may be absent, so sanitize every write at the Firestore boundary.
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item !== undefined) result[key] = stripUndefined(item);
    });
    return result as T;
  }
  return value;
}

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
  // Patient ID is immutable; RM is mutable clinical data and must never be the document identity.
  return `${safe(patient.teamCode || 'NOTEAM')}_${safe(patient.date)}_${safe(patient.id)}`;
}

function makeLegacyDocId(patient: Patient & { teamCode?: string; date?: string }): string {
  const safe = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_\-.:]/g, '_').substring(0, 40);
  return `${safe(patient.teamCode || 'NOTEAM')}_${safe(patient.date)}_${safe(patient.rm || patient.id)}`;
}

function rmKey(rm?: string | null): string {
  const clean = String(rm || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean.replace(/^0+/, '') || clean;
}

function getWeekStart(date: string): string {
  const d = parseDateSafely(date);
  if (Number.isNaN(d.getTime())) return date;
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return formatDateIso(d);
}

function getWeekEnd(weekStart: string): string {
  const d = parseDateSafely(weekStart);
  if (Number.isNaN(d.getTime())) return weekStart;
  d.setDate(d.getDate() + 6);
  return formatDateIso(d);
}

function weeklyDocId(teamCode: string, weekStart: string, rm: string): string {
  const safe = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_\-.:]/g, '_').substring(0, 40);
  return `__WEEKLY__${safe(teamCode)}_${safe(weekStart)}_${safe(rmKey(rm))}`;
}

function isWeeklyHistory(data: FirestorePatientRecord): boolean {
  return data.recordType === WEEKLY_HISTORY_TYPE;
}

function historyPayload(patient: Patient, teamCode: string, date: string): FirestorePatientRecord {
  const cleanPatient = sanitizePatientDoctorNames(patient);
  const recordedAt = new Date().toISOString();
  const weekStart = getWeekStart(date);
  return stripUndefined({
    ...cleanPatient,
    teamCode,
    date,
    recordType: WEEKLY_HISTORY_TYPE,
    weekStart,
    weekEnd: getWeekEnd(weekStart),
    firstDate: date,
    lastDate: date,
    days: { [date]: { patient: { ...cleanPatient, teamCode, date }, recordedAt } },
    updatedAt: recordedAt,
  });
}

/** Permanently record one patient occurrence for the Monday-Sunday recap. */
async function recordWeeklyHistory(patient: Patient, teamCode: string, date: string): Promise<void> {
  if (!teamCode || !date || !patient.rm) return;
  const cleanPatient = sanitizePatientDoctorNames(patient);
  const payload = historyPayload(cleanPatient, teamCode, date);
  const ref = doc(db, COLLECTION, weeklyDocId(teamCode, payload.weekStart, cleanPatient.rm));
  const { days: _days, ...summary } = payload;
  await setDoc(ref, { ...summary, [`days.${date}`]: { patient: { ...cleanPatient, teamCode, date }, recordedAt: summary.updatedAt } }, { merge: true });
}

/** Save the current patient list while preserving historical occurrences. */
export async function savePatientsBatch(teamCode: string, date: string, patients: Patient[]): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  try {
    const cleanPatients = patients.map(sanitizePatientDoctorNames);
    const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
    const existing = await getDocs(q);
    const batch = writeBatch(db);

    // Never delete weekly-history documents when replacing a daily list.
    const desiredIds = new Set(cleanPatients.map((p) => makeDocId({ ...p, teamCode, date })));
    existing.docs.forEach((d) => {
      const data = d.data() as FirestorePatientRecord;
      if (isWeeklyHistory(data)) return;
      // Delete only stale records for this team/date; do not replace another user's concurrent patients.
      const samePatient = cleanPatients.some((p) => (p.id && data.id === p.id) || (p.rm && data.rm && p.rm.trim().toLowerCase() === data.rm.trim().toLowerCase()));
      if (samePatient && !desiredIds.has(d.id)) batch.delete(d.ref);
    });

    const recordedAt = new Date().toISOString();
    const weekStart = getWeekStart(date);
    const weekEnd = getWeekEnd(weekStart);

    cleanPatients.forEach((p) => {
      const normalized = stripUndefined({ ...p, teamCode, date, updatedAt: recordedAt });
      batch.set(doc(db, COLLECTION, makeDocId(normalized)), normalized);
      const legacyId = makeLegacyDocId(normalized);
      const stableId = makeDocId(normalized);
      // Legacy cleanup is intentionally omitted here. A speculative delete
      // of a document that does not exist can be rejected by Firestore Rules
      // and would abort the entire batch. Stable IDs are authoritative.
      if (normalized.rm) {
        const historyRef = doc(db, COLLECTION, weeklyDocId(teamCode, weekStart, normalized.rm));
        batch.set(historyRef, stripUndefined({
          ...normalized,
          recordType: WEEKLY_HISTORY_TYPE,
          weekStart,
          weekEnd,
          firstDate: date,
          lastDate: date,
          updatedAt: recordedAt,
          [`days.${date}`]: { patient: normalized, recordedAt },
        }), { merge: true });
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
    .map((data) => sanitizePatientDoctorNames(data as Patient));
}

/** Fetch only current daily patients for the requested date range. */
export async function fetchPatientsForDateRange(teamCode: string, startDate: string, endDate: string): Promise<Patient[]> {
  if (!teamCode) return [];
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '>=', startDate), where('date', '<=', endDate));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as FirestorePatientRecord)
    .filter((data) => !isWeeklyHistory(data))
    .map((data) => sanitizePatientDoctorNames(data as Patient));
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
      batch.set(ref, stripUndefined({
        ...p,
        teamCode,
        recordType: WEEKLY_HISTORY_TYPE,
        weekStart,
        weekEnd: getWeekEnd(weekStart),
        firstDate: date,
        lastDate: date,
        updatedAt: recordedAt,
        [`days.${date}`]: { patient: { ...p, teamCode, date }, recordedAt },
      }), { merge: true });
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
  startDate: string,
  endDateOrCallback: string | ((records: WeeklyHistoryRecord[]) => void),
  callbackOrError?: ((records: WeeklyHistoryRecord[]) => void) | ((error: Error) => void),
  onError?: (error: Error) => void,
): Unsubscribe {
  const rangeStart = startDate;
  const rangeEnd = typeof endDateOrCallback === 'string' ? endDateOrCallback : getWeekEnd(startDate);
  const callback = (typeof endDateOrCallback === 'function' ? endDateOrCallback : callbackOrError) as (records: WeeklyHistoryRecord[]) => void;
  const handleError = typeof endDateOrCallback === 'string' && typeof callbackOrError === 'function'
    ? (callbackOrError as (error: Error) => void)
    : onError;

  if (!teamCode || !rangeStart) { callback?.([]); return () => {}; }

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
        weekStart: rangeStart,
        weekEnd: rangeEnd,
        firstDate: date,
        lastDate: date,
        days,
        recordType: WEEKLY_HISTORY_TYPE,
      });
    };

    // First load permanent history. These records survive a daily deletion.
    snap.docs.forEach((d) => {
      const data = d.data() as FirestorePatientRecord;
      if (!isWeeklyHistory(data) || !data.rm) return;
      const days = Object.fromEntries(
        Object.entries(data.days || {}).filter(([dt]) => dt >= rangeStart && dt <= rangeEnd),
      );
      if (!Object.keys(days).length) return;
      ensureRecord(data as Patient, data.lastDate || rangeStart, days);
    });

    // Then overlay current daily records. This is the realtime source of truth
    // for patients currently visible in the dashboard.
    snap.docs.forEach((d) => {
      const data = d.data() as FirestorePatientRecord;
      if (isWeeklyHistory(data) || !data.date || data.date < rangeStart || data.date > rangeEnd || !data.rm) return;
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
      const prevWeeklyStatus = record.weeklyStatus;
      const prevAdmissionDate = record.admissionDate;
      Object.assign(record, latestPatient, { teamCode, weekStart: rangeStart, weekEnd: rangeEnd, days: record.days, recordType: WEEKLY_HISTORY_TYPE });
      if (prevWeeklyStatus && !record.weeklyStatus) record.weeklyStatus = prevWeeklyStatus;
      if (prevAdmissionDate && !record.admissionDate) record.admissionDate = prevAdmissionDate;
    });

    callback([...recordsByRm.values()]);
  }, (err) => {
    console.error('[Firestore] subscribeToWeeklyHistory error:', err);
    handleError?.(err);
  });
}

export function subscribeToPatients(teamCode: string, date: string, callback: (patients: Patient[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
  return onSnapshot(q, (snap) => {
    const patients = snap.docs
      .map((d) => d.data() as FirestorePatientRecord)
      .filter((data) => !isWeeklyHistory(data))
      .map((data) => sanitizePatientDoctorNames(data as Patient));
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
      .map((data) => sanitizePatientDoctorNames(data as Patient));
    callback(patients);
  }, (err) => {
    console.error('[Firestore] subscribeToTeamAllPatients error:', err);
    onError?.(err);
  });
}

export async function deletePatientFromFirestore(patient: Patient & { teamCode?: string; date?: string }): Promise<void> {
  const cleanPatient = sanitizePatientDoctorNames(patient);
  const teamCode = cleanPatient.teamCode || '';
  const date = cleanPatient.date || '';
  // Keep the weekly occurrence before deleting the daily record.
  if (teamCode && date && cleanPatient.rm) await recordWeeklyHistory(cleanPatient, teamCode, date);
  await deleteDoc(doc(db, COLLECTION, makeDocId(cleanPatient)));
}

export async function deleteAllPatientsForDateFromFirestore(teamCode: string, date: string): Promise<void> {
  if (!teamCode || !date) return;
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const data = d.data() as FirestorePatientRecord;
    if (!isWeeklyHistory(data)) {
      batch.delete(d.ref);
    }
  });
  await batch.commit();
}

export async function upsertPatientToFirestore(patient: Patient, teamCode: string, date: string): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  const cleanPatient = sanitizePatientDoctorNames(patient);
  const normalized = stripUndefined({ ...cleanPatient, teamCode, date, updatedAt: new Date().toISOString() });
  await setDoc(doc(db, COLLECTION, makeDocId(normalized)), normalized);
  // Stable IDs are authoritative. Do not speculatively delete a legacy
  // document whose existence has not been verified.
  await recordWeeklyHistory(normalized, teamCode, date);
}

/** Atomically import a complete AI result; no partial patient imports. */
export async function upsertPatientsToFirestore(patients: Patient[], teamCode: string, date: string): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  if (!patients.length) return;
  const cleanPatients = patients.map(sanitizePatientDoctorNames);
  const batch = writeBatch(db);
  const recordedAt = new Date().toISOString();
  const weekStart = getWeekStart(date);
  const weekEnd = getWeekEnd(weekStart);
  cleanPatients.forEach((patient) => {
    const normalized = stripUndefined({ ...patient, teamCode, date, updatedAt: recordedAt });
    batch.set(doc(db, COLLECTION, makeDocId(normalized)), normalized);
    // AI import is atomic: never add speculative legacy deletes because a
    // missing delete target can make the whole batch fail with permission-denied.
    if (normalized.rm) {
      const historyRef = doc(db, COLLECTION, weeklyDocId(teamCode, weekStart, normalized.rm));
      batch.set(historyRef, stripUndefined({
        ...normalized,
        recordType: WEEKLY_HISTORY_TYPE,
        weekStart,
        weekEnd,
        firstDate: date,
        lastDate: date,
        updatedAt: recordedAt,
        [`days.${date}`]: { patient: normalized, recordedAt },
      }), { merge: true });
    }
  });
  await batch.commit();
}

export async function movePatientToDateFirestore(patient: Patient, teamCode: string, fromDate: string, toDate: string): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  if (!fromDate || !toDate) throw new Error('Tanggal asal/tujuan tidak valid.');
  if (fromDate === toDate) throw new Error('Tanggal tujuan sama dengan tanggal asal.');

  const cleanPatient = sanitizePatientDoctorNames(patient);
  const targetQuery = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', toDate));
  const targetSnap = await getDocs(targetQuery);
  const patientRm = cleanPatient.rm?.trim().toLowerCase();
  const duplicate = targetSnap.docs.some((d) => {
    const data = d.data() as FirestorePatientRecord;
    return !isWeeklyHistory(data) && !!patientRm && data.rm?.trim().toLowerCase() === patientRm;
  });
  if (duplicate) throw new Error(`Pasien dengan No. RM ${cleanPatient.rm || '-'} sudah ada pada ${toDate}.`);

  const movedPatient: Patient = { ...cleanPatient, teamCode, date: toDate, updatedAt: new Date().toISOString() };
  await recordWeeklyHistory(cleanPatient, teamCode, fromDate);
  await recordWeeklyHistory(movedPatient, teamCode, toDate);

  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTION, makeDocId({ ...cleanPatient, teamCode, date: fromDate })));
  // Delete only the known stable source document. Legacy cleanup is not
  // performed speculatively during a move.
  batch.set(doc(db, COLLECTION, makeDocId(movedPatient)), movedPatient);
  await batch.commit();
}

/**
 * Migrasi nama dokter di seluruh database Firestore (koleksi sweepinganku).
 * Mengubah setiap kemunculan variasi nama 'dr. Fahad Ahmed Shah Khaisama T., Sp.BA'
 * menjadi 'dr. Fahad Ahmed Shah K., Sp.BA' pada data pasien harian maupun rekap mingguan.
 */
export async function migrateDoctorNamesInFirestore(): Promise<number> {
  if (!auth.currentUser) return 0;
  try {
    const q = collection(db, COLLECTION);
    const snap = await getDocs(q);
    let updatedCount = 0;
    
    let currentBatch = writeBatch(db);
    let batchOps = 0;

    for (const d of snap.docs) {
      const data = d.data() as FirestorePatientRecord;
      let changed = false;
      const updatedData: Record<string, any> = { ...data };

      if (data.dpjp && (OLD_FAHAD_REGEX.test(data.dpjp) || data.dpjp.includes('Khaisama'))) {
        updatedData.dpjp = TARGET_FAHAD_NAME;
        changed = true;
      }
      if (data.supervisingDpjp && (OLD_FAHAD_REGEX.test(data.supervisingDpjp) || data.supervisingDpjp.includes('Khaisama'))) {
        updatedData.supervisingDpjp = TARGET_FAHAD_NAME;
        changed = true;
      }

      if (isWeeklyHistory(data) && data.days && typeof data.days === 'object') {
        const newDays: Record<string, any> = { ...data.days };
        let daysChanged = false;
        Object.entries(newDays).forEach(([dayKey, dayVal]) => {
          if (dayVal?.patient) {
            const pat = { ...dayVal.patient };
            let patChanged = false;
            if (pat.dpjp && (OLD_FAHAD_REGEX.test(pat.dpjp) || pat.dpjp.includes('Khaisama'))) {
              pat.dpjp = TARGET_FAHAD_NAME;
              patChanged = true;
            }
            if (pat.supervisingDpjp && (OLD_FAHAD_REGEX.test(pat.supervisingDpjp) || pat.supervisingDpjp.includes('Khaisama'))) {
              pat.supervisingDpjp = TARGET_FAHAD_NAME;
              patChanged = true;
            }
            if (patChanged) {
              newDays[dayKey] = { ...dayVal, patient: pat };
              daysChanged = true;
            }
          }
        });
        if (daysChanged) {
          updatedData.days = newDays;
          changed = true;
        }
      }

      if (changed) {
        currentBatch.set(d.ref, stripUndefined(updatedData), { merge: true });
        batchOps++;
        updatedCount++;

        if (batchOps >= 400) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          batchOps = 0;
        }
      }
    }

    if (batchOps > 0) {
      await currentBatch.commit();
    }

    if (updatedCount > 0) {
      console.log(`[Firestore Migration] Berhasil memperbarui ${updatedCount} dokumen ke nama dokter baru: ${TARGET_FAHAD_NAME}`);
    }
    return updatedCount;
  } catch (err) {
    console.error('[Firestore Migration] Gagal melakukan migrasi nama dokter:', err);
    return 0;
  }
}
