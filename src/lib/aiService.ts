import { Patient } from '../types';

export interface ParsedPatientRaw {
  name: string;
  age: string;
  jk: 'L' | 'P';
  rm: string;
  room: string;
  kamar: string;
  dpjp: string;
  dx: string;
}

export interface ParseResponse {
  success: boolean;
  count?: number;
  patients?: ParsedPatientRaw[];
  error?: string;
}

/**
 * Sends unstructured patient notes to the server-side Gemini AI endpoint.
 * Extracted data only includes: name, age, jk, rm, room, kamar, dpjp, dx.
 */
export async function parsePatientsWithAi(
  text: string,
  division: string,
  knownRooms: string[] = [],
  knownDpjps: string[] = []
): Promise<ParsedPatientRaw[]> {
  let response: Response;
  try {
    response = await fetch('/api/ai/parse-patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        division,
        knownRooms,
        knownDpjps,
      }),
    });
  } catch (netErr: any) {
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
    // Format pesan error Google jika dalam bentuk raw JSON
    if (typeof msg === 'string' && msg.includes('503') && (msg.includes('high demand') || msg.includes('UNAVAILABLE'))) {
      msg = 'Server Google AI sedang mengalami lonjakan trafik sesaat. Sistem telah mencoba ulang, silakan klik tombol "Ekstrak Pasien" sekali lagi.';
    } else if (typeof msg === 'string' && msg.includes('429') && msg.includes('RESOURCE_EXHAUSTED')) {
      msg = 'Batas permintaan API tercapai untuk sementara waktu. Silakan tunggu 10 detik lalu coba lagi.';
    }
    throw new Error(msg);
  }

  return data.patients || [];
}
