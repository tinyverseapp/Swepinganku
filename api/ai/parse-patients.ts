const recentRequests = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_AI_REQUESTS_PER_DAY = 5;
const MAX_TEXT_LENGTH = 30000;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0369700060";
const FIREBASE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID || "ai-studio-sweepinganku-7b577169-323b-497e-b0c6-aa0e56f181f5";
const AI_ADMIN_EMAILS = String(process.env.AI_ADMIN_EMAILS || "m.hafidzuddin.s@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

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
  return Boolean(identity.email && AI_ADMIN_EMAILS.includes(identity.email.trim().toLowerCase()));
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

function getQuotaDate(): string {
  const timeZone = process.env.AI_QUOTA_TIMEZONE || "Asia/Makassar";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getQuotaDocumentName(uid: string, date: string): string {
  return `projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}/documents/aiUsage/${uid}/daily/${date}`;
}

async function firebaseRest<T>(url: string, idToken: string, options: RequestInit = {}): Promise<{ status: number; data: T }> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data } as { status: number; data: T };
}

async function reserveDailyAiQuota(identity: { uid: string; email?: string }, idToken: string): Promise<{ allowed: boolean; remaining: number | null }> {
  if (isAdmin(identity)) return { allowed: true, remaining: null };

  const date = getQuotaDate();
  const documentName = getQuotaDocumentName(identity.uid, date);
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/${encodeURIComponent(FIREBASE_DATABASE_ID)}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const begin = await firebaseRest<any>(`${baseUrl}/documents:beginTransaction`, idToken, {
      method: "POST",
      body: JSON.stringify({ options: { readWrite: {} } }),
    });
    if (begin.status < 200 || begin.status >= 300 || !begin.data?.transaction) {
      throw new Error("Tidak dapat memeriksa kuota AI harian. Silakan coba lagi.");
    }

    const transaction = String(begin.data.transaction);
    const read = await firebaseRest<any>(
      `${baseUrl}/documents/aiUsage/${encodeURIComponent(identity.uid)}/daily/${encodeURIComponent(date)}?transaction=${encodeURIComponent(transaction)}`,
      idToken,
      { method: "GET" },
    );

    let currentCount = 0;
    if (read.status >= 200 && read.status < 300) {
      const raw = read.data?.fields?.count?.integerValue;
      currentCount = Number(raw || 0);
      if (!Number.isFinite(currentCount) || currentCount < 0) currentCount = 0;
    } else if (read.status !== 404) {
      throw new Error("Tidak dapat membaca kuota AI harian.");
    }

    if (currentCount >= MAX_AI_REQUESTS_PER_DAY) {
      return { allowed: false, remaining: 0 };
    }

    const nextCount = currentCount + 1;
    const commit = await firebaseRest<any>(`${baseUrl}/documents:commit`, idToken, {
      method: "POST",
      body: JSON.stringify({
        transaction,
        writes: [{
          update: {
            name: documentName,
            fields: {
              uid: { stringValue: identity.uid },
              date: { stringValue: date },
              count: { integerValue: String(nextCount) },
              updatedAt: { timestampValue: new Date().toISOString() },
            },
          },
        }],
      }),
    });

    if (commit.status >= 200 && commit.status < 300) {
      return { allowed: true, remaining: MAX_AI_REQUESTS_PER_DAY - nextCount };
    }

    // Another request may have committed first. Retry the transaction rather than
    // allowing the daily quota to be exceeded under concurrent requests.
    if (commit.status === 409 || commit.status === 412) continue;
    throw new Error("Tidak dapat menyimpan pemakaian AI harian. Silakan coba lagi.");
  }

  throw new Error("Kuota AI sedang dipakai bersamaan oleh beberapa permintaan. Silakan coba lagi.");
}

function normalizeModelName(name: string): string {
  return String(name || "").replace(/^models\//, "").trim();
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
    const admin = isAdmin(identity);

    if (!admin && !allowRate(identity.uid)) {
      return res.status(429).json({ success: false, error: "Terlalu banyak permintaan AI dalam waktu singkat. Silakan tunggu sekitar 1 menit lalu coba lagi." });
    }

    const { text, division, knownRooms, knownDpjps, knownPediatricDpjps } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, error: "Teks catatan pasien tidak boleh kosong." });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ success: false, error: `Teks terlalu panjang. Maksimal ${MAX_TEXT_LENGTH.toLocaleString("id-ID")} karakter per permintaan.` });
    }

    const quota = await reserveDailyAiQuota(identity, token);
    if (!quota.allowed) {
      return res.status(429).json({
        success: false,
        error: `Batas penggunaan AI hari ini sudah tercapai (${MAX_AI_REQUESTS_PER_DAY}x). Kuota akan tersedia kembali besok.`,
        quota: { limit: MAX_AI_REQUESTS_PER_DAY, used: MAX_AI_REQUESTS_PER_DAY, remaining: 0 },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: "GEMINI_API_KEY belum disetel di Vercel Environment Variables." });

    const surgicalDoctors = Array.isArray(knownDpjps) ? knownDpjps.filter(Boolean) : [];
    const pediatricDoctors = Array.isArray(knownPediatricDpjps) ? knownPediatricDpjps.filter(Boolean) : [];

    const prompt = `Anda adalah asisten ekstraksi data klinis untuk aplikasi sweeping pasien stase bedah. Anda harus memahami hubungan tanggung jawab dokter, bukan sekadar mengenali nama spesialis.

KONSEP KLINIS WAJIB:
- DPJP = Dokter Penanggung Jawab Pelayanan. Ini adalah dokter utama yang bertanggung jawab atas pelayanan pasien. Jika catatan menyebut "DPJP", "DPJP utama", "dokter penanggung jawab", atau padanan yang jelas, dokter tersebut adalah DPJP.
- RABER = Rawat Bersama. Dokter dari bidang lain ikut merawat pasien bersama DPJP utama. Dokter RABER BUKAN DPJP utama hanya karena ia dokter bedah/spesialis yang sedang menangani masalahnya.
- KONSUL = dokter yang dimintai konsultasi. Dokter konsulen BUKAN DPJP utama kecuali teks secara eksplisit menyatakan ia juga DPJP.
- Untuk RABER/KONSUL, field dpjp berisi NAMA DOKTER YANG BERPERAN SEBAGAI RABER/KONSUL (dokter bedah pada aplikasi), doctorRole berisi perannya, dan supervisingDpjp berisi DPJP utama.
- Untuk DPJP, field dpjp berisi dokter DPJP dan supervisingDpjp harus kosong.
- Spesialisasi TIDAK menentukan peran. Dokter anak bisa menjadi DPJP. Dokter bedah anak bisa menjadi RABER atau KONSUL. Jangan pernah mengubah RABER/KONSUL menjadi DPJP hanya karena dokter tersebut dari divisi aktif.

CONTOH WAJIB:
1) "DPJP: dr. Ahmad Wisnu Wardhana, Sp.A. RABER: dr. Santi Rini, Sp.BA" => dpjp="dr. Santi Rini, Sp.BA", doctorRole="RABER", supervisingDpjp="dr. Ahmad Wisnu Wardhana, Sp.A".
2) "DPJP dokter anak, rawat bersama dengan dr. Santi Rini Sp.BA" => dokter anak = supervisingDpjp/DPJP utama; dr. Santi Rini = dpjp field; doctorRole="RABER".
3) "DPJP: dr. Ahmad Wisnu Wardhana, Sp.A. Konsul Bedah Anak ke dr. Santi Rini, Sp.BA" => dpjp="dr. Santi Rini, Sp.BA", doctorRole="KONSUL", supervisingDpjp="dr. Ahmad Wisnu Wardhana, Sp.A".
4) "DPJP: dr. Santi Rini, Sp.BA" => dpjp="dr. Santi Rini, Sp.BA", doctorRole="DPJP", supervisingDpjp="".
5) "dr. Santi Rini Sp.BA" tanpa keterangan peran => JANGAN menebak DPJP/RABER/KONSUL dari spesialisasinya. doctorRole boleh kosong dan field dokter hanya diisi bila hubungan tanggung jawab memang jelas.

ATURAN PRIORITAS PERAN:
A. Selalu cari label/hubungan per dokter dalam konteks pasien yang sama: DPJP, DPJP utama, RABER/RB/rawat bersama, KONSUL/konsul ke/dimintakan konsultasi.
B. Jika ada konflik, pernyataan eksplisit tentang hubungan pasien mengalahkan asumsi berdasarkan spesialisasi, urutan nama, atau divisi stase.
C. Jika tertulis "DPJP: A; RABER: B", A adalah DPJP utama dan B adalah RABER. Jangan membaliknya.
D. Jika tertulis "DPJP: A; Konsul: B", A adalah DPJP utama dan B adalah KONSUL.
E. Jika teks hanya menyebut "raber dengan B", B adalah RABER dan cari DPJP utama dari bagian pasien yang sama. Jika tidak ditemukan, supervisingDpjp kosong; JANGAN membuat DPJP dari tebakan.
F. Jika teks hanya menyebut "konsul ke B", B adalah KONSUL dan cari DPJP utama dari bagian pasien yang sama.
G. Jangan menggunakan dokter dari pasien lain untuk mengisi supervisingDpjp.
H. Jangan menganggap "konsulen" selalu berarti DPJP. Konsulen dapat merupakan dokter yang dikonsulkan.
I. Jika dokter anak dan dokter bedah anak muncul bersama, jangan memilih dokter bedah sebagai DPJP secara otomatis. Ikuti label tanggung jawab yang tertulis.
J. Setiap pasien harus dinilai sendiri. Jangan membawa role dari pasien nomor 1 ke pasien nomor 2.

OUTPUT SEMANTIK:
- dpjp: dokter yang menjadi subjek peran aplikasi (DPJP/RABER/KONSUL).
- doctorRole: tepat salah satu "DPJP", "RABER", "KONSUL", atau "" jika benar-benar tidak dapat ditentukan.
- supervisingDpjp: DPJP utama untuk pasien bila doctorRole=RABER/KONSUL dan hubungan itu tertulis/teridentifikasi jelas; jika tidak jelas, "".
- Jika doctorRole="DPJP", supervisingDpjp="".

DIVISI STASE AKTIF: ${division || "Bedah"}
DAFTAR DOKTER BEDAH YANG DIKENAL:
${surgicalDoctors.length ? surgicalDoctors.join("\n") : "-"}

DAFTAR DOKTER ANAK YANG DIKENAL (mereka dapat menjadi DPJP utama):
${pediatricDoctors.length ? pediatricDoctors.join("\n") : "-"}

DAFTAR RUANGAN ACUAN:
${Array.isArray(knownRooms) && knownRooms.length ? knownRooms.join(", ") : "-"}

FIELD LAIN:
1. name: nama pasien seperti tertulis. Jika pasien berusia kurang dari 1 bulan gunakan sebutan "By." (misal: "By. Dania" atau "By. Ny. Rahma").
2. age: usia bila eksplisit; jika tidak ada, "".
3. jk: hanya L/P jika eksplisit atau jelas dari Tn/Bpk/Sdr atau Ny/Ibu/Nn/Sdri. Jika tidak jelas, "".
4. rm: nomor RM bila ada; jika tidak ada, "".
5. room: ruangan sesuai teks atau kecocokan terdekat dari daftar; jangan mengarang.
6. kamar: nomor kamar/bed bila ada; jika tidak ada, "".
7. dx: diagnosis klinis ringkas saja. Jangan memasukkan tindakan, TTV, atau catatan lain.

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
      return {
        name: String(p.name || "").trim(),
        age: String(p.age || "").trim(),
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

    return res.status(200).json({
      success: true,
      count: formatted.length,
      model: selectedModel,
      patients: formatted,
      quota: admin ? { limit: null, used: null, remaining: null } : { limit: MAX_AI_REQUESTS_PER_DAY, remaining: quota.remaining },
    });
  } catch (err: any) {
    console.error("[Vercel API Error]:", err);
    return res.status(500).json({ success: false, error: err?.message || "Terjadi kendala saat memproses catatan dengan AI." });
  }
}
