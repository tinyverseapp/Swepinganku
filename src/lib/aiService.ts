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
  const response = await fetch('/api/ai/parse-patients', {
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

  const data: ParseResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Gagal memproses catatan pasien dengan AI.');
  }

  return data.patients || [];
}
