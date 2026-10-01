import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import 'dotenv/config';

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
      const { text, division, knownRooms, knownDpjps, knownPediatricDpjps, allDivisionsDoctors } = req.body;
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

      const prompt = `Anda adalah asisten medis koas bedah berpengalaman.
Tugas Anda adalah membaca dan mengekstrak catatan pasien dari berbagai format teks mentah bebas (catatan operan jaga WhatsApp, catatan ronde bangsal, resume stase sebelumnya, atau format bebas) menjadi format data pasien terstruktur yang bersih.

KONSEP KLINIS WAJIB & ATURAN DPJP / RABER / KONSUL:
- DPJP = Dokter Penanggung Jawab Pelayanan. Ini adalah dokter utama yang bertanggung jawab atas pelayanan pasien. Jika catatan menyebut "DPJP", "DPJP utama", "dokter penanggung jawab", atau padanan yang jelas, dokter tersebut adalah DPJP.
- RABER = Rawat Bersama. Dokter dari bidang/divisi lain ikut merawat pasien bersama DPJP utama. Dokter RABER BUKAN DPJP utama.
- KONSUL = dokter yang dimintai konsultasi klinis. Dokter konsulen BUKAN DPJP utama kecuali teks secara eksplisit menyatakan ia juga DPJP.
- ATURAN DPJP UTAMA LINTAS DIVISI:
  * Dokter spesialis dari DIVISI BEDAH LAIN MANA PUN (seperti Bedah Digestif, Bedah Anak, Ortopedi, Urologi, BTKV, Bedah Plastik, Bedah Onkologi, Bedah Saraf) maupun Dokter Anak/Spesialis Penyakit Dalam/dll. BISA MENJADI DPJP UTAMA.
  * Dokter dari divisi stase aktif (${division || 'Bedah'}) bisa menjadi DPJP utama, BISA menjadi RABER, atau BISA menjadi KONSUL.
  * Jika pasien berstatus RABER atau KONSUL:
    - field 'dpjp': NAMA DOKTER DARI DIVISI STASE AKTIF (${division || 'Bedah'}) yang merawat/dikonsul.
    - field 'doctorRole': "RABER" atau "KONSUL".
    - field 'supervisingDpjp': NAMA DOKTER DPJP UTAMA (dapat berasal dari divisi bedah lain mana pun seperti Bedah Digestif, Bedah Anak, Ortopedi, Urologi, BTKV, Bedah Onkologi, Bedah Saraf, dll., maupun Dokter Anak).
  * Jika pasien berstatus DPJP murni (divisi stase aktif sebagai DPJP utama):
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

DIVISI STASE AKTIF: ${division || 'Bedah'}
DOKTER DIVISI STASE AKTIF / DPJP ACUAN:
${surgicalDoctors.length > 0 ? surgicalDoctors.join('\n') : '-'}

DOKTER DIVISI BEDAH LAIN (DAPAT MENJADI DPJP UTAMA MAUPUN RABER/KONSUL):
${otherDivisionsListText}

DAFTAR DOKTER ANAK KONSULEN / RUJUKAN ACUAN (DAPAT MENJADI DPJP UTAMA):
${pediatricDoctors.length > 0 ? pediatricDoctors.join('\n') : '-'}

DAFTAR RUANGAN / BANGSAL ACUAN:
${Array.isArray(knownRooms) && knownRooms.length > 0 ? knownRooms.join(', ') : 'IGD, Seroja, NICU, PICU, ICCU, ICU, Ratai, Anggrek, Edelweiss, Cempaka, Aster, Melati, Flamboyan 1, Flamboyan 2, HCU, Angsoka, Dahlia'}

ATURAN STRUKTUR DATA (SANGAT KETAT):
1. name: Nama pasien. Pertahankan sebutan jika ada (Tn, Ny, An, By, dsb. Contoh: "Tn. Sutrisno", "Ny. Siti Aminah", "An. Rafa", "By. Ny. Rahma"). Jika pasien berusia kurang dari 1 bulan gunakan "By." (misal: "By. Dania").
2. age: Usia pasien dalam format singkat (misal: "45 th", "8 bln", "2 th", "60"). Jika tidak tertera, gunakan string kosong "".
3. dob: Tanggal lahir pasien (DOB / Tgl Lahir / TTL / Lahir) jika ada dalam teks catatan. Konversikan SELALU ke format 'YYYY-MM-DD' (contoh: "DOB: 12/05/2023" -> "2023-05-12", "12-05-2023" -> "2023-05-12", "12 Mei 2023" -> "2023-05-12", "2023-05-12" -> "2023-05-12"). Jika tidak ada di teks, gunakan string kosong "".
4. jk: Jenis kelamin pasien: 'L' (Laki-laki), 'P' (Perempuan), atau string kosong "".
5. rm: Nomor Rekam Medis jika ada (misal: "01-88-29", "020918"). Jika tidak ada, gunakan string kosong "".
6. room: Nama ruangan / bangsal sesuai teks atau kecocokan terdekat.
7. kamar: Nomor kamar atau nomor bed (misal: "Bed 3", "2A", "Bed 1", "3", "HCU-2").
8. dpjp: Nama dokter konsulen / yang merawat sesuai peran.
9. doctorRole: "DPJP", "RABER", "KONSUL", atau "" bila belum pasti.
10. supervisingDpjp: Nama DPJP utama bila doctorRole adalah RABER atau KONSUL, jika DPJP kosongkan "".
11. dx: Diagnosis kerja / klinis pasien secara ringkas dan medis. HANYA diagnosis saja! JANGAN menyertakan pre/post op terpisah, tindakan operasi, atau TTV.

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
                    dob: { type: Type.STRING, description: "Tanggal lahir pasien format YYYY-MM-DD jika diketahui, jika tidak kosongkan" },
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
        const dob = normalizeDob(p.dob);
        return {
          name: String(p.name || '').trim(),
          age: String(p.age || '').trim(),
          ...(dob ? { dob } : {}),
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
