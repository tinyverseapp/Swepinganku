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
 * Sends unstructured patient notes to the server-side Gemini endpoint.
 * The endpoint is deployed as a Vercel Function at /api/ai/parse-patients.
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, division, knownRooms, knownDpjps }),
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke layanan AI. Periksa koneksi internet lalu coba lagi.');
  }

  const contentType = response.headers.get('content-type') || '';
  let data: ParseResponse | null = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json() as ParseResponse;
    } catch {
      data = null;
    }
  } else {
    // This prevents the old SPA rewrite problem from surfacing as a vague JSON error.
    const body = await response.text().catch(() => '');
    if (body.includes('<!doctype html') || body.includes('<html')) {
      throw new Error('Endpoint AI belum tersedia pada deployment Vercel ini. Tunggu deployment terbaru selesai lalu coba lagi.');
    }
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Layanan AI gagal (HTTP ${response.status}).`);
  }

  return Array.isArray(data.patients) ? data.patients : [];
}
