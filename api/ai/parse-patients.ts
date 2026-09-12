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
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Gunakan metode POST." });
  }

  try {
    const authorization = String(req.headers?.authorization || "");
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) return res.status(401).json({ success: false, error: "Autentikasi diperlukan untuk menggunakan AI." });

    const identity = await verifyFirebaseIdToken(token);
    if (!allowRate(identity.uid)) {
      return res.status(429).json({ success: false, error: "Terlalu banyak permintaan AI. Silakan tunggu sekitar 1 menit lalu coba lagi." });
    }

    const { text, division, knownRooms, knownDpjps } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, error: "Teks catatan pasien tidak boleh kosong." });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ success: false, error: `Teks terlalu panjang. Maksimal ${MAX_TEXT_LENGTH.toLocaleString('id-ID')} karakter per permintaan.` });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "GEMINI_API_KEY belum disetel di Vercel Environment Variables." });
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "swepinganku-ai" } } });

    const prompt = `Anda adalah asisten ekstraksi data klinis untuk koas bedah.
Tugas Anda HANYA mengekstrak informasi yang benar-benar tertulis pada catatan. Jangan mengarang, menyimpulkan fakta yang tidak didukung, atau mengisi nilai kosong dengan tebakan.

DIVISI STASE AKTIF: ${division || 'Bedah'}
DAFTAR RUANGAN ACUAN:
${Array.isArray(knownRooms) && knownRooms.length > 0 ? knownRooms.join(', ') : '-'}

DAFTAR DOKTER ACUAN:
${Array.isArray(knownDpjps) && knownDpjps.length > 0 ? knownDpjps.join('\n') : '-'}

ATURAN:
1. name: nama pasien seperti tertulis.
2. age: usia bila eksplisit; jika tidak ada, "".
3. jk: hanya 'L' atau 'P' jika eksplisit/ditentukan jelas oleh sapaan klinis (Tn/Bpk/Sdr = L; Ny/Ibu/Nn/Sdri = P). Jika tidak jelas, "". JANGAN default L.
4. rm: nomor RM bila ada; jika tidak ada, "".
5. room: ruangan sesuai teks atau kecocokan terdekat dari daftar acuan; jangan mengarang.
6. kamar: nomor kamar/bed bila ada; jika tidak ada, "".
7. dpjp: dokter yang tertulis sebagai DPJP/penanggung jawab atau dokter terkait; jika tidak ada, "".
8. doctorRole: 'DPJP' bila eksplisit sebagai DPJP; 'RABER' bila eksplisit rawat bersama/raber; 'KONSUL' bila eksplisit konsulen; selain itu kosong/tidak disertakan.
9. supervisingDpjp: nama DPJP utama bila teks secara eksplisit menyebutkan DPJP utama pada pasien Raber/Konsul; jika tidak ada, "".
10. dx: diagnosis klinis ringkas saja. Jangan memasukkan tindakan, TTV, atau catatan lain.

CATATAN MENTAH:
"""
${text}
"""`;

    const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    let rawText = "";
    let lastErr: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: "Ekstrak data klinis secara konservatif. Jika informasi tidak jelas, kosongkan field tersebut.",
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
                  dpjp: { type: Type.STRING },
                  doctorRole: { type: Type.STRING, description: "DPJP, RABER, KONSUL, atau kosong" },
                  supervisingDpjp: { type: Type.STRING, description: "DPJP utama untuk Raber/Konsul bila eksplisit" },
                  dx: { type: Type.STRING },
                },
                required: ["name", "age", "jk", "rm", "room", "kamar", "dpjp", "doctorRole", "supervisingDpjp", "dx"],
              },
            },
          },
        });
        rawText = response.text?.trim() || "[]";
        if (rawText) { lastErr = null; break; }
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
