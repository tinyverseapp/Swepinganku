/**
 * firestoreService.ts
 * Layer sinkronisasi Firestore untuk data pasien tim.
 * Koleksi: sweepinganku/{patientId}
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

/** Buat ID dokumen yang unik dan aman untuk Firestore */
function makeDocId(patient: Patient): string {
  // Sanitize: hanya alfanumerik, _, -, .
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_\-.:]/g, '_').substring(0, 40);
  return `${safe(patient.teamCode || 'NOTEAM')}_${safe(patient.date)}_${safe(patient.rm || patient.id)}`;
}

/** Simpan seluruh daftar pasien untuk satu tim & tanggal ke Firestore */
export async function savePatientsBatch(
  teamCode: string,
  date: string,
  patients: Patient[]
): Promise<void> {
  try {
    // 1. Hapus data lama untuk teamCode + date ini
    const q = query(
      collection(db, COLLECTION),
      where('teamCode', '==', teamCode),
      where('date', '==', date)
    );
    const existing = await getDocs(q);

    const batch = writeBatch(db);

    // Hapus dokumen lama
    existing.docs.forEach((d) => batch.delete(d.ref));

    // Tulis dokumen baru
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
    console.warn('[Firestore] savePatientsBatch gagal, data tetap di localStorage:', err);
  }
}

/** Ambil pasien untuk satu tim & tanggal dari Firestore (satu kali fetch) */
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
    if (snap.empty) return null;
    return snap.docs.map((d) => d.data() as Patient);
  } catch (err) {
    console.warn('[Firestore] fetchPatientsFromFirestore gagal:', err);
    return null;
  }
}

/**
 * Langganan real-time ke pasien tim & tanggal tertentu.
 * Memanggil callback setiap kali data berubah.
 * Kembalikan fungsi unsubscribe untuk membersihkan listener.
 */
export function subscribeToPatients(
  teamCode: string,
  date: string,
  callback: (patients: Patient[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    where('teamCode', '==', teamCode),
    where('date', '==', date)
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const patients = snap.docs.map((d) => d.data() as Patient);
      callback(patients);
    },
    (err) => {
      console.warn('[Firestore] subscribeToPatients error:', err);
    }
  );

  return unsub;
}

/** Hapus satu pasien dari Firestore */
export async function deletePatientFromFirestore(
  patient: Patient
): Promise<void> {
  try {
    const docId = makeDocId(patient);
    await deleteDoc(doc(db, COLLECTION, docId));
  } catch (err) {
    console.warn('[Firestore] deletePatientFromFirestore gagal:', err);
  }
}

/** Upsert satu pasien ke Firestore */
export async function upsertPatientToFirestore(
  patient: Patient,
  teamCode: string,
  date: string
): Promise<void> {
  try {
    const docId = makeDocId({ ...patient, teamCode, date });
    await setDoc(doc(db, COLLECTION, docId), {
      ...patient,
      teamCode,
      date,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Firestore] upsertPatientToFirestore gagal:', err);
  }
}
