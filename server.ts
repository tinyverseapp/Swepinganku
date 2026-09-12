import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import 'dotenv/config';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Initialize Gemini Client
  const getGeminiClient = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API endpoint for AI Patient Parser
  app.post("/api/ai/parse-patients", async (req, res) => {
    try {
      const { text, division, knownRooms, knownDpjps } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({
          success: false,
          error: "Teks catatan pasien tidak boleh kosong. Silakan tempel catatan terlebih dahulu.",
        });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({
          success: false,
          error: "GEMINI_API_KEY belum terpasang di environment server.",
        });
      }

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

      // Daftar model berurutan jika terjadi 503 (High Demand / Busy) pada model tertentu
      const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
      let rawText = "";
      let lastErr: any = null;

      for (const modelName of candidateModels) {
        try {
          console.log(`[AI Parser] Mencoba memproses dengan model: ${modelName}...`);
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
            // Berhasil mendapatkan respons
            lastErr = null;
            break;
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`[AI Parser] Model ${modelName} kendala (${err?.status || err?.message}), mencoba model cadangan...`);
          // Beri jeda singkat sebelum fallback
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (lastErr && !rawText) {
        throw lastErr;
      }

      let parsedPatients = [];
      try {
        parsedPatients = JSON.parse(rawText);
      } catch (e) {
        console.error("Gagal menguraikan JSON hasil Gemini:", rawText);
        return res.status(500).json({
          success: false,
          error: "Gagal mengurai respon AI ke format pasien.",
        });
      }

      // Pastikan format terstandar
      const formatted = parsedPatients.map((p: any) => ({
        name: String(p.name || '').trim(),
        age: String(p.age || '').trim(),
        jk: p.jk === 'P' ? 'P' : 'L',
        rm: String(p.rm || '').trim(),
        room: String(p.room || '').trim(),
        kamar: String(p.kamar || '').trim(),
        dpjp: String(p.dpjp || '').trim(),
        dx: String(p.dx || '').trim(),
      })).filter((p: any) => p.name.length > 0);

      return res.json({
        success: true,
        count: formatted.length,
        patients: formatted,
      });
    } catch (err: any) {
      console.error("[Gemini AI Error]:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Terjadi kendala saat menghubungi AI.",
      });
    }
  });

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
