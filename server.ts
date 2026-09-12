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
      const { text, division, knownRooms, knownDpjps, knownPediatricDpjps } = req.body;
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

      const surgicalDoctors = Array.isArray(knownDpjps) ? knownDpjps.filter(Boolean) : [];
      const pediatricDoctors = Array.isArray(knownPediatricDpjps) ? knownPediatricDpjps.filter(Boolean) : [];

      const prompt = `Anda adalah asisten medis koas bedah berpengalaman.
Tugas Anda adalah membaca dan mengekstrak catatan pasien dari berbagai format teks mentah bebas (catatan operan jaga WhatsApp, catatan ronde bangsal, resume stase sebelumnya, atau format bebas) menjadi format data pasien terstruktur yang bersih.

KONSEP KLINIS WAJIB:
- DPJP = Dokter Penanggung Jawab Pelayanan. Ini adalah dokter utama yang bertanggung jawab atas pelayanan pasien. Jika catatan menyebut "DPJP", "DPJP utama", "dokter penanggung jawab", atau padanan yang jelas, dokter tersebut adalah DPJP.
- RABER = Rawat Bersama. Dokter dari bidang lain ikut merawat pasien bersama DPJP utama. Dokter RABER BUKAN DPJP utama hanya karena ia dokter bedah/spesialis yang sedang menangani masalahnya.
- KONSUL = dokter yang dimintai konsultasi. Dokter konsulen BUKAN DPJP utama kecuali teks secara eksplisit menyatakan ia juga DPJP.
- Untuk RABER/KONSUL, field dpjp berisi NAMA DOKTER YANG BERPERAN SEBAGAI RABER/KONSUL (dokter bedah pada aplikasi), doctorRole berisi perannya ("RABER" atau "KONSUL"), dan supervisingDpjp berisi DPJP utama.
- Untuk DPJP, field dpjp berisi dokter DPJP, doctorRole bernilai "DPJP", dan supervisingDpjp harus kosong "".
- Spesialisasi TIDAK menentukan peran. Dokter anak bisa menjadi DPJP. Dokter bedah anak bisa menjadi RABER atau KONSUL. Jangan pernah mengubah RABER/KONSUL menjadi DPJP hanya karena dokter tersebut dari divisi aktif.

CONTOH WAJIB:
1) "DPJP: dr. Ahmad Wisnu Wardhana, Sp.A. RABER: dr. Santi Rini, Sp.BA" => dpjp="dr. Santi Rini, Sp.BA", doctorRole="RABER", supervisingDpjp="dr. Ahmad Wisnu Wardhana, Sp.A".
2) "DPJP dokter anak, rawat bersama dengan dr. Santi Rini Sp.BA" => supervisingDpjp="dokter anak"; dpjp="dr. Santi Rini, Sp.BA"; doctorRole="RABER".
3) "DPJP: dr. Ahmad Wisnu Wardhana, Sp.A. Konsul Bedah Anak ke dr. Santi Rini, Sp.BA" => dpjp="dr. Santi Rini, Sp.BA", doctorRole="KONSUL", supervisingDpjp="dr. Ahmad Wisnu Wardhana, Sp.A".
4) "DPJP: dr. Santi Rini, Sp.BA" => dpjp="dr. Santi Rini, Sp.BA", doctorRole="DPJP", supervisingDpjp="".
5) "dr. Santi Rini Sp.BA" tanpa keterangan peran => JANGAN menebak DPJP/RABER/KONSUL dari spesialisasinya. doctorRole boleh kosong "" dan field dokter hanya diisi bila hubungan tanggung jawab memang jelas.

DIVISI STASE AKTIF: ${division || 'Bedah'}
DAFTAR DOKTER BEDAH / DPJP ACUAN:
${surgicalDoctors.length > 0 ? surgicalDoctors.join('\n') : '-'}

DAFTAR DOKTER ANAK KONSULEN / RUJUKAN ACUAN:
${pediatricDoctors.length > 0 ? pediatricDoctors.join('\n') : '-'}

DAFTAR RUANGAN / BANGSAL ACUAN:
${Array.isArray(knownRooms) && knownRooms.length > 0 ? knownRooms.join(', ') : 'IGD, Seroja, NICU, PICU, ICCU, ICU, Ratai, Anggrek, Edelweiss, Cempaka, Aster, Melati, Flamboyan 1, Flamboyan 2, HCU, Angsoka, Dahlia'}

ATURAN STRUKTUR DATA (SANGAT KETAT):
1. name: Nama pasien. Pertahankan sebutan jika ada (Tn, Ny, An, By, dsb. Contoh: "Tn. Sutrisno", "Ny. Siti Aminah", "An. Rafa").
2. age: Usia pasien dalam format singkat (misal: "45 th", "8 bln", "2 th", "60"). Jika tidak tertera, gunakan string kosong "".
3. jk: Jenis kelamin pasien: 'L' (Laki-laki), 'P' (Perempuan), atau string kosong "".
4. rm: Nomor Rekam Medis jika ada (misal: "01-88-29", "020918"). Jika tidak ada, gunakan string kosong "".
5. room: Nama ruangan / bangsal sesuai teks atau kecocokan terdekat.
6. kamar: Nomor kamar atau nomor bed (misal: "Bed 3", "2A", "Bed 1", "3", "HCU-2").
7. dpjp: Nama dokter konsulen / yang merawat sesuai peran.
8. doctorRole: "DPJP", "RABER", "KONSUL", atau "" bila belum pasti.
9. supervisingDpjp: Nama DPJP utama bila doctorRole adalah RABER atau KONSUL, jika DPJP kosongkan "".
10. dx: Diagnosis kerja / klinis pasien secara ringkas dan medis. HANYA diagnosis saja! JANGAN menyertakan pre/post op terpisah, tindakan operasi, atau TTV.

TEKS CATATAN MENTAH:
"""
${text}
"""`;

      // Gunakan model Gemini aktif & didukung (model 2.0-flash / 1.5-flash sudah deprecated)
      const candidateModels = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash"];
      let rawText = "";
      let lastErr: any = null;
      let usedModel = "";

      for (const modelName of candidateModels) {
        try {
          console.log(`[AI Parser] Memproses dengan model: ${modelName}...`);
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
                    jk: { type: Type.STRING, description: "Jenis kelamin: 'L', 'P', atau ''" },
                    rm: { type: Type.STRING, description: "Nomor Rekam Medis" },
                    room: { type: Type.STRING, description: "Nama Ruangan / Bangsal" },
                    kamar: { type: Type.STRING, description: "Nomor Kamar atau Bed" },
                    dpjp: { type: Type.STRING, description: "Nama Dokter DPJP / Raber / Konsul" },
                    doctorRole: { type: Type.STRING, description: "Peran dokter: 'DPJP', 'RABER', atau 'KONSUL'" },
                    supervisingDpjp: { type: Type.STRING, description: "Nama DPJP utama jika doctorRole adalah RABER atau KONSUL" },
                    dx: { type: Type.STRING, description: "Diagnosis kerja/klinis pasien" },
                  },
                  required: ["name", "jk", "dx"],
                },
              },
            },
          });

          rawText = response.text?.trim() || "[]";
          if (rawText) {
            usedModel = modelName;
            lastErr = null;
            break;
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`[AI Parser] Model ${modelName} kendala (${err?.status || err?.message}), mencoba model berikutnya...`);
          // Beri jeda singkat sebelum fallback
          await new Promise((r) => setTimeout(r, 400));
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
      const formatted = parsedPatients.map((p: any) => {
        const jk = p.jk === 'P' || p.jk === 'L' ? p.jk : '';
        const doctorRole = p.doctorRole === 'RABER' || p.doctorRole === 'KONSUL' || p.doctorRole === 'DPJP' ? p.doctorRole : undefined;
        const supervisingDpjp = String(p.supervisingDpjp || '').trim() || undefined;
        return {
          name: String(p.name || '').trim(),
          age: String(p.age || '').trim(),
          jk,
          rm: String(p.rm || '').trim(),
          room: String(p.room || '').trim(),
          kamar: String(p.kamar || '').trim(),
          dpjp: String(p.dpjp || '').trim(),
          ...(doctorRole ? { doctorRole } : {}),
          ...(supervisingDpjp ? { supervisingDpjp } : {}),
          dx: String(p.dx || '').trim(),
        };
      }).filter((p: any) => p.name.length > 0);

      return res.json({
        success: true,
        count: formatted.length,
        model: usedModel,
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
