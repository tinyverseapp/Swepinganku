/**
 * Firestore synchronization layer for Swepinganku patient data.
 * Collection: sweepinganku/{patientId}
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

function makeDocId(patient: Patient & { teamCode?: string; date?: string }): string {
  const safe = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_\-.:]/g, '_').substring(0, 40);
  return `${safe(patient.teamCode || 'NOTEAM')}_${safe(patient.date)}_${safe(patient.rm || patient.id)}`;
}

/** Save the complete patient list for one team/date. */
export async function savePatientsBatch(
  teamCode: string,
  date: string,
  patients: Patient[]
): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');

  try {
    const q = query(
      collection(db, COLLECTION),
      where('teamCode', '==', teamCode),
      where('date', '==', date)
    );
    const existing = await getDocs(q);
    const batch = writeBatch(db);

    existing.docs.forEach((d) => batch.delete(d.ref));

    patients.forEach((p) => {
      const docId = makeDocId({ ...p, teamCode, date });
      const ref = doc(db, COLLECTION, docId);
      batch.set(ref, {
        ...p,
        teamCode,
        date,
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
  } catch (err) {
    console.error('[Firestore] savePatientsBatch gagal:', err);
    throw err;
  }
}

/** Fetch patients for one team/date. */
export async function fetchPatientsFromFirestore(
  teamCode: string,
  date: string
): Promise<Patient[] | null> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('teamCode', '==', teamCode),
      where('date', '==', date)
    );
    const snap = await getDocs(q);
    if (snap.empty) return [];
    return snap.docs.map((d) => d.data() as Patient);
  } catch (err) {
    console.error('[Firestore] fetchPatientsFromFirestore gagal:', err);
    throw err;
  }
}

/** Subscribe to real-time changes for one team/date. */
export function subscribeToPatients(
  teamCode: string,
  date: string,
  callback: (patients: Patient[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where('teamCode', '==', teamCode),
    where('date', '==', date)
  );

  return onSnapshot(
    q,
    (snap) => {
      // The Firestore snapshot is the source of truth. In particular, [] must
      // clear the local view so deletes propagate to every connected device.
      callback(snap.docs.map((d) => d.data() as Patient));
    },
    (err) => {
      console.error('[Firestore] subscribeToPatients error:', err);
      onError?.(err);
    }
  );
}

/** Subscribe to real-time changes for all patients of a team across all dates. */
export function subscribeToTeamAllPatients(
  teamCode: string,
  callback: (patients: Patient[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!teamCode) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION),
    where('teamCode', '==', teamCode)
  );

  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => d.data() as Patient));
    },
    (err) => {
      console.error('[Firestore] subscribeToTeamAllPatients error:', err);
      onError?.(err);
    }
  );
}

/** Delete one patient from Firestore. */
export async function deletePatientFromFirestore(
  patient: Patient & { teamCode?: string; date?: string }
): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, makeDocId(patient)));
  } catch (err) {
    console.error('[Firestore] deletePatientFromFirestore gagal:', err);
    throw err;
  }
}

/** Upsert one patient into Firestore. */
export async function upsertPatientToFirestore(
  patient: Patient,
  teamCode: string,
  date: string
): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');

  try {
    const docId = makeDocId({ ...patient, teamCode, date });
    await setDoc(doc(db, COLLECTION, docId), {
      ...patient,
      teamCode,
      date,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Firestore] upsertPatientToFirestore gagal:', err);
    throw err;
  }
}

/**
 * Move one patient atomically from one date to another for the same team.
 * The source document is deleted and the destination document is created in
 * a single Firestore batch so other team members see one consistent change.
 */
export async function movePatientToDateFirestore(
  patient: Patient,
  teamCode: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  if (!fromDate || !toDate) throw new Error('Tanggal asal/tujuan tidak valid.');
  if (fromDate === toDate) throw new Error('Tanggal tujuan sama dengan tanggal asal.');

  try {
    const targetQuery = query(
      collection(db, COLLECTION),
      where('teamCode', '==', teamCode),
      where('date', '==', toDate)
    );
    const targetSnap = await getDocs(targetQuery);
    const patientRm = patient.rm?.trim().toLowerCase();
    const duplicate = targetSnap.docs.some((d) => {
      const data = d.data() as Patient;
      return patientRm && data.rm?.trim().toLowerCase() === patientRm;
    });

    if (duplicate) {
      throw new Error(`Pasien dengan No. RM ${patient.rm || '-'} sudah ada pada ${toDate}.`);
    }

    const movedPatient: Patient = {
      ...patient,
      teamCode,
      date: toDate,
      updatedAt: new Date().toISOString(),
    };
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTION, makeDocId({ ...patient, teamCode, date: fromDate })));
    batch.set(doc(db, COLLECTION, makeDocId(movedPatient)), movedPatient);
    await batch.commit();
  } catch (err) {
    console.error('[Firestore] movePatientToDateFirestore gagal:', err);
    throw err;
  }
}
