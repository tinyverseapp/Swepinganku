import { Patient } from '../types';
import { auth } from './firebase';

export interface ParsedPatientRaw {
  name: string;
  age: string;
  jk: 'L' | 'P' | '';
  rm: string;
  room: string;
  kamar: string;
  dpjp: string;
  doctorRole?: 'DPJP' | 'RABER' | 'KONSUL';
  supervisingDpjp?: string;
  dx: string;
}

export interface ParseResponse {
  success: boolean;
  count?: number;
  patients?: ParsedPatientRaw[];
  error?: string;
}

/**
 * Sends unstructured patient notes to the authenticated server-side AI endpoint.
 * AI output is treated as a draft and never invents unknown sex/doctor-role data.
 */
export async function parsePatientsWithAi(
  text: string,
  division: string,
  knownRooms: string[] = [],
  knownDpjps: string[] = []
): Promise<ParsedPatientRaw[]> {
  let response: Response;
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesi login tidak ditemukan. Silakan login kembali sebelum menggunakan AI.');
    const idToken = await user.getIdToken();

    response = await fetch('/api/ai/parse-patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ text, division, knownRooms, knownDpjps }),
    });
  } catch (netErr: any) {
    if (netErr?.message?.includes('Sesi login')) throw netErr;
    throw new Error('Tidak dapat terhubung ke server AI. Periksa koneksi internet Anda atau coba sesaat lagi.');
  }

  let data: ParseResponse;
  const rawResponseText = await response.text();
  try {
    data = JSON.parse(rawResponseText);
  } catch {
    if (response.status === 404) {
      throw new Error('Endpoint AI (/api/ai/parse-patients) belum tersedia di server ini. Jika di Vercel, pastikan serverless function terpasang.');
    }
    throw new Error(`Server memberikan respon yang tidak valid (Status ${response.status}). Silakan coba beberapa detik lagi.`);
  }

  if (!response.ok || !data.success) {
    let msg = data.error || 'Gagal memproses catatan pasien dengan AI.';
    if (typeof msg === 'string' && msg.includes('503') && (msg.includes('high demand') || msg.includes('UNAVAILABLE'))) {
      msg = 'Server Google AI sedang mengalami lonjakan trafik sesaat. Sistem telah mencoba ulang, silakan klik tombol "Ekstrak Pasien" sekali lagi.';
    } else if (typeof msg === 'string' && msg.includes('429') && msg.includes('RESOURCE_EXHAUSTED')) {
      msg = 'Batas permintaan API tercapai untuk sementara waktu. Silakan tunggu 10 detik lalu coba lagi.';
    }
    throw new Error(msg);
  }

  return (data.patients || []).map((p) => ({
    ...p,
    jk: p.jk === 'L' || p.jk === 'P' ? p.jk : '',
    doctorRole: p.doctorRole === 'RABER' || p.doctorRole === 'KONSUL' || p.doctorRole === 'DPJP' ? p.doctorRole : undefined,
    supervisingDpjp: String(p.supervisingDpjp || '').trim() || undefined,
  }));
}
