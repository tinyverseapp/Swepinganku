import { Patient } from '../types';

export const DIVISIONS: string[] = [
  'Bedah Digestif & Umum',
  'Bedah Anak',
  'Urologi',
  'Ortopedi',
  'Bedah Saraf',
  'BTKV',
  'Bedah Plastik',
  'Bedah Onkologi'
];

/**
 * Master data dokter konsulen (DPJP) per divisi stase bedah.
 * Nama di sini menjadi base data yang muncul pada pilihan DPJP.
 */
export const DIVISION_CONSULTANTS: Record<string, string[]> = {
  'Bedah Anak': [
    'dr. Santi Rini., Sp.BA., Subsp.DA(K)',
    'dr. Fahad Ahmed Shah Khaisama T., Sp.BA'
  ],
  'Bedah Plastik': [
    'dr. Andi Mohammad Ardan, SpBP-RE',
    'dr. Yudhy Arius, Sp.BP-RE'
  ],
  'Bedah Onkologi': [
    'dr. Zainal Abidin, Sp.B, SubSp.Onk(K), MARS, MH.Kes',
    'dr. Irvan Tanri Liwang, Sp.B., Subsp.Onk(K)'
  ],
  'Urologi': [
    'dr. Poppy Desra Syahfitri Nasution, Sp.U',
    'dr. Made Adi Wiratama, Sp.U, M.Ked.Klin, FICS',
    'dr. Muhammad Rozaqy Ishaq, Sp.U, M.Ked.Klin',
    'dr. Boyke Soebhali, Sp.U(K)',
    'dr. Ricky Agave Ompusunggu, Sp.U'
  ],
  'BTKV': [
    'dr. Ivan Joalsen Mangara Tua, Sp.BTKV, Subsp-VE(K)',
    'dr. Michael Caesario, Sp.BTKV(K)',
    'dr. Ery Irawan, Sp.BTKV, M.Ked.Klin.',
    'dr. David Hermawan Christian, Sp.BTKV, M.Ked.Klin.(K)'
  ],
  'Bedah Digestif & Umum': [
    'dr. Ahmad T. Nasution, Sp.B.KBD',
    'dr. Bambang Suprapto, Sp.B(K)BD'
  ],
  'Ortopedi': [
    'dr. Yasser Ridwan, Sp.OT, K-Spine, FICS',
    'dr. Hendri Purnama, Sp.OT, K-Hip&Knee',
    'dr. Fahroni C. Winata, M.Kes, Sp.OT, K-Sport, FICS, AIFO-K',
    'dr. Achmad Fachrizal, Sp.OT'
  ],
  'Bedah Saraf': [
    'dr. Dini Heryani, Sp.BS',
    'dr. Taufiq Fatchur Rochman, Sp.BS'
  ]
};

/**
 * Master database ruangan dengan urutan tetap resmi:
 * 1. IGD
 * 2. Seroja
 * 3. NICU
 * 4. PICU
 * 5. ICCU
 * 6. ICU
 * 7. Ratai
 * 8. Anggrek
 * 9. Edelweiss
 * 10. Cempaka
 * 11. Aster
 * 12. Melati
 * 13. Flamboyan 1
 * 14. Flamboyan 2
 * 15. HCU
 * 16. Angsoka
 * 17. Dahlia
 */
export const MASTER_ROOMS: string[] = [
  'IGD',
  'Seroja',
  'NICU',
  'PICU',
  'ICCU',
  'ICU',
  'Ratai',
  'Anggrek',
  'Edelweiss',
  'Cempaka',
  'Aster',
  'Melati',
  'Flamboyan 1',
  'Flamboyan 2',
  'HCU',
  'Angsoka',
  'Dahlia'
];

export const DEFAULT_ROOMS = MASTER_ROOMS;

/**
 * 4 Ruangan perawatan intensif yang wajib menggunakan format "Bed" bukan "Kamar":
 * - NICU
 * - PICU
 * - ICCU
 * - ICU
 */
export const BED_ONLY_ROOMS: string[] = ['NICU', 'PICU', 'ICCU', 'ICU'];

export function isBedRoom(roomName?: string): boolean {
  if (!roomName) return false;
  const upper = roomName.trim().toUpperCase();
  return BED_ONLY_ROOMS.some((r) => r.toUpperCase() === upper);
}

export function normalizeRoomName(roomName?: string): string {
  if (!roomName) return '';
  const trimmed = roomName.trim();
  const found = MASTER_ROOMS.find((r) => r.toLowerCase() === trimmed.toLowerCase());
  return found || trimmed;
}

export function formatKamarOrBed(roomName?: string, kamarVal?: string): string {
  const isBed = isBedRoom(roomName);
  if (!kamarVal || !kamarVal.trim() || kamarVal.trim() === '-' || kamarVal.trim().toLowerCase() === 'kamar -') {
    return isBed ? 'Bed -' : 'K-';
  }
  const clean = kamarVal.trim();
  if (isBed) {
    if (/^bed\s*/i.test(clean)) return clean.replace(/^bed\s*/i, 'Bed ');
    return `Bed ${clean}`;
  }
  let nonBed = clean;
  if (/^kamar\s*/i.test(nonBed)) nonBed = nonBed.replace(/^kamar\s*/i, '');
  else if (/^k[\.\s]+/i.test(nonBed)) nonBed = nonBed.replace(/^k[\.\s]+/i, '');
  else if (/^k(?=[0-9])/i.test(nonBed)) nonBed = nonBed.replace(/^k/i, '');
  return `K${nonBed}`;
}

export function parseAgeInYears(ageStr?: string): number | null {
  if (!ageStr) return null;
  const s = ageStr.toLowerCase().trim();
  if (!s) return null;
  if (/(bln|bulan|month)/i.test(s) && !/(th|tahun|yr|year)/i.test(s)) {
    const match = s.match(/(\d+(?:[.,]\d+)?)/);
    return match ? parseFloat(match[1].replace(',', '.')) / 12 : 0;
  }
  if (/(hr|hari|day)/i.test(s) && !/(th|tahun|yr|year)/i.test(s)) {
    const match = s.match(/(\d+(?:[.,]\d+)?)/);
    return match ? parseFloat(match[1].replace(',', '.')) / 365 : 0;
  }
  if (/(mgg|minggu|wk|week)/i.test(s) && !/(th|tahun|yr|year)/i.test(s)) {
    const match = s.match(/(\d+(?:[.,]\d+)?)/);
    return match ? parseFloat(match[1].replace(',', '.')) / 52 : 0;
  }
  const match = s.match(/(\d+(?:[.,]\d+)?)/);
  return match ? parseFloat(match[1].replace(',', '.')) : null;
}

export function getPatientHonorific(ageStr?: string, jk?: 'L' | 'P' | string): 'An.' | 'Tn.' | 'Ny.' {
  const ageYears = parseAgeInYears(ageStr);
  if (ageYears !== null) return ageYears < 18 ? 'An.' : jk === 'P' ? 'Ny.' : 'Tn.';
  return jk === 'P' ? 'Ny.' : 'Tn.';
}

export function formatPatientNameWithHonorific(name?: string, ageStr?: string, jk?: 'L' | 'P' | string): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  const prefix = getPatientHonorific(ageStr, jk);
  let cleanName = trimmed;
  if (/^(by\.?\s*ny\.?|bayi\s*ny\.?)\s+/i.test(cleanName)) {
    cleanName = cleanName.replace(/^(by\.?\s*|bayi\s*)/i, '').trim();
    if (prefix !== 'An.') cleanName = cleanName.replace(/^(ny\.?|nyonya)\s+/i, '').trim();
  } else {
    cleanName = cleanName.replace(/^(tn\.?|ny\.?|an\.?|by\.?|nn\.?|sdr\.?|sdri\.?|tuan|nyonya|anak|bayi)\s+/i, '').trim();
  }
  if (!cleanName) return `${prefix} ${trimmed}`;
  return `${prefix} ${cleanName}`;
}

export const SAMPLE_PATIENTS: Patient[] = [
  {
    id: 'sample-p1', dpjp: 'dr. Andi Mohammad Ardan, SpBP-RE', room: 'Seroja', kamar: 'K201', name: 'Tn. Budi Santoso', jk: 'L', age: '34 th', rm: '00-88-21-45', dx: 'Vulnus Laceratum regio Facialis post debridement + heacting primer H+1, luka terawat kering', updatedAt: new Date().toISOString()
  },
  {
    id: 'sample-p2', dpjp: 'dr. Yudhy Arius, Sp.BP-RE', room: 'IGD', kamar: 'Bed 4', name: 'Ny. Siti Rahayu', jk: 'P', age: '29 th', rm: '00-89-10-33', dx: 'Combustio Grade IIA 15% regio antebrachii bilateral, kassa tulle terpasang', updatedAt: new Date().toISOString()
  },
  {
    id: 'sample-p3', dpjp: 'dr. Zainal Abidin, Sp.B, SubSp.Onk(K), MARS, MH.Kes', room: 'Seroja', kamar: 'K205', name: 'Ny. Endang Kusuma', jk: 'P', age: '48 th', rm: '00-90-12-09', dx: 'Post MRM sinistra H+2 ec Ca Mammae T2N1M0, drain aktif 30 cc serosanguineous', updatedAt: new Date().toISOString()
  },
  {
    id: 'sample-p4', dpjp: 'dr. Irvan Tanri Liwang, Sp.B., Subsp.Onk(K)', room: 'ICU', kamar: 'Bed 2', name: 'Tn. Hendro Wijaya', jk: 'L', age: '58 th', rm: '00-87-99-12', dx: 'Post Tiroidektomi Total H+1 ec Susp. Ca Tiroid, drain 10 cc serosa, sesak (-), stridor (-)', updatedAt: new Date().toISOString()
  },
  {
    id: 'sample-p5', dpjp: 'dr. Santi Rini., Sp.BA., Subsp.DA(K)', room: 'NICU', kamar: 'Bed 1', name: 'An. Ny. Rahmawati', jk: 'L', age: '3 hr', rm: '00-91-05-22', dx: 'Post Repair Atresia Ani H+1, TPN terpasang, saturasi 98% O2 nasal kanul', updatedAt: new Date().toISOString()
  },
  {
    id: 'sample-p6', dpjp: 'dr. Fahad Ahmed Shah Khaisama T., Sp.BA', room: 'PICU', kamar: 'Bed 3', name: 'An. Kevin Pratama', jk: 'L', age: '2 th', rm: '00-92-44-11', dx: 'Post Laparotomi Reduksi Invaginasi H+1, NGT alir cairan kehijauan minimal, luka operasi tenang', updatedAt: new Date().toISOString()
  }
];

export const DEFAULT_TEAM_CODES: Record<string, string> = {
  'Bedah Digestif & Umum': 'DIGESTIF', 'Bedah Anak': 'BEDAH-ANAK', 'Urologi': 'UROLOGI', 'Ortopedi': 'ORTOPEDI', 'Bedah Saraf': 'BEDAH-SARAF', 'BTKV': 'BTKV', 'Bedah Plastik': 'BEDAH-PLASTIK', 'Bedah Onkologi': 'ONKOLOGI'
};

export function getDefaultTeamCode(division: string): string {
  return DEFAULT_TEAM_CODES[division] || division.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}
