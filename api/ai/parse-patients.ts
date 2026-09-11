import { GoogleGenAI, Type } from '@google/genai';

interface ParseRequestBody {
  text?: unknown;
  division?: unknown;
  knownRooms?: unknown;
  knownDpjps?: unknown;
}

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'swepinganku-vercel' } },
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { success: false, error: 'Method tidak diizinkan.' });
  }

  try {
    const body = (req.body || {}) as ParseRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const division = typeof body.division === 'string' ? body.division : 'Bedah';
    const knownRooms = Array.isArray(body.knownRooms) ? body.knownRooms.filter((x): x is string => typeof x === 'string') : [];
    const knownDpjps = Array.isArray(body.knownDpjps) ? body.knownDpjps.filter((x): x is string => typeof x === 'string') : [];

    if (!text) {
      return json(res, 400, {
        success: false,
        error: 'Teks catatan pasien tidak boleh kosong. Silakan tempel catatan terlebih dahulu.',
      });
    }

    if (text.length > 100000) {
      return json(res, 413, { success: false, error: 'Catatan terlalu panjang. Batasi maksimal 100.000 karakter.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return json(res, 500, {
        success: false,
        error: 'GEMINI_API_KEY belum terpasang di Vercel. Tambahkan environment variable GEMINI_API_KEY pada Project Settings → Environment Variables.',
      });
    }

    const prompt = `Anda adalah asisten medis koas bedah berpengalaman.
Tugas Anda adalah membaca dan mengekstrak catatan pasien dari berbagai format teks mentah bebas (catatan operan jaga WhatsApp, catatan ronde bangsal, resume stase sebelumnya, atau format bebas) menjadi format data pasien terstruktur yang bersih.

DIVISI STASE AKTIF: ${division}
DAFTAR RUANGAN / BANGSAL ACUAN:
${knownRooms.length ? knownRooms.join(', ') : 'IGD, Seroja, NICU, PICU, ICCU, ICU, Ratai, Anggrek, Edelweiss, Cempaka, Aster, Melati, Flamboyan 1, Flamboyan 2, HCU, Angsoka, Dahlia'}

DAFTAR DOKTER DPJP KONSULEN ACUAN:
${knownDpjps.length ? knownDpjps.join('\n') : '-'}

ATURAN STRUKTUR DATA (SANGAT KETAT):
1. name: Nama pasien. Pertahankan sebutan jika ada (Tn, Ny, An, By, dsb.).
2. age: Usia pasien dalam format singkat. Jika tidak tertera, gunakan string kosong "".
3. jk: HARUS bernilai 'L' atau 'P'. Bila tidak jelas, simpulkan dari sapaan/nama atau default 'L'.
4. rm: Nomor Rekam Medis jika ada. Jika tidak ada, gunakan string kosong "".
5. room: Nama ruangan/bangsal. Jika ada di teks, pertahankan nama tersebut.
6. kamar: Nomor kamar atau nomor bed.
7. dpjp: Nama dokter konsulen/DPJP yang merawat. Jika cocok dengan acuan, gunakan format lengkapnya.
8. dx: HANYA diagnosis penyakit/diagnosis kerja secara ringkas dan medis. JANGAN memasukkan tindakan operasi, pre/post op, TTV, atau catatan khusus.

TEKS CATATAN MENTAH:
"""
${text}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah asisten medis cerdas koas bedah yang mengekstrak catatan pasien mentah menjadi JSON terstruktur. Jangan menambahkan informasi klinis yang tidak ada di catatan kecuali inferensi jenis kelamin yang diminta.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'Daftar pasien yang berhasil diekstrak',
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              age: { type: Type.STRING },
              jk: { type: Type.STRING },
              rm: { type: Type.STRING },
              room: { type: Type.STRING },
              kamar: { type: Type.STRING },
              dpjp: { type: Type.STRING },
              dx: { type: Type.STRING },
            },
            required: ['name', 'jk', 'dx'],
          },
        },
      },
    });

    const rawText = response.text?.trim() || '[]';
    let parsedPatients: unknown;
    try {
      parsedPatients = JSON.parse(rawText);
    } catch {
      console.error('[Gemini AI] Invalid JSON:', rawText);
      return json(res, 502, { success: false, error: 'AI mengembalikan format yang tidak dapat diproses. Silakan coba lagi.' });
    }

    const formatted = Array.isArray(parsedPatients)
      ? parsedPatients.map((p: any) => ({
          name: String(p?.name || '').trim(),
          age: String(p?.age || '').trim(),
          jk: p?.jk === 'P' ? 'P' : 'L',
          rm: String(p?.rm || '').trim(),
          room: String(p?.room || '').trim(),
          kamar: String(p?.kamar || '').trim(),
          dpjp: String(p?.dpjp || '').trim(),
          dx: String(p?.dx || '').trim(),
        })).filter((p) => p.name.length > 0)
      : [];

    return json(res, 200, { success: true, count: formatted.length, patients: formatted });
  } catch (err: any) {
    console.error('[Gemini AI Error]', err);
    return json(res, 500, {
      success: false,
      error: err?.message || 'Terjadi kendala saat menghubungi AI.',
    });
  }
}
