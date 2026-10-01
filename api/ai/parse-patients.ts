const recentRequests = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_TEXT_LENGTH = 30000;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const ADMIN_EMAIL = "m.hafidzuddin.s@gmail.com";

function getAllowedOrigin(req: any): string {
  const origin = String(req.headers?.origin || "");
  const configured = String(process.env.APP_ORIGIN || "").trim();
  if (configured && origin === configured) return origin;
  if (origin === "http://localhost:3000" || origin === "http://localhost:5173") return origin;
  if (/^https:\/\/[^/]+\.vercel\.app$/.test(origin)) return origin;
  return configured || "https://swepinganku.vercel.app";
}

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email?: string }> {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyDtb1gWEdVrp03Vy9vhG3w7jnnXxUQ8x8";
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) throw new Error("Sesi Firebase tidak valid atau sudah kedaluwarsa.");
  const data = await response.json();
  const user = data?.users?.[0];
  if (!user?.localId) throw new Error("Sesi Firebase tidak valid.");
  return { uid: user.localId, email: user.email };
}

function isAdmin(identity: { email?: string }): boolean {
  return String(identity.email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

function allowRate(uid: string): boolean {
  const now = Date.now();
  const recent = (recentRequests.get(uid) || []).filter((t) => now - t < 60_000);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) {
    recentRequests.set(uid, recent);
    return false;
  }
  recent.push(now);
  recentRequests.set(uid, recent);
  return true;
}

function normalizeModelName(name: string): string {
  return String(name || "").replace(/^models\//, "").trim();
}

function normalizeDob(raw?: any): string {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();
  str = str.replace(/^(dob|ttl|tgl\s*lahir|tanggal\s*lahir|lahir)\s*[:=\s\-]+/i, '').trim();
  if (!str) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const monthMap: Record<string, string> = {
    jan: '01', januari: '01', january: '01',
    feb: '02', februari: '02', february: '02',
    mar: '03', maret: '03', march: '03',
    apr: '04', april: '04',
    mei: '05', may: '05',
    jun: '06', juni: '06', june: '06',
    jul: '07', juli: '07', july: '07',
    agu: '08', agt: '08', agustus: '08', aug: '08', august: '08',
    sep: '09', september: '09',
    okt: '10', oktober: '10', oct: '10', october: '10',
    nov: '11', november: '11',
    des: '12', desember: '12', dec: '12', december: '12',
  };

  const textMonthMatch = str.match(/^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})$/);
  if (textMonthMatch) {
    const d = textMonthMatch[1].padStart(2, '0');
    const mStr = textMonthMatch[2].toLowerCase();
    const m = monthMap[mStr];
    const y = textMonthMatch[3];
    if (m) return `${y}-${m}-${d}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  const dmyShortMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (dmyShortMatch) {
    const d = dmyShortMatch[1].padStart(2, '0');
    const m = dmyShortMatch[2].padStart(2, '0');
    const yr = parseInt(dmyShortMatch[3], 10);
    const curYrShort = new Date().getFullYear() % 100;
    const y = yr <= curYrShort ? 2000 + yr : 1900 + yr;
    return `${y}-${m}-${d}`;
  }

  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() <= new Date().getFullYear() + 1) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${GEMINI_API_BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=100`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Gagal membaca daftar model Gemini (HTTP ${response.status}).`);
  }
  const data = await response.json();
  return Array.isArray(data?.models)
    ? data.models
        .filter((model: any) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
        .map((model: any) => normalizeModelName(model?.name))
        .filter(Boolean)
    : [];
}

function getModelCandidates(availableModels: string[]): string[] {
  // Jangan lagi fallback ke model 2.x yang dapat dinonaktifkan/ditolak untuk user baru.
  // Prioritas: model stabil terbaru yang benar-benar tersedia pada API key ini.
  const preferred = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash"];
  const available = new Set(availableModels.map(normalizeModelName));
  const discovered = preferred.filter((model) => available.has(model));
  return discovered.length ? discovered : preferred;
}

const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      age: { type: "STRING" },
      dob: { type: "STRING", description: "Tanggal lahir pasien format YYYY-MM-DD jika diketahui (DOB/TTL/Tgl Lahir), jika tidak ada kosongkan ''" },
      jk: { type: "STRING", description: "L, P, atau kosong" },
      rm: { type: "STRING" },
      room: { type: "STRING" },
      kamar: { type: "STRING" },
      dpjp: { type: "STRING", description: "Dokter yang memegang peran aplikasi: DPJP, RABER, atau KONSUL" },
      doctorRole: { type: "STRING", description: "DPJP, RABER, KONSUL, atau kosong" },
      supervisingDpjp: { type: "STRING", description: "DPJP utama jika dokter di field dpjp adalah RABER/KONSUL" },
      dx: { type: "STRING" },
    },
    required: ["name", "age", "jk", "rm", "room", "kamar", "dpjp", "doctorRole", "supervisingDpjp", "dx"],
  },
};

async function generateWithGemini(apiKey: string, modelName: string, prompt: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "swepinganku-ai" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: "Anda harus memprioritaskan hubungan DPJP/RABER/KONSUL yang tertulis. Jangan menentukan peran berdasarkan spesialisasi dokter. Output harus konsisten dengan definisi klinis dan contoh yang diberikan.",
        }],
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = String(data?.error?.message || "Gemini API menolak permintaan.").trim();
    const error: any = new Error(`${modelName}: ${apiMessage}`);
    error.status = response.status;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => String(part?.text || ""))
    .join("")
    .trim();
  if (!text) {
    throw new Error(`${modelName}: Gemini tidak mengembalikan teks JSON.`);
  }
  return text;
}

export default async function handler(req: any, res: any) {
  const origin = getAllowedOrigin(req);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed. Gunakan metode POST." });

  try {
    const authorization = String(req.headers?.authorization || "");
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) return res.status(401).json({ success: false, error: "Autentikasi diperlukan untuk menggunakan AI." });

    const identity = await verifyFirebaseIdToken(token);
    if (!isAdmin(identity) && !allowRate(identity.uid)) {
      return res.status(429).json({ success: false, error: "Terlalu banyak permintaan AI. Silakan tunggu sekitar 1 menit lalu coba lagi." });
    }

    const { text, division, knownRooms, knownDpjps, knownPediatricDpjps, allDivisionsDoctors } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, error: "Teks catatan pasien tidak boleh kosong." });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ success: false, error: `Teks terlalu panjang. Maksimal ${MAX_TEXT_LENGTH.toLocaleString("id-ID")} karakter per permintaan.` });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: "GEMINI_API_KEY belum disetel di Vercel Environment Variables." });

    const surgicalDoctors = Array.isArray(knownDpjps) ? knownDpjps.filter(Boolean) : [];
    const pediatricDoctors = Array.isArray(knownPediatricDpjps) ? knownPediatricDpjps.filter(Boolean) : [];

    const fallbackDivisions: Record<string, string[]> = {
      'Bedah Digestif & Umum': ['dr. Bambang Suprapto, Sp. B(K)BD', 'dr. Ahmad Toboroni Nasution, Sp. B(K)BD'],
      'Bedah Anak': ['dr. Santi Rini., Sp.BA., Subsp.DA(K)', 'dr. Fahad Ahmed Shah K., Sp.BA'],
      'Bedah Plastik': ['dr. Andi Mohammad Ardan, Sp. BP-RE', 'dr. Yudhy Arius, Sp. BP-RE'],
      'Bedah Onkologi': ['dr. Zainal Abidin, SpB.SubSp.Onk.(K).,MARS.,SH.,MH', 'dr. Irvan Tanri Liwang, Sp.B., Subsp.Onk(K)'],
      'Urologi': ['dr. Poppy Desra Syahfitri Nasution, Sp.U', 'dr. Made Adi Wiratama, Sp.U', 'dr. Muhammad Rozaqy Ishaq, Sp.U', 'dr. Boyke Soebhali, Sp.U(K)', 'dr. Ricky Agave Ompusunggu, Sp.U'],
      'BTKV': ['dr. Ivan Joalsen Mangara Tua, Sp.BTKV', 'dr. Michael Caesario, Sp.BTKV(K)', 'dr. Ery Irawan, Sp.BTKV', 'dr. David Hermawan Christian, Sp.BTKV'],
      'Ortopedi': ['dr. Yasser Ridwan, Sp.OT, K-Spine, FICS', 'dr. Hendri Purnama, Sp.OT, K-Hip&Knee', 'dr. Fahroni C. Winata, Sp.OT', 'dr. Achmad Fachrizal, Sp.OT'],
      'Bedah Saraf': ['dr. Dini Heryani, Sp.BS', 'dr. Taufiq Fatchur Rochman, Sp.BS']
    };
    const divisionMap = (allDivisionsDoctors && typeof allDivisionsDoctors === 'object') ? allDivisionsDoctors : fallbackDivisions;

    const otherDivisionsListText = Object.entries(divisionMap)
      .map(([divName, docs]) => `- ${divName}: ${(Array.isArray(docs) ? docs : []).join('; ')}`)
      .join('\n');

    const prompt = `Anda adalah asisten ekstraksi data klinis untuk aplikasi sweeping pasien stase bedah. Anda harus memahami hubungan tanggung jawab dokter, bukan sekadar mengenali nama spesialis.

KONSEP KLINIS WAJIB & ATURAN DPJP / RABER / KONSUL:
- DPJP = Dokter Penanggung Jawab Pelayanan. Ini adalah dokter utama yang bertanggung jawab atas pelayanan pasien. Jika catatan menyebut "DPJP", "DPJP utama", "dokter penanggung jawab", atau padanan yang jelas, dokter tersebut adalah DPJP.
- RABER = Rawat Bersama. Dokter dari bidang lain ikut merawat pasien bersama DPJP utama. Dokter RABER BUKAN DPJP utama.
- KONSUL = dokter yang dimintai konsultasi klinis. Dokter konsulen BUKAN DPJP utama kecuali teks secara eksplisit menyatakan ia juga DPJP.
- ATURAN DPJP UTAMA LINTAS DIVISI:
  * Dokter spesialis dari DIVISI BEDAH LAIN MANA PUN (seperti Bedah Digestif, Bedah Anak, Ortopedi, Urologi, BTKV, Bedah Plastik, Bedah Onkologi, Bedah Saraf) maupun Dokter Anak/Spesialis Penyakit Dalam/dll. BISA MENJADI DPJP UTAMA.
  * Dokter dari divisi stase aktif (${division || 'Bedah'}) bisa menjadi DPJP utama, BISA menjadi RABER, atau BISA menjadi KONSUL.
  * Jika pasien berstatus RABER atau KONSUL:
    - field 'dpjp': NAMA DOKTER DARI DIVISI STASE AKTIF (${division || 'Bedah'}) yang merawat/dikonsul.
    - field 'doctorRole': "RABER" atau "KONSUL".
    - field 'supervisingDpjp': NAMA DOKTER DPJP UTAMA (dapat berasal dari divisi bedah lain mana pun seperti Bedah Digestif, Bedah Anak, Ortopedi, Urologi, BTKV, Bedah Onkologi, Bedah Saraf, dll., maupun Dokter Anak).
  * Jika pasien berstatus DPJP murni:
    - field 'dpjp': Nama dokter DPJP.
    - field 'doctorRole': "DPJP".
    - field 'supervisingDpjp': string kosong "".

CONTOH WAJIB LINTAS DIVISI:
1) Kasus Raber antar-divisi bedah (misal stase aktif Bedah Plastik, DPJP utama Bedah Digestif):
   "DPJP: dr. Bambang Suprapto, Sp. B(K)BD. RABER Bedah Plastik: dr. Andi Mohammad Ardan, Sp. BP-RE"
   => dpjp="dr. Andi Mohammad Ardan, Sp. BP-RE", doctorRole="RABER", supervisingDpjp="dr. Bambang Suprapto, Sp. B(K)BD".
2) Kasus Konsul antar-divisi bedah (misal stase aktif Bedah Plastik, DPJP utama Bedah Anak):
   "DPJP: dr. Fahad Ahmed Shah K., Sp.BA. Konsul ke dr. Yudhy Arius, Sp. BP-RE"
   => dpjp="dr. Yudhy Arius, Sp. BP-RE", doctorRole="KONSUL", supervisingDpjp="dr. Fahad Ahmed Shah K., Sp.BA".
3) Kasus Raber antar-divisi bedah (misal stase aktif Bedah Digestif, DPJP utama Ortopedi):
   "DPJP: dr. Yasser Ridwan, Sp.OT. Raber: dr. Ahmad Toboroni Nasution, Sp. B(K)BD"
   => dpjp="dr. Ahmad Toboroni Nasution, Sp. B(K)BD", doctorRole="RABER", supervisingDpjp="dr. Yasser Ridwan, Sp.OT, K-Spine, FICS".
4) Kasus Raber dengan Dokter Anak (Pediatri):
   "DPJP: dr. Ahmad Wisnu Wardhana, M.Sc., Sp.A. RABER: dr. Santi Rini, Sp.BA"
   => dpjp="dr. Santi Rini, Sp.BA", doctorRole="RABER", supervisingDpjp="dr. Ahmad Wisnu Wardhana, M.Sc., Sp.A".
5) Kasus DPJP divisi stase aktif:
   "DPJP: dr. Andi Mohammad Ardan, Sp. BP-RE"
   => dpjp="dr. Andi Mohammad Ardan, Sp. BP-RE", doctorRole="DPJP", supervisingDpjp="".
6) Jika tertulis "DPJP: dr. A, Raber: dr. B" di mana dr. B adalah dokter divisi stase aktif (${division || 'Bedah'}), maka dr. B = dpjp (doctorRole="RABER") dan dr. A = supervisingDpjp (DPJP utama).

ATURAN PRIORITAS PERAN:
A. Selalu cari label/hubungan per dokter dalam konteks pasien yang sama: DPJP, DPJP utama, RABER/RB/rawat bersama, KONSUL/konsul ke/dimintakan konsultasi.
B. Jika ada konflik, pernyataan eksplisit tentang hubungan pasien mengalahkan asumsi berdasarkan spesialisasi, urutan nama, atau divisi stase.
C. Jika tertulis "DPJP: A; RABER: B", A adalah DPJP utama dan B adalah RABER. Jangan membaliknya.
D. Jika tertulis "DPJP: A; Konsul: B", A adalah DPJP utama dan B adalah KONSUL.
E. Jika teks hanya menyebut "raber dengan B", B adalah RABER dan cari DPJP utama dari bagian pasien yang sama. Jika tidak ditemukan, supervisingDpjp kosong; JANGAN membuat DPJP dari tebakan.
F. Jika teks hanya menyebut "konsul ke B", B adalah KONSUL dan cari DPJP utama dari bagian pasien yang sama.
G. Jangan menggunakan dokter dari pasien lain untuk mengisi supervisingDpjp.
H. Setiap pasien harus dinilai sendiri. Jangan membawa role dari pasien nomor 1 ke pasien nomor 2.

OUTPUT SEMANTIK:
- dpjp: dokter divisi stase aktif yang menjadi subjek peran aplikasi (DPJP/RABER/KONSUL).
- doctorRole: tepat salah satu "DPJP", "RABER", "KONSUL", atau "" jika benar-benar tidak dapat ditentukan.
- supervisingDpjp: DPJP utama untuk pasien bila doctorRole=RABER/KONSUL (bisa dokter dari divisi bedah mana pun atau dokter anak); jika doctorRole="DPJP", kosongkan "".

DIVISI STASE AKTIF: ${division || "Bedah"}
DOKTER DIVISI STASE AKTIF YANG DIKENAL:
${surgicalDoctors.length ? surgicalDoctors.join("\n") : "-"}

DOKTER DIVISI BEDAH LAIN (DAPAT MENJADI DPJP UTAMA MAUPUN RABER/KONSUL):
${otherDivisionsListText}

DAFTAR DOKTER ANAK YANG DIKENAL (DAPAT MENJADI DPJP UTAMA):
${pediatricDoctors.length ? pediatricDoctors.join("\n") : "-"}

DAFTAR RUANGAN ACUAN:
${Array.isArray(knownRooms) && knownRooms.length ? knownRooms.join(", ") : "-"}

FIELD LAIN:
1. name: nama pasien seperti tertulis. Jika pasien berusia kurang dari 1 bulan gunakan sebutan "By." (misal: "By. Dania" atau "By. Ny. Rahma").
2. age: usia bila eksplisit; jika tidak ada, "".
3. dob: tanggal lahir pasien jika ada (DOB / Tgl Lahir / Tanggal Lahir / Lahir / TTL), SELALU konversikan ke format standar YYYY-MM-DD (contoh: "12/05/2023" -> "2023-05-12", "12-05-2023" -> "2023-05-12", "12 Mei 2023" -> "2023-05-12", "2023-05-12" -> "2023-05-12"). Jika tidak tertera, kosongkan "".
4. jk: hanya L/P jika eksplisit atau jelas dari Tn/Bpk/Sdr atau Ny/Ibu/Nn/Sdri. Jika tidak jelas, "".
5. rm: nomor RM bila ada; jika tidak ada, "".
6. room: ruangan sesuai teks atau kecocokan terdekat dari daftar; jangan mengarang.
7. kamar: nomor kamar/bed bila ada; jika tidak ada, "".
8. dx: diagnosis klinis ringkas saja. Jangan memasukkan tindakan, TTV, atau catatan lain.

JANGAN mengarang data. Hanya ekstrak fakta yang didukung catatan.

CATATAN MENTAH:
"""
${text}
"""`;

    let availableModels: string[] = [];
    try {
      availableModels = await getAvailableGeminiModels(apiKey);
    } catch (modelListError: any) {
      console.warn("[Gemini model discovery warning]:", modelListError?.message || modelListError);
    }

    const candidateModels = getModelCandidates(availableModels);
    const errors: string[] = [];
    let rawText = "";
    let selectedModel = "";

    for (const modelName of candidateModels) {
      try {
        rawText = await generateWithGemini(apiKey, modelName, prompt);
        selectedModel = modelName;
        break;
      } catch (err: any) {
        const status = Number(err?.status || 0);
        errors.push(String(err?.message || `${modelName}: gagal memproses permintaan`));
        // Model yang tidak tersedia/ditolak dicoba dengan model stabil berikutnya.
        // Jangan pernah kembali ke Gemini 2.5/2.0 yang menjadi sumber error pada deployment lama.
        if (status === 401 || status === 403) break;
      }
    }

    if (!rawText) {
      console.error("[Gemini all-models failed]:", errors);
      return res.status(502).json({
        success: false,
        error: `Tidak ada model Gemini yang berhasil memproses permintaan. ${errors.join(" | ")}`,
      });
    }

    const parsedPatients = JSON.parse(rawText || "[]");
    if (!Array.isArray(parsedPatients)) {
      throw new Error("Respons AI bukan array pasien yang valid.");
    }

    const formatted = parsedPatients.map((p: any) => {
      const jk = p.jk === "L" || p.jk === "P" ? p.jk : "";
      const doctorRole = p.doctorRole === "RABER" || p.doctorRole === "KONSUL" || p.doctorRole === "DPJP" ? p.doctorRole : undefined;
      const supervisingDpjp = String(p.supervisingDpjp || "").trim();
      const dob = normalizeDob(p.dob);
      return {
        name: String(p.name || "").trim(),
        age: String(p.age || "").trim(),
        ...(dob ? { dob } : {}),
        jk,
        rm: String(p.rm || "").trim(),
        room: String(p.room || "").trim(),
        kamar: String(p.kamar || "").trim(),
        dpjp: String(p.dpjp || "").trim(),
        ...(doctorRole ? { doctorRole } : {}),
        ...(supervisingDpjp ? { supervisingDpjp } : {}),
        dx: String(p.dx || "").trim(),
      };
    }).filter((p: any) => p.name.length > 0);

    return res.status(200).json({ success: true, count: formatted.length, model: selectedModel, patients: formatted });
  } catch (err: any) {
    console.error("[Vercel API Error]:", err);
    return res.status(500).json({ success: false, error: err?.message || "Terjadi kendala saat memproses catatan dengan AI." });
  }
}
