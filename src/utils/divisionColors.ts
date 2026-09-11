import { useState, useEffect, useMemo, useCallback } from 'react';

export interface DivisionColorOption {
  key: string;
  name: string;
  hex: string;
  bg: string;
  bgHover: string;
  text: string;
  lightBg: string;
  border: string;
  bannerBg: string;
  badge: string;
  ring: string;
  dotColor: string;
}

export const COLOR_PALETTE: Record<string, DivisionColorOption> = {
  blue: {
    key: 'blue',
    name: 'Biru Royal',
    hex: '#2563eb',
    bg: 'bg-blue-600',
    bgHover: 'hover:bg-blue-700',
    text: 'text-blue-700',
    lightBg: 'bg-blue-50',
    border: 'border-blue-200',
    bannerBg: 'bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-slate-50 border-blue-200/90',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    ring: 'ring-blue-500',
    dotColor: '#2563eb'
  },
  emerald: {
    key: 'emerald',
    name: 'Hijau Emerald',
    hex: '#059669',
    bg: 'bg-emerald-600',
    bgHover: 'hover:bg-emerald-700',
    text: 'text-emerald-700',
    lightBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    bannerBg: 'bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-slate-50 border-emerald-200/90',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ring: 'ring-emerald-500',
    dotColor: '#059669'
  },
  amber: {
    key: 'amber',
    name: 'Kuning Amber',
    hex: '#d97706',
    bg: 'bg-amber-600',
    bgHover: 'hover:bg-amber-700',
    text: 'text-amber-800',
    lightBg: 'bg-amber-50',
    border: 'border-amber-200',
    bannerBg: 'bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-slate-50 border-amber-200/90',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    ring: 'ring-amber-500',
    dotColor: '#d97706'
  },
  cyan: {
    key: 'cyan',
    name: 'Cyan Medis',
    hex: '#0891b2',
    bg: 'bg-cyan-600',
    bgHover: 'hover:bg-cyan-700',
    text: 'text-cyan-800',
    lightBg: 'bg-cyan-50',
    border: 'border-cyan-200',
    bannerBg: 'bg-gradient-to-r from-cyan-50/90 via-sky-50/50 to-slate-50 border-cyan-200/90',
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    ring: 'ring-cyan-500',
    dotColor: '#0891b2'
  },
  violet: {
    key: 'violet',
    name: 'Ungu Violet',
    hex: '#7c3aed',
    bg: 'bg-violet-600',
    bgHover: 'hover:bg-violet-700',
    text: 'text-violet-700',
    lightBg: 'bg-violet-50',
    border: 'border-violet-200',
    bannerBg: 'bg-gradient-to-r from-violet-50/90 via-purple-50/50 to-slate-50 border-violet-200/90',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    ring: 'ring-violet-500',
    dotColor: '#7c3aed'
  },
  rose: {
    key: 'rose',
    name: 'Merah Rose',
    hex: '#e11d48',
    bg: 'bg-rose-600',
    bgHover: 'hover:bg-rose-700',
    text: 'text-rose-700',
    lightBg: 'bg-rose-50',
    border: 'border-rose-200',
    bannerBg: 'bg-gradient-to-r from-rose-50/90 via-pink-50/50 to-slate-50 border-rose-200/90',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    ring: 'ring-rose-500',
    dotColor: '#e11d48'
  },
  fuchsia: {
    key: 'fuchsia',
    name: 'Magenta Fuchsia',
    hex: '#c026d3',
    bg: 'bg-fuchsia-600',
    bgHover: 'hover:bg-fuchsia-700',
    text: 'text-fuchsia-700',
    lightBg: 'bg-fuchsia-50',
    border: 'border-fuchsia-200',
    bannerBg: 'bg-gradient-to-r from-fuchsia-50/90 via-pink-50/50 to-slate-50 border-fuchsia-200/90',
    badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    ring: 'ring-fuchsia-500',
    dotColor: '#c026d3'
  },
  orange: {
    key: 'orange',
    name: 'Oranye Terang',
    hex: '#ea580c',
    bg: 'bg-orange-600',
    bgHover: 'hover:bg-orange-700',
    text: 'text-orange-800',
    lightBg: 'bg-orange-50',
    border: 'border-orange-200',
    bannerBg: 'bg-gradient-to-r from-orange-50/90 via-amber-50/50 to-slate-50 border-orange-200/90',
    badge: 'bg-orange-50 text-orange-800 border-orange-200',
    ring: 'ring-orange-500',
    dotColor: '#ea580c'
  },
  teal: {
    key: 'teal',
    name: 'Teal Samudra',
    hex: '#0d9488',
    bg: 'bg-teal-600',
    bgHover: 'hover:bg-teal-700',
    text: 'text-teal-700',
    lightBg: 'bg-teal-50',
    border: 'border-teal-200',
    bannerBg: 'bg-gradient-to-r from-teal-50/90 via-emerald-50/50 to-slate-50 border-teal-200/90',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    ring: 'ring-teal-500',
    dotColor: '#0d9488'
  },
  indigo: {
    key: 'indigo',
    name: 'Indigo Gelap',
    hex: '#4f46e5',
    bg: 'bg-indigo-600',
    bgHover: 'hover:bg-indigo-700',
    text: 'text-indigo-700',
    lightBg: 'bg-indigo-50',
    border: 'border-indigo-200',
    bannerBg: 'bg-gradient-to-r from-indigo-50/90 via-blue-50/50 to-slate-50 border-indigo-200/90',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ring: 'ring-indigo-500',
    dotColor: '#4f46e5'
  }
};

export const AVAILABLE_COLOR_KEYS = Object.keys(COLOR_PALETTE);

export const DEFAULT_DIVISION_COLORS: Record<string, string> = {
  'Bedah Digestif & Umum': 'blue',
  'Bedah Anak': 'emerald',
  'Urologi': 'amber',
  'Ortopedi': 'cyan',
  'Bedah Saraf': 'violet',
  'BTKV': 'rose',
  'Bedah Plastik': 'fuchsia',
  'Bedah Onkologi': 'orange'
};

const STORAGE_KEY = 'sweepinganku_division_identity_colors';
export const DIVISION_COLOR_EVENT = 'sweepinganku_division_color_change';

export function loadDivisionColorMap(): Record<string, string> {
  if (typeof window === 'undefined') return { ...DEFAULT_DIVISION_COLORS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DIVISION_COLORS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DIVISION_COLORS, ...parsed };
  } catch (e) {
    console.error('Failed to load division colors:', e);
    return { ...DEFAULT_DIVISION_COLORS };
  }
}

export function saveDivisionColorMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(DIVISION_COLOR_EVENT, { detail: map }));
  } catch (e) {
    console.error('Failed to save division colors:', e);
  }
}

export function setDivisionColor(division: string, colorKey: string): void {
  const current = loadDivisionColorMap();
  current[division] = colorKey;
  saveDivisionColorMap(current);
}

export function resetDivisionColors(): Record<string, string> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(DIVISION_COLOR_EVENT, { detail: DEFAULT_DIVISION_COLORS }));
  }
  return { ...DEFAULT_DIVISION_COLORS };
}

export function getDivisionColorTheme(division?: string | null, customMap?: Record<string, string>): DivisionColorOption {
  if (!division) return COLOR_PALETTE.blue;
  const map = customMap || loadDivisionColorMap();
  const colorKey = map[division] || DEFAULT_DIVISION_COLORS[division] || 'blue';
  return COLOR_PALETTE[colorKey] || COLOR_PALETTE.blue;
}

export function useDivisionColors(activeDivision?: string) {
  const [colorMap, setColorMap] = useState<Record<string, string>>(() => loadDivisionColorMap());

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      if (customEvent.detail) {
        setColorMap(customEvent.detail);
      } else {
        setColorMap(loadDivisionColorMap());
      }
    };

    window.addEventListener(DIVISION_COLOR_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(DIVISION_COLOR_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const activeTheme = useMemo(() => {
    return getDivisionColorTheme(activeDivision, colorMap);
  }, [activeDivision, colorMap]);

  const updateDivisionColor = useCallback((division: string, colorKey: string) => {
    setDivisionColor(division, colorKey);
  }, []);

  const resetColors = useCallback(() => {
    resetDivisionColors();
  }, []);

  return {
    colorMap,
    activeTheme,
    updateDivisionColor,
    resetColors
  };
}

