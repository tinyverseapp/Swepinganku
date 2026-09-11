import { GoogleGenAI, Type } from '@google/genai';

interface ParseRequestBody { text?: unknown; division?: unknown; knownRooms?: unknown; knownDpjps?: unknown; }
function json(res: any, status: number, body: unknown) { res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body)); }
function getGeminiClient() { const key = process.env.GEMINI_API_KEY; return key ? new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'swepinganku-vercel' } } }) : null; }

const MASTER_ROOM_ALIASES: Record<string, string> = {
  'edelweiss': 'Edelweis', 'edelweis': 'Edelweis', 'ratai': 'Teratai', 'teratai': 'Teratai',
  'igd': 'IGD', 'seroja': 'Seroja', 'nicu': 'NICU', 'picu': 'PICU', 'iccu': 'ICCU', 'icu': 'ICU',
  'anggrek': 'Anggrek', 'cempaka': 'Cempaka', 'aster': 'Aster', 'melati': 'Melati',
  'flamboyan 1': 'Flamboyan 1', 'flamboyan 2': 'Flamboyan 2', 'hcu': 'HCU', 'angsoka': 'Angsoka', 'dahlia': 'Dahlia'
};

function normalizeRoom(value: unknown, knownRooms: string[]): string {
  const raw = String(value ?? '').trim(); if (!raw) return '';
  const pool = knownRooms.length ? knownRooms : Object.values(MASTER_ROOM_ALIASES);
  const exact = pool.find((room) => room.toLowerCase() === raw.toLowerCase()); if (exact) return exact;
  const alias = MASTER_ROOM_ALIASES[raw.toLowerCase()]; if (alias) return alias;
  const compact = raw.toLowerCase().replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const matched = pool.find((room) => room.toLowerCase().replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim() === compact);
  return matched || '';
}

function normalizeDpjp(value: unknown, knownDpjps: string[]): string {
  const raw = String(value ?? '').trim(); if (!raw || !knownDpjps.length) return raw;
  const exact = knownDpjps.find((d) => d.toLowerCase() === raw.toLowerCase()); if (exact) return exact;
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fuzzy = knownDpjps.find((d) => d.toLowerCase().replace(/[^a-z0-9]/g, '').includes(compact) || compact.includes(d.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return fuzzy || raw;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { success: false, error: 'Method tidak diizinkan.' }); }
  try {
    const body = (req.body || {}) as ParseRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const division = typeof body.division === 'string' ? body.division : 'Bedah';
    const knownRooms = Array.isArray(body.knownRooms) ? body.knownRooms.filter((x): x is string => typeof x === 'string') : [];
    const knownDpjps = Array.isArray(body.knownDpjps) ? body.knownDpjps.filter((x): x is string => typeof x === 'string') : [];
    if (!text) return json(res, 400, { success: false, error: 'Teks catatan pasien tidak boleh kosong. Silakan tempel catatan terlebih dahulu.' });
    if (text.length > 100000) return json(res, 413, { success: false, error: 'Catatan terlalu panjang. Batasi maksimal 100.000 karakter.' });
    const ai = getGeminiClient();
    if (!ai) return json(res, 500, { success: false, error: 'GEMINI_API_KEY belum terpasang di Vercel.' });

    const roomList = knownRooms.length ? knownRooms.join(', ') : Object.values(MASTER_ROOM_ALIASES).join(', ');
    const prompt = `Anda adalah asisten ekstraksi data medis. Ekstrak HANYA informasi yang benar-benar tertulis atau sangat eksplisit pada catatan. DILARANG mengarang, melengkapi, atau menebak data klinis.

DIVISI: ${division}
DAFTAR RUANGAN RESMI: ${roomList}
DAFTAR DPJP RESMI:
${knownDpjps.length ? knownDpjps.join('\n') : '-'}

ATURAN WAJIB:
1. name: nama pasien bila tersedia. Jika tidak ada, kosongkan.
2. age: usia hanya jika tertulis/terbaca jelas. Jika tidak ada, "".
3. jk: gunakan 'L' atau 'P' hanya jika jelas dari catatan. Jika gender TIDAK jelas, WAJIB gunakan "". JANGAN menebak dari nama, sapaan, diagnosis, atau konteks.
4. rm: nomor rekam medis hanya jika ada. Jika tidak ada, "".
5. room: ruangan hanya jika disebutkan. Jangan menebak dari nomor kamar/bed. Gunakan nama persis yang paling sesuai dengan daftar resmi.
6. kamar: nomor kamar/bed hanya jika ada. Jika tidak ada, "".
7. dpjp: hanya dokter yang disebut sebagai DPJP/dokter yang merawat. Jika tidak jelas, "". Jangan memilih dokter hanya karena ada di daftar resmi.
8. dx: diagnosis/diagnosis kerja hanya jika disebutkan atau jelas secara eksplisit. Jika tidak ada, "". Jangan membuat diagnosis dari tindakan, obat, TTV, atau asumsi klinis.
9. Jangan memasukkan tindakan operasi, status pre/post-op, TTV, atau catatan lain ke field dx.
10. Jangan mengubah fakta pasien. Data yang tidak lengkap harus tetap kosong.

CATATAN MENTAH:
"""
${text}
"""`;

    const response = await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: prompt, config: {
      systemInstruction: 'Ekstrak data medis tanpa halusinasi. Jika suatu field tidak tersedia atau ambigu, isi string kosong. Jangan menebak jenis kelamin. Jangan membuat diagnosis. Semua output harus dapat ditelusuri ke teks sumber.',
      responseMimeType: 'application/json',
      responseSchema: { type: Type.ARRAY, description: 'Daftar pasien hasil ekstraksi', items: { type: Type.OBJECT, properties: {
        name: { type: Type.STRING }, age: { type: Type.STRING }, jk: { type: Type.STRING }, rm: { type: Type.STRING }, room: { type: Type.STRING }, kamar: { type: Type.STRING }, dpjp: { type: Type.STRING }, dx: { type: Type.STRING }
      }, required: ['name', 'age', 'jk', 'rm', 'room', 'kamar', 'dpjp', 'dx'] } }
    }});

    const rawText = response.text?.trim() || '[]';
    let parsedPatients: unknown;
    try { parsedPatients = JSON.parse(rawText); } catch { console.error('[Gemini AI] Invalid JSON:', rawText); return json(res, 502, { success: false, error: 'AI mengembalikan format yang tidak dapat diproses. Silakan coba lagi.' }); }
    const formatted = Array.isArray(parsedPatients) ? parsedPatients.map((p: any) => ({
      name: String(p?.name || '').trim(), age: String(p?.age || '').trim(), jk: p?.jk === 'L' || p?.jk === 'P' ? p.jk : '', rm: String(p?.rm || '').trim(),
      room: normalizeRoom(p?.room, knownRooms), kamar: String(p?.kamar || '').trim(), dpjp: normalizeDpjp(p?.dpjp, knownDpjps), dx: String(p?.dx || '').trim()
    })).filter((p) => p.name.length > 0) : [];
    return json(res, 200, { success: true, count: formatted.length, patients: formatted });
  } catch (err: any) { console.error('[Gemini AI Error]', err); return json(res, 500, { success: false, error: err?.message || 'Terjadi kendala saat menghubungi AI.' }); }
}
