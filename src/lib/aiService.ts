import { auth, db } from './firebase';
import { doc, runTransaction } from 'firebase/firestore';

const MAX_AI_REQUESTS_PER_DAY = 5;
const AI_USAGE_TEAM_CODE = 'ai_usage_registry';
const ADMIN_EMAIL = 'm.hafidzuddin.s@gmail.com';

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

class AiDailyQuotaError extends Error {
  code = 'AI_DAILY_LIMIT';
  constructor() {
    super(`Batas penggunaan AI hari ini sudah tercapai (${MAX_AI_REQUESTS_PER_DAY}x). Kuota akan tersedia kembali besok.`);
  }
}

function getQuotaDate(): string {
  const timeZone = 'Asia/Makassar';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isAdminUser(): boolean {
  return String(auth.currentUser?.email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

async function reserveDailyAiQuota(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi login tidak ditemukan. Silakan login kembali sebelum menggunakan AI.');
  if (isAdminUser()) return;

  const quotaDate = getQuotaDate();
  const quotaRef = doc(db, 'teamMembers', AI_USAGE_TEAM_CODE, 'members', user.uid);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(quotaRef);
    const data = snapshot.exists() ? snapshot.data() : {};
    const storedDate = String(data.aiQuotaDate || '');
    const storedCount = storedDate === quotaDate ? Number(data.aiQuotaCount || 0) : 0;
    const currentCount = Number.isFinite(storedCount) && storedCount >= 0 ? Math.floor(storedCount) : 0;

    if (currentCount >= MAX_AI_REQUESTS_PER_DAY) {
      throw new AiDailyQuotaError();
    }

    transaction.set(quotaRef, {
      uid: user.uid,
      name: user.displayName || user.email || user.uid,
      email: user.email || '',
      aiQuotaDate: quotaDate,
      aiQuotaCount: currentCount + 1,
    }, { merge: true });
  });
}

export async function parsePatientsWithAi(
  text: string,
  division: string,
  knownRooms: string[] = [],
  knownDpjps: string[] = [],
  knownPediatricDpjps: string[] = []
): Promise<ParsedPatientRaw[]> {
  // ── Tahap 1: Validasi sesi & kuota (pisah dari fetch agar error-nya jelas) ──
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi login tidak ditemukan. Silakan login kembali sebelum menggunakan AI.');

  try {
    await reserveDailyAiQuota();
  } catch (err: any) {
    if (err?.code === 'AI_DAILY_LIMIT') throw err;
    if (err?.code === 'permission-denied') {
      throw new Error('Kuota AI tidak dapat dicatat karena izin Firebase belum tersinkron. Silakan coba lagi setelah konfigurasi Firebase diperbarui.');
    }
    throw err;
  }

  // ── Tahap 2: Ambil token — paksa refresh agar tidak pakai token cache yang expired ──
  let idToken: string;
  try {
    // forceRefresh = true → selalu minta token baru ke Firebase, hindari error
    // "Sesi Firebase tidak valid atau sudah kedaluwarsa" akibat token 1 jam expired
    idToken = await user.getIdToken(true);
  } catch (err: any) {
    throw new Error('Sesi login telah berakhir. Silakan logout lalu login kembali untuk melanjutkan.');
  }

  // ── Tahap 3: Kirim request ke server AI ──
  let response: Response;
  try {
    response = await fetch('/api/ai/parse-patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ text, division, knownRooms, knownDpjps, knownPediatricDpjps }),
    });
  } catch (err: any) {
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
