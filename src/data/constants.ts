import { Patient } from '../types';

export const DIVISIONS: string[] = ['Bedah Digestif & Umum','Bedah Anak','Urologi','Ortopedi','Bedah Saraf','BTKV','Bedah Plastik','Bedah Onkologi'];
export const DIVISION_CONSULTANTS: Record<string, string[]> = {
  'Bedah Anak': ['dr. Santi Rini., Sp.BA., Subsp.DA(K)','dr. Fahad Ahmed Shah Khaisama T., Sp.BA'],
  'Bedah Plastik': ['dr. Andi Mohammad Ardan, SpBP-RE','dr. Yudhy Arius, Sp.BP-RE'],
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

/** Master database ruangan dengan urutan tetap resmi. */
export const MASTER_ROOMS: string[] = ['IGD','Seroja','NICU','PICU','ICCU','ICU','Mawar','Teratai','Anggrek','Edelweis','Cempaka','Aster','Melati','Flamboyan 1','Flamboyan 2','HCU','Angsoka','Dahlia','Tulip'];
export const DEFAULT_ROOMS = MASTER_ROOMS;
export const BED_ONLY_ROOMS: string[] = ['NICU','PICU','ICCU','ICU'];
export function isBedRoom(roomName?: string): boolean { if (!roomName) return false; const upper = roomName.trim().toUpperCase(); return BED_ONLY_ROOMS.some((r) => r.toUpperCase() === upper); }
export function normalizeRoomName(roomName?: string): string { if (!roomName) return ''; const trimmed = roomName.trim(); const found = MASTER_ROOMS.find((r) => r.toLowerCase() === trimmed.toLowerCase()); return found || trimmed; }
export function formatKamarOrBed(roomName?: string, kamarVal?: string): string { const isBed = isBedRoom(roomName); if (!kamarVal || !kamarVal.trim() || kamarVal.trim() === '-' || kamarVal.trim().toLowerCase() === 'kamar -') return isBed ? 'Bed -' : 'K-'; const clean = kamarVal.trim(); if (isBed) return /^bed\s*/i.test(clean) ? clean.replace(/^bed\s*/i, 'Bed ') : `Bed ${clean}`; let nonBed = clean; if (/^kamar\s*/i.test(nonBed)) nonBed = nonBed.replace(/^kamar\s*/i, ''); else if (/^k[\.\s]+/i.test(nonBed)) nonBed = nonBed.replace(/^k[\.\s]+/i, ''); else if (/^k(?=[0-9])/i.test(nonBed)) nonBed = nonBed.replace(/^k/i, ''); return `K${nonBed}`; }
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
export const DEFAULT_TEAM_CODES: Record<string,string> = {'Bedah Digestif & Umum':'DIGESTIF','Bedah Anak':'BEDAH-ANAK','Urologi':'UROLOGI','Ortopedi':'ORTOPEDI','Bedah Saraf':'BEDAH-SARAF','BTKV':'BTKV','Bedah Plastik':'BEDAH-PLASTIK','Bedah Onkologi':'ONKOLOGI'};
export function getDefaultTeamCode(division:string):string{return DEFAULT_TEAM_CODES[division]||division.replace(/[^a-zA-Z0-9]/g,'').toUpperCase().slice(0,8);}
