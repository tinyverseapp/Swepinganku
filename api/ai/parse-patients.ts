import { GoogleGenAI, Type } from "@google/genai";

const recentRequests = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_TEXT_LENGTH = 30000;

function getAllowedOrigin(req: any): string {
  const origin = String(req.headers?.origin || "");
  const configured = String(process.env.APP_ORIGIN || "").trim();
  if (configured && origin === configured) return origin;
  if (origin === "http://localhost:3000" || origin === "http://localhost:5173") return origin;
  if (/^https:\/\/[^/]+\.vercel\.app$/.test(origin)) return origin;
  return configured || "https://swepinganku.vercel.app";
}

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email?: string }> {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyDtbsg1WEdVrp03Vy9vhG3w7jnnXxUQ8x8";
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
    if (!allowRate(identity.uid)) {
      return res.status(429).json({ success: false, error: "Terlalu banyak permintaan AI. Silakan tunggu sekitar 1 menit lalu coba lagi." });
    }

    const { text, division, knownRooms, knownDpjps, knownPediatricDpjps } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, error: "Teks catatan pasien tidak boleh kosong." });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ success: false, error: `Teks terlalu panjang. Maksimal ${MAX_TEXT_LENGTH.toLocaleString("id-ID")} karakter per permintaan.` });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: "GEMINI_API_KEY belum disetel di Vercel Environment Variables." });

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "swepinganku-ai" } } });
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
1. name: nama pasien seperti tertulis.
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

    const candidateModels = ["gemini-3.6-flash", "gemini-2.5-flash"];
    let rawText = "";
    let lastErr: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: "Anda harus memprioritaskan hubungan DPJP/RABER/KONSUL yang tertulis. Jangan menentukan peran berdasarkan spesialisasi dokter. Output harus konsisten dengan definisi klinis dan contoh yang diberikan.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  age: { type: Type.STRING },
                  jk: { type: Type.STRING, description: "L, P, atau kosong" },
                  rm: { type: Type.STRING },
                  room: { type: Type.STRING },
                  kamar: { type: Type.STRING },
                  dpjp: { type: Type.STRING, description: "Dokter yang memegang peran aplikasi: DPJP, RABER, atau KONSUL" },
                  doctorRole: { type: Type.STRING, description: "DPJP, RABER, KONSUL, atau kosong" },
                  supervisingDpjp: { type: Type.STRING, description: "DPJP utama jika dokter di field dpjp adalah RABER/KONSUL" },
                  dx: { type: Type.STRING },
                },
                required: ["name", "age", "jk", "rm", "room", "kamar", "dpjp", "doctorRole", "supervisingDpjp", "dx"],
              },
            },
          },
        });
        rawText = response.text?.trim() || "[]";
        if (rawText) {
          lastErr = null;
          break;
        }
      } catch (err: any) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (lastErr && !rawText) throw lastErr;

    const parsedPatients = JSON.parse(rawText || "[]");
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

    return res.status(200).json({ success: true, count: formatted.length, patients: formatted });
  } catch (err: any) {
    console.error("[Vercel API Error]:", err);
    return res.status(500).json({ success: false, error: err?.message || "Terjadi kendala saat memproses catatan dengan AI." });
  }
}
