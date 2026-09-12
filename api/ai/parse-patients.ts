import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Gunakan metode POST.",
    });
  }

  try {
    const { text, division, knownRooms, knownDpjps } = req.body || {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Teks catatan pasien tidak boleh kosong.",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY belum disetel di Vercel Environment Variables. Buka Project Settings > Environment Variables di Vercel.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `Anda adalah asisten medis koas bedah berpengalaman.
Tugas Anda adalah membaca dan mengekstrak catatan pasien dari berbagai format teks mentah bebas (catatan operan jaga WhatsApp, catatan ronde bangsal, resume stase sebelumnya, atau format bebas) menjadi format data pasien terstruktur yang bersih.

DIVISI STASE AKTIF: ${division || 'Bedah'}
DAFTAR RUANGAN / BANGSAL ACUAN:
${Array.isArray(knownRooms) && knownRooms.length > 0 ? knownRooms.join(', ') : 'IGD, Seroja, NICU, PICU, ICCU, ICU, Ratai, Anggrek, Edelweiss, Cempaka, Aster, Melati, Flamboyan 1, Flamboyan 2, HCU, Angsoka, Dahlia'}

DAFTAR DOKTER DPJP KONSULEN ACUAN:
${Array.isArray(knownDpjps) && knownDpjps.length > 0 ? knownDpjps.join('\n') : '-'}

ATURAN STRUKTUR DATA (SANGAT KETAT):
1. name: Nama pasien. Pertahankan sebutan jika ada (Tn, Ny, An, By, dsb. Contoh: "Tn. Sutrisno", "Ny. Siti Aminah", "An. Rafa").
2. age: Usia pasien dalam format singkat (misal: "45 th", "8 bln", "2 th", "60"). Jika tidak tertera, gunakan string kosong "".
3. jk: Jenis kelamin pasien. HARUS bernilai 'L' (Laki-laki) atau 'P' (Perempuan). Bila tidak jelas, simpulkan dari sapaan/nama (Tn/Bpk/Sdr -> 'L', Ny/Ibu/Nn/Sdri -> 'P') atau default 'L'.
4. rm: Nomor Rekam Medis jika ada (misal: "01-88-29", "020918", "123456"). Jika tidak ada, gunakan string kosong "".
5. room: Nama ruangan / bangsal. Gunakan nama ruangan terdekat dari daftar acuan (misal: "Melati", "Dahlia", "Bougenville", "ICU", "IGD"). Jika di teks tertulis ruangan lain, tuliskan sesuai teks.
6. kamar: Nomor kamar atau nomor bed (misal: "Bed 3", "2A", "Bed 1", "3", "HCU-2").
7. dpjp: Nama dokter konsulen / DPJP yang merawat. Jika cocok dengan dokter acuan, gunakan format lengkapnya. Jika tidak ada di acuan, tuliskan nama dokter yang tertera di teks.
8. dx: Diagnosis kerja / klinis pasien.
   PERHATIAN KHUSUS DARI USER: HANYA diagnosis saja! JANGAN menyertakan pre/post op terpisah, JANGAN menyertakan tindakan operasi, JANGAN menyertakan TTV (tekanan darah, nadi, suhu, saturasi), dan JANGAN menyertakan catatan khusus. Cukup diagnosis penyakitnya secara ringkas dan medis (misal: "Appendisitis Akut", "Cholelithiasis simptomatik", "Fraktur Femur Dextra", "BPH ec Retensio Urin").

TEKS CATATAN MENTAH:
"""
${text}
"""`;

    // Multi-model fallback
    const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    let rawText = "";
    let lastErr: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: "Anda adalah asisten medis cerdas koas bedah yang bertugas mengekstrak catatan pasien mentah menjadi JSON terstruktur sesuai format data web.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              description: "Daftar pasien yang berhasil diekstrak",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nama pasien" },
                  age: { type: Type.STRING, description: "Usia pasien" },
                  jk: { type: Type.STRING, description: "Jenis kelamin: 'L' atau 'P'" },
                  rm: { type: Type.STRING, description: "Nomor Rekam Medis" },
                  room: { type: Type.STRING, description: "Nama Ruangan / Bangsal" },
                  kamar: { type: Type.STRING, description: "Nomor Kamar atau Bed" },
                  dpjp: { type: Type.STRING, description: "Nama Dokter DPJP" },
                  dx: { type: Type.STRING, description: "Diagnosis kerja/klinis pasien" },
                },
                required: ["name", "jk", "dx"],
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

    if (lastErr && !rawText) {
      throw lastErr;
    }

    const parsedPatients = JSON.parse(rawText || "[]");
    const formatted = parsedPatients.map((p: any) => ({
      name: String(p.name || "").trim(),
      age: String(p.age || "").trim(),
      jk: p.jk === "P" ? "P" : "L",
      rm: String(p.rm || "").trim(),
      room: String(p.room || "").trim(),
      kamar: String(p.kamar || "").trim(),
      dpjp: String(p.dpjp || "").trim(),
      dx: String(p.dx || "").trim(),
    })).filter((p: any) => p.name.length > 0);

    return res.status(200).json({
      success: true,
      count: formatted.length,
      patients: formatted,
    });
  } catch (err: any) {
    console.error("[Vercel API Error]:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Terjadi kendala saat memproses catatan dengan AI.",
    });
  }
}
