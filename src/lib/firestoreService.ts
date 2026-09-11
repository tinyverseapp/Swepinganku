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
export async function savePatientsBatch(teamCode: string, date: string, patients: Patient[]): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  try {
    const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '==', date));
    const existing = await getDocs(q);
    const batch = writeBatch(db);
    existing.docs.forEach((d) => batch.delete(d.ref));
    patients.forEach((p) => {
      const ref = doc(db, COLLECTION, makeDocId({ ...p, teamCode, date }));
      batch.set(ref, { ...p, teamCode, date, updatedAt: new Date().toISOString() });
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

/** Fetch every patient for a team in the requested date range directly from Firestore. */
export async function fetchPatientsForDateRange(teamCode: string, startDate: string, endDate: string): Promise<Patient[]> {
  if (!teamCode) return [];
  const q = query(collection(db, COLLECTION), where('teamCode', '==', teamCode), where('date', '>=', startDate), where('date', '<=', endDate));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Patient);
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
  await deleteDoc(doc(db, COLLECTION, makeDocId(patient)));
}

export async function upsertPatientToFirestore(patient: Patient, teamCode: string, date: string): Promise<void> {
  if (!teamCode) throw new Error('Kode tim Firebase kosong.');
  const docId = makeDocId({ ...patient, teamCode, date });
  await setDoc(doc(db, COLLECTION, docId), { ...patient, teamCode, date, updatedAt: new Date().toISOString() });
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
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTION, makeDocId({ ...patient, teamCode, date: fromDate })));
  batch.set(doc(db, COLLECTION, makeDocId(movedPatient)), movedPatient);
  await batch.commit();
}
