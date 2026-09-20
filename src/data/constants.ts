import { Patient } from '../types';

export const DIVISIONS: string[] = ['Bedah Digestif & Umum','Bedah Anak','Urologi','Ortopedi','Bedah Saraf','BTKV','Bedah Plastik','Bedah Onkologi'];
export const DIVISION_CONSULTANTS: Record<string, string[]> = {
  'Bedah Anak': ['dr. Santi Rini., Sp.BA., Subsp.DA(K)','dr. Fahad Ahmed Shah K., Sp.BA'],
  'Bedah Plastik': ['dr. Andi Mohammad Ardan, Sp. BP-RE','dr. Yudhy Arius, Sp. BP-RE'],
  'Bedah Onkologi': ['dr. Zainal Abidin, Sp.B, SubSp.Onk(K), MARS, MH.Kes','dr. Irvan Tanri Liwang, Sp.B., Subsp.Onk(K)'],
  'Urologi': ['dr. Poppy Desra Syahfitri Nasution, Sp.U','dr. Made Adi Wiratama, Sp.U, M.Ked.Klin, FICS','dr. Muhammad Rozaqy Ishaq, Sp.U, M.Ked.Klin','dr. Boyke Soebhali, Sp.U(K)','dr. Ricky Agave Ompusunggu, Sp.U'],
  'BTKV': ['dr. Ivan Joalsen Mangara Tua, Sp.BTKV, Subsp-VE(K)','dr. Michael Caesario, Sp.BTKV(K)','dr. Ery Irawan, Sp.BTKV, M.Ked.Klin.','dr. David Hermawan Christian, Sp.BTKV, M.Ked.Klin.(K)'],
  'Bedah Digestif & Umum': ['dr. Bambang Suprapto, Sp. B(K)BD','dr. Ahmad Toboroni Nasution, Sp. B(K)BD'],
  'Ortopedi': ['dr. Yasser Ridwan, Sp.OT, K-Spine, FICS','dr. Hendri Purnama, Sp.OT, K-Hip&Knee','dr. Fahroni C. Winata, M.Kes, Sp.OT, K-Sport, FICS, AIFO-K','dr. Achmad Fachrizal, Sp.OT'],
  'Bedah Saraf': ['dr. Dini Heryani, Sp.BS','dr. Taufiq Fatchur Rochman, Sp.BS']
};

/** Master database nama konsulen anak yang dapat dipilih sebagai dokter DPJP/konsulen. */
export const PEDIATRIC_CONSULTANTS: string[] = [
  'dr. Ahmad Wisnu Wardhana, M.Sc., Sp.A',
  'dr. Anrih Roi Manthurio, Sp.A',
  'dr. Diane Meytha Supit, Sp.A, Subsp.TKPS (K)',
  'dr. Hendra, Sp.A',
  'dr. Rabiatul Adawiyah, Sp.A',
  'dr. Sherly Yuniarchan, Sp.A',
  'dr. Trisna Silawati, Sp.A, Subsp. ETIA (K)',
  'dr. William S. Tjeng, Sp.A Subsp. IT (K)',
  'dr. Diah Budiarti, M.Ked.Klin., Sp.A',
  'dr. Dhini Karunia BA, Sp.A'
];

/**
 * Semua dokter yang dikenal di seluruh divisi + dokter anak, digabung jadi satu pool
 * untuk keperluan fuzzy matching nama dokter dari hasil AI.
 */
export function getAllKnownDoctors(extraDpjps: string[] = []): string[] {
  const fromDivisions = Object.values(DIVISION_CONSULTANTS).flat();
  return [...new Set([...fromDivisions, ...PEDIATRIC_CONSULTANTS, ...extraDpjps])].filter(Boolean);
}

/**
 * Normalisasi nama dokter: lowercase, hapus spasi ganda, hapus tanda baca
 * non-alfanumerik yang sering berbeda penulisannya (titik, koma, tanda hubung).
 */
function normalizeDoctorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,\-()]/g, ' ')   // ganti tanda baca umum jadi spasi
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ekstrak token kata penting dari nama dokter.
 * Abaikan gelar prefiks (dr, drg, prof) dan sufiks spesialisasi pendek (sp, subsp, m, ked, klin, k, fics, mars, mh, kes, msc, re, dst).
 * Yang tersisa adalah token nama asli yang bermakna untuk perbandingan.
 */
function extractNameTokens(name: string): string[] {
  const STOPWORDS = new Set([
    'dr', 'drg', 'prof', 'sp', 'subsp', 'm', 'ked', 'klin', 'k', 'fics',
    'mars', 'mh', 'kes', 'msc', 're', 'a', 'b', 'ba', 'bs', 'bt', 'btkv',
    'ot', 'u', 'bp', 'onk', 'da', 've', 'et', 'ia', 'it', 'tkps', 'etia',
    'spbp', 'subspda', 'subsponk', 'subspve',
  ]);
  return normalizeDoctorName(name)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Fuzzy match: cari nama dokter paling cocok dari daftar kandidat.
 * Urutan prioritas:
 *   1. Exact match (setelah normalisasi)
 *   2. Input adalah substring dari kandidat (nama pendek cocok ke nama lengkap)
 *   3. Token overlap — semua token input ditemukan di kandidat
 *   4. Token overlap sebagian — minimal 2 token input cocok & score tertinggi
 * Kembalikan nama lengkap dari database jika cocok, atau string kosong jika tidak ada.
 */
export function fuzzyMatchDoctor(input: string, candidates: string[]): string {
  if (!input.trim() || !candidates.length) return '';

  const normInput = normalizeDoctorName(input);

  // 1. Exact match
  const exact = candidates.find((c) => normalizeDoctorName(c) === normInput);
  if (exact) return exact;

  // 2. Substring: input (setelah normalisasi) terkandung dalam kandidat
  //    Misal: "dr. Santi, Sp. BA" → cocok ke "dr. Santi Rini., Sp.BA., Subsp.DA(K)"
  //    Syarat: panjang input minimal 6 karakter agar tidak false-positive
  if (normInput.length >= 6) {
    const substringMatch = candidates.find((c) => normalizeDoctorName(c).includes(normInput));
    if (substringMatch) return substringMatch;
  }

  // 3. Token overlap penuh: semua token input ada di token kandidat
  const inputTokens = extractNameTokens(input);
  if (inputTokens.length >= 1) {
    const fullTokenMatch = candidates.find((c) => {
      const cTokens = new Set(extractNameTokens(c));
      return inputTokens.every((t) => cTokens.has(t));
    });
    if (fullTokenMatch) return fullTokenMatch;
  }

  // 4. Token overlap sebagian: hitung skor, ambil yang tertinggi
  //    Minimal 2 token harus cocok agar tidak false-positive
  if (inputTokens.length >= 2) {
    let bestScore = 0;
    let bestCandidate = '';
    for (const c of candidates) {
      const cTokens = new Set(extractNameTokens(c));
      const matched = inputTokens.filter((t) => cTokens.has(t)).length;
      // Skor = proporsi token input yang cocok ke kandidat
      const score = matched / inputTokens.length;
      if (matched >= 2 && score > bestScore) {
        bestScore = score;
        bestCandidate = c;
      }
    }
    if (bestCandidate) return bestCandidate;
  }

  return '';
}

/** Master database ruangan dengan urutan tetap resmi. */
export const MASTER_ROOMS: string[] = ['IGD','Seroja','NICU','PICU','ICCU','ICU','Lily','Mawar','Teratai','Anggrek','Edelweis','Cempaka','Aster','Melati','Flamboyan 1','Flamboyan 2','HCU','Angsoka','Dahlia','Tulip'];
export const DEFAULT_ROOMS = MASTER_ROOMS;

/** Urutan ruangan khusus divisi Bedah Plastik & Rekonstruksi Estetik */
export const PLASTIC_SURGERY_ROOMS: string[] = [
  'IGD',
  'PICU',
  'NICU',
  'ICU',
  'ICCU',
  'Lily',
  'Teratai',
  'Anggrek',
  'Edelweis',
  'Cempaka',
  'Aster',
  'Mawar',
  'Melati',
  'Flamboyan 1',
  'Flamboyan 2',
  'HCU / Seruni',
  'Angsoka',
  'Dahlia',
  'Seroja'
];

export function isPlasticSurgeryDivision(division?: string | null): boolean {
  if (!division) return false;
  const d = division.toLowerCase();
  return d.includes('plastik') || d.includes('plastic') || d.includes('bp-re') || d.includes('bpre');
}

export function normalizePlasticSurgeryRoomName(rawRoom?: string): string {
  if (!rawRoom) return '';
  const trimmed = rawRoom.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'hcu' || lower === 'seruni' || lower === 'hcu / seruni' || lower === 'seruni / hcu' || (lower.includes('hcu') && lower.includes('seruni'))) {
    return 'HCU / Seruni';
  }
  if (lower === 'flamboyan' || lower === 'flamboyan 1') {
    return 'Flamboyan 1';
  }
  if (lower === 'flamboyan 2') {
    return 'Flamboyan 2';
  }
  const found = PLASTIC_SURGERY_ROOMS.find((r) => r.toLowerCase() === lower);
  if (found) return found;
  return normalizeRoomName(rawRoom);
}

/**
 * Ekstrak nama panggilan singkat pasien untuk ringkasan header Bedah Plastik
 * Contoh: "I Komang Swardika" -> "Komang", "Ahmad Tamami" -> "Ahmad Tamami", "Muhammad Shahibul Fadhilah" -> "Shahibul"
 */
export function extractPatientCallName(fullName?: string): string {
  if (!fullName) return '';
  const clean = fullName.replace(/^(tn\.?|ny\.?|an\.?|by\.?|nn\.?|sdr\.?|sdri\.?|tuan|nyonya|anak|bayi)\s+/i, '').trim();
  if (!clean) return fullName.trim();

  // Awalan khas Bali / gelar kekeluargaan
  const baliMatch = clean.match(/^(?:i|ni|gusti|i\s+gusti|ni\s+gusti|anak\s+agung|tjokorda|ida\s+bagus)\s+([a-zA-Z]+)/i);
  if (baliMatch && baliMatch[1]) {
    return baliMatch[1];
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];

  // Awalan seperti Muhammad / Moh / Muh -> ambil kata kedua
  if (/^(muhammad|mohammad|mohamad|muh\.?|moh\.?|m\.?|i|ni)$/i.test(parts[0]) && parts[1]) {
    return parts[1];
  }

  // Nama ganda umum di Indonesia (misal "Ahmad Tamami", "Siti Rukanah", "Budi Setiawan", "Stephanus Arung")
  const firstLower = parts[0].toLowerCase();
  if (firstLower === 'ahmad' || firstLower === 'siti' || firstLower === 'budi' || firstLower === 'stephanus') {
    return `${parts[0]} ${parts[1]}`;
  }

  return parts[0];
}

/** Bersihkan honorific untuk laporan Bedah Plastik */
export function cleanPatientNameForPlastic(name?: string): string {
  if (!name) return '-';
  const clean = name.replace(/^(tn\.?|ny\.?|an\.?|by\.?|nn\.?|sdr\.?|sdri\.?|tuan|nyonya|anak|bayi)\s+/i, '').trim();
  return clean || name.trim();
}

/** Format usia khusus Bedah Plastik (misal: "26 tahun", "1 tahun") */
export function formatPlasticAge(age?: string): string {
  if (!age || !age.trim() || age.trim() === '-') return '-';
  const s = age.trim();
  if (/^\d+$/.test(s)) return `${s} tahun`;
  if (/^\d+\s*thn?$/i.test(s)) return s.replace(/\s*thn?$/i, ' tahun');
  return s;
}

/** Format Ruangan/Kamar khusus Bedah Plastik (misal: "Kamar 10", "Aster 6.1", "Melati 6", "K3001") */
export function formatPlasticRoomKamar(room?: string, kamar?: string): string {
  const normRoom = normalizePlasticSurgeryRoomName(room);
  const cleanKamar = (kamar || '').trim();
  if (!cleanKamar || cleanKamar === '-' || cleanKamar.toLowerCase() === 'kamar -') {
    return normRoom || '-';
  }
  // Jika kamar sudah menyertakan nama ruangan (misal: "Aster 6.3")
  if (normRoom && cleanKamar.toLowerCase().includes(normRoom.toLowerCase())) {
    return cleanKamar;
  }
  // Jika kamar sudah memiliki awalan kamar/bed atau kode khusus (misal "K3001", "Bed 1")
  if (/^(kamar|bed|k\d{3,})/i.test(cleanKamar)) {
    return cleanKamar;
  }
  if (/^k\d{1,2}$/i.test(cleanKamar)) {
    return `Kamar ${cleanKamar.slice(1)}`;
  }
  // Jika ruangan Aster atau Melati dan kamar nomor seperti "6.3", "6.1", "2.1"
  if (/aster|melati/i.test(normRoom) && /^[\d\.]+$/.test(cleanKamar)) {
    return `${normRoom} ${cleanKamar}`;
  }
  // Jika hanya angka nomor kamar murni
  if (/^\d+(\.\d+)?$/.test(cleanKamar)) {
    return `Kamar ${cleanKamar}`;
  }
  return cleanKamar;
}

/** Format tanggal MRS khusus Bedah Plastik (DD/MM/YYYY) */
export function formatPlasticAdmissionDate(patient: Patient): string {
  const rawDate = patient.admissionDate || patient.date;
  if (!rawDate || !rawDate.trim() || rawDate.trim() === '-') return '-';
  const trimmed = rawDate.trim();
  // Jika sudah format DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  // Jika format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  // Coba parse tanggal
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return trimmed;
}

/** Format DPJP/Konsulen khusus Bedah Plastik */
export function formatPlasticDpjp(patient: Patient): string {
  const dpjp = patient.dpjp || '-';
  const role = patient.doctorRole;
  const mainDpjp = patient.supervisingDpjp || '';

  if (role === 'RABER') {
    if (mainDpjp) {
      return `DPJP: ${mainDpjp}\nRaber: ${dpjp}`;
    }
    return `DPJP: ${dpjp} (Raber)`;
  }
  if (role === 'KONSUL') {
    if (mainDpjp) {
      return `DPJP: ${mainDpjp}\nKonsul: ${dpjp}`;
    }
    return `DPJP: ${dpjp} (Konsul)`;
  }
  return `DPJP: ${dpjp}`;
}

export const BED_ONLY_ROOMS: string[] = ['NICU','PICU','ICCU','ICU'];
export function isBedRoom(roomName?: string): boolean { if (!roomName) return false; const upper = roomName.trim().toUpperCase(); return BED_ONLY_ROOMS.some((r) => r.toUpperCase() === upper); }
export function normalizeRoomName(roomName?: string): string { if (!roomName) return ''; const trimmed = roomName.trim(); const found = MASTER_ROOMS.find((r) => r.toLowerCase() === trimmed.toLowerCase()); return found || trimmed; }

/**
 * Mengembalikan indeks urutan ruangan berdasarkan MASTER_ROOMS.
 * Ruangan yang tidak terdaftar di MASTER_ROOMS diletakkan setelah MASTER_ROOMS secara alfabetis.
 */
export function getRoomSortIndex(roomName?: string): number {
  if (!roomName) return 9999;
  const norm = normalizeRoomName(roomName).toLowerCase();
  const idx = MASTER_ROOMS.findIndex((r) => r.toLowerCase() === norm);
  if (idx !== -1) return idx;
  return 1000;
}

/**
 * Membandingkan 2 pasien berdasarkan urutan master ruangan, lalu nomor bed / kamar, lalu nama pasien.
 */
export function comparePatientsByRoom(a: Patient, b: Patient): number {
  const normA = normalizeRoomName(a.room);
  const normB = normalizeRoomName(b.room);

  const idxA = getRoomSortIndex(normA);
  const idxB = getRoomSortIndex(normB);

  if (idxA !== idxB) {
    if (idxA < 1000 || idxB < 1000) {
      return idxA - idxB;
    }
    // Keduanya ruangan kustom luar MASTER_ROOMS: urut alfabetis
    const roomCmp = normA.localeCompare(normB, 'id', { sensitivity: 'base' });
    if (roomCmp !== 0) return roomCmp;
  } else if (idxA >= 1000) {
    const roomCmp = normA.localeCompare(normB, 'id', { sensitivity: 'base' });
    if (roomCmp !== 0) return roomCmp;
  }

  // Jika ruangan sama, susun berdasarkan nomor Kamar/Bed secara natural (e.g. Bed 1, Bed 2, Bed 10)
  const kamarA = (a.kamar || '').trim();
  const kamarB = (b.kamar || '').trim();
  const kamarCmp = kamarA.localeCompare(kamarB, 'id', { numeric: true, sensitivity: 'base' });
  if (kamarCmp !== 0) return kamarCmp;

  // Jika kamar sama, susun nama pasien
  return (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' });
}

/**
 * Menyortir array pasien sesuai urutan ruangan resmi
 */
export function sortPatientsByRoom(patients: Patient[]): Patient[] {
  return [...patients].sort(comparePatientsByRoom);
}
export function formatKamarOrBed(roomName?: string, kamarVal?: string): string {
  const isBed = isBedRoom(roomName);
  if (!kamarVal || !kamarVal.trim() || kamarVal.trim() === '-' || kamarVal.trim().toLowerCase() === 'kamar -') return isBed ? 'Bed -' : 'K-';
  const clean = kamarVal.trim();
  if (isBed || /^bed\s*/i.test(clean)) return /^bed\s*/i.test(clean) ? clean.replace(/^bed\s*/i, 'Bed ') : `Bed ${clean}`;
  let nonBed = clean;
  if (/^kamar\s*/i.test(nonBed)) nonBed = nonBed.replace(/^kamar\s*/i, '');
  else if (/^k[\.\s]+/i.test(nonBed)) nonBed = nonBed.replace(/^k[\.\s]+/i, '');
  else if (/^k(?=[0-9])/i.test(nonBed)) nonBed = nonBed.replace(/^k/i, '');
  return `K${nonBed}`;
}
export function parseAgeInDays(ageStr?: string): number | null {
  if (!ageStr) return null;
  const s = ageStr.toLowerCase().trim();
  if (!s) return null;
  if (/<\s*1\s*(?:bln|bulan|mo|month)/.test(s)) return 15;
  if (/^0\s*(?:bln|bulan|mo|month)/.test(s)) return 15;
  let totalDays = 0;
  let matched = false;
  const yr = s.match(/(\d+(?:[.,]\d+)?)\s*(?:th|tahun|thn|yr|year)/);
  if (yr) { totalDays += parseFloat(yr[1].replace(',', '.')) * 365; matched = true; }
  const mo = s.match(/(\d+(?:[.,]\d+)?)\s*(?:bln|bulan|mo|month)/);
  if (mo) { totalDays += parseFloat(mo[1].replace(',', '.')) * 30.4375; matched = true; }
  const wk = s.match(/(\d+(?:[.,]\d+)?)\s*(?:mgg|minggu|wk|week)/);
  if (wk) { totalDays += parseFloat(wk[1].replace(',', '.')) * 7; matched = true; }
  const dy = s.match(/(\d+(?:[.,]\d+)?)\s*(?:hr|hari|day)/);
  if (dy) { totalDays += parseFloat(dy[1].replace(',', '.')); matched = true; }
  const hr = s.match(/(\d+(?:[.,]\d+)?)\s*(?:jam|hour)/);
  if (hr) { totalDays += parseFloat(hr[1].replace(',', '.')) / 24; matched = true; }
  if (matched) return totalDays;
  const plainNum = s.match(/^(\d+(?:[.,]\d+)?)$/);
  if (plainNum) return parseFloat(plainNum[1].replace(',', '.')) * 365;
  const fallbackNum = s.match(/(\d+(?:[.,]\d+)?)/);
  if (fallbackNum) return parseFloat(fallbackNum[1].replace(',', '.')) * 365;
  return null;
}
export function parseAgeInYears(ageStr?: string): number | null { const days = parseAgeInDays(ageStr); if (days === null) return null; return days / 365; }
export function getPatientHonorific(ageStr?: string, jk?: 'L'|'P'|string, rawName?: string): 'By.'|'An.'|'Tn.'|'Ny.'|'' {
  const days = parseAgeInDays(ageStr);
  if (days !== null) {
    if (days < 30) return 'By.';
    if (days < 18 * 365) return 'An.';
    if (jk === 'P') return 'Ny.';
    if (jk === 'L') return 'Tn.';
    return '';
  }
  if (rawName && /^(by\.?|bayi)\s+/i.test(rawName.trim())) return 'By.';
  if (rawName && /^(an\.?|anak)\s+/i.test(rawName.trim())) return 'An.';
  if (jk === 'P') return 'Ny.';
  if (jk === 'L') return 'Tn.';
  return '';
}
export function formatPatientNameWithHonorific(name?: string, ageStr?: string, jk?: 'L'|'P'|string): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  const prefix = getPatientHonorific(ageStr, jk, trimmed);
  let cleanName = trimmed;
  if (/^(by\.?\s*ny\.?|bayi\s*ny\.?)\s+/i.test(cleanName)) {
    cleanName = cleanName.replace(/^(by\.?\s*|bayi\s*)/i, '').trim();
    if (prefix !== 'An.' && prefix !== 'By.') cleanName = cleanName.replace(/^(ny\.?|nyonya)\s+/i, '').trim();
  } else {
    cleanName = cleanName.replace(/^(tn\.?|ny\.?|an\.?|by\.?|nn\.?|sdr\.?|sdri\.?|tuan|nyonya|anak|bayi)\s+/i, '').trim();
  }
  if (!cleanName) return prefix ? `${prefix} ${trimmed}` : trimmed;
  if (!prefix) return trimmed;
  return `${prefix} ${cleanName}`;
}
export function formatRoomDisplay(room?: string,kamar?: string): string { const r=(room||'').trim(); const k=(kamar||'').trim(); if(!r&&!k)return '-'; if(!k)return r; if(!r)return k; return `${r} ${k}`; }
export const SAMPLE_PATIENTS: Patient[] = [];

/** Prefix identitas divisi bedah untuk penomoran PIN tim */
export const DIVISION_PIN_PREFIXES: Record<string, string> = {
  'Bedah Digestif & Umum': 'DIG',
  'Bedah Anak': 'BAN',
  'Urologi': 'URO',
  'Ortopedi': 'ORT',
  'Bedah Saraf': 'BSF',
  'BTKV': 'BTKV',
  'Bedah Plastik': 'BPL',
  'Bedah Onkologi': 'ONK'
};

export function getDivisionPinPrefix(division?: string | null): string {
  if (!division) return 'BED';
  if (DIVISION_PIN_PREFIXES[division]) return DIVISION_PIN_PREFIXES[division];
  const lower = division.toLowerCase();
  if (lower.includes('digestif')) return 'DIG';
  if (lower.includes('anak')) return 'BAN';
  if (lower.includes('uro')) return 'URO';
  if (lower.includes('orto')) return 'ORT';
  if (lower.includes('saraf')) return 'BSF';
  if (lower.includes('tkv')) return 'BTKV';
  if (lower.includes('plastik')) return 'BPL';
  if (lower.includes('onko')) return 'ONK';
  return division.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'BED';
}

/** Menghasilkan PIN unik berbasis identitas divisi bedah, misalnya URO-123, DIG-742, ORT-309 */
export function generateDivisionPin(division?: string | null): string {
  const prefix = getDivisionPinPrefix(division);
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${num}`;
}

export function getDefaultTeamCode(division: string): string {
  return generateDivisionPin(division);
}
export const DEFAULT_TEAM_CODES: Record<string, string> = DIVISION_PIN_PREFIXES;
