export interface Patient {
  id: string;
  dpjp: string;
  doctorRole?: 'DPJP' | 'RABER' | 'KONSUL';
  supervisingDpjp?: string;
  room: string;
  kamar: string;
  name: string;
  /** L/P when known; empty string when the source data is unclear. */
  jk: 'L' | 'P' | '';
  dob?: string;
  age: string;
  rm: string;
  dx: string;
  updatedAt: string;
  teamCode?: string;
  date?: string;
  division?: string;
  lastDate?: string;
  presenceStatus?: 'belum_periksa' | 'ada' | 'pulang';
  /** Manual weekly classification; intentionally not inferred from the date. */
  weeklyStatus?: 'baru' | 'lama' | '';
  /** Manual admission date shown for patients classified as baru. */
  admissionDate?: string;
}

export type ViewMode = 'dpjp' | 'all';
export type PageMode = 'dashboard' | 'document';

export interface DivisionTeam {
  teamCode: string;
  division: string;
  teamName: string;
  members: string[];
  weekStart?: string;
  weekEnd?: string;
  createdAt?: string;
  lastUpdated?: string;
}

export interface WeeklyRow {
  rm: string;
  name: string;
  jk: string;
  dob?: string;
  age: string;
  dpjp: string;
  dx: string;
  first: string;
  last: string;
  lastRoom: string;
  lastKamar: string;
  days: Record<string, string>;
  weeklyStatus?: 'baru' | 'lama' | '';
  admissionDate?: string;
}

export interface NextJsFile {
  path: string;
  description: string;
  language: string;
  content: string;
}

export interface RotationWeek {
  id: string;
  weekNumber: number;
  division: string;
  startDate: string;
  endDate: string;
  note?: string;
}
