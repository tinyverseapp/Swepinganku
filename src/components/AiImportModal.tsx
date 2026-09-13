import React, { useState } from 'react';
import { X, ClipboardPaste, Trash2, CheckCircle2, AlertCircle, Plus, FileText, RotateCcw } from 'lucide-react';
import { AiSparkleIcon } from './AiSparkleIcon';
import { Patient } from '../types';
import { parsePatientsWithAi, ParsedPatientRaw } from '../lib/aiService';
import { MASTER_ROOMS, PEDIATRIC_CONSULTANTS, normalizeRoomName } from '../data/constants';
import { formatIndonesianDate } from '../utils/storage';

interface AiImportModalProps {
  isOpen: boolean; onClose: () => void; division: string; date: string; teamCode?: string;
  knownRooms?: string[]; knownDpjps?: string[]; existingPatients?: Patient[];
  onImportPatients: (newPatients: Patient[]) => void;
}

const ROLE_OPTIONS = [
  { value: 'DPJP', label: 'DPJP' }, { value: 'RABER', label: 'Raber' }, { value: 'KONSUL', label: 'Konsul' },
] as const;
type DoctorRole = typeof ROLE_OPTIONS[number]['value'];

export function AiImportModal({ isOpen, onClose, division, date, teamCode, knownRooms = MASTER_ROOMS, knownDpjps = [], onImportPatients }: AiImportModalProps) {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedList, setParsedList] = useState<ParsedPatientRaw[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  if (!isOpen) return null;

  const sampleNote = `Operan Pasien:\n\n1. An. Budi (L / 8 th) RM: 01-88-29\nRuang Mawar Bed 3\nDPJP: dr. Ahmad Wisnu Wardhana, M.Sc., Sp.A\nRABER: dr. Santi Rini, Sp.BA\nDx: Hernia Inguinalis Lateralis Dextra\n\n2. An. Siti (P / 5 th) RM: 02-33-41\nRuang Teratai Kamar 2A\nDPJP: dr. Anrih Roi Manthurio, Sp.A\nKonsul Bedah Anak ke dr. Santi Rini, Sp.BA\nDx: Appendisitis Akut`;

  const handleRunAi = async () => {
    if (!inputText.trim()) { setError('Silakan masukkan atau tempel catatan pasien terlebih dahulu.'); return; }
    setIsLoading(true); setError(null);
    try {
      const results = await parsePatientsWithAi(inputText, division, knownRooms, knownDpjps, PEDIATRIC_CONSULTANTS);
      if (!results?.length) { setError('AI tidak mendeteksi data pasien pada teks yang diberikan.'); setParsedList([]); }
      else { setParsedList(results); setHasParsed(true); }
    } catch (err: any) { console.error('AI Parse error:', err); setError(err?.message || 'Gagal memproses catatan dengan AI.'); }
    finally { setIsLoading(false); }
  };
  const handlePasteClipboard = async () => {
    try { const text = await navigator.clipboard.readText(); if (text) { setInputText(text); setError(null); } }
    catch { setError('Izin akses clipboard ditolak oleh browser. Silakan tempel (Ctrl+V) langsung ke kolom teks.'); }
  };
  const handleClear = () => { setInputText(''); setParsedList([]); setHasParsed(false); setError(null); };
  const updateItem = (index: number, field: keyof ParsedPatientRaw, value: string) => setParsedList((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  const updateRole = (index: number, role: DoctorRole) => setParsedList((prev) => prev.map((p, i) => i === index ? { ...p, doctorRole: role, supervisingDpjp: role === 'DPJP' ? undefined : p.supervisingDpjp } : p));
  const addItem = () => setParsedList((prev) => [...prev, { name: '', age: '', jk: '', rm: '', room: '', kamar: '', dpjp: '', doctorRole: undefined, supervisingDpjp: undefined, dx: '' }]);

  const handleConfirmImport = () => {
    const valid = parsedList.filter((p) => p.name.trim());
    if (!valid.length) { setError('Semua pasien harus memiliki nama yang valid.'); return; }
    const incompleteRole = valid.find((p) => !p.doctorRole);
    if (incompleteRole) { setError(`Peran dokter untuk pasien "${incompleteRole.name}" belum ditentukan. Pilih DPJP, Raber, atau Konsul sebelum impor.`); return; }
    const incompleteSupervising = valid.find((p) => (p.doctorRole === 'RABER' || p.doctorRole === 'KONSUL') && !p.supervisingDpjp?.trim());
    if (incompleteSupervising) { setError(`DPJP utama untuk pasien "${incompleteSupervising.name}" belum diisi karena dokter tersebut berperan sebagai ${incompleteSupervising.doctorRole === 'RABER' ? 'Raber' : 'Konsul'}.`); return; }

    const timestamp = new Date().toISOString();
    const divisionDoctors = knownDpjps.map((d) => d.trim());
    const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
    const findDivisionDoctor = (value?: string) => divisionDoctors.find((d) => norm(d) === norm(value || '')) || '';
    const newPatients: Patient[] = valid.map((p, idx) => {
      let roleDoctor = p.dpjp.trim();
      let mainDpjp = p.supervisingDpjp?.trim() || '';
      const roleDoctorInDivision = findDivisionDoctor(roleDoctor);
      const mainDpjpInDivision = findDivisionDoctor(mainDpjp);
      if (!roleDoctorInDivision && mainDpjpInDivision && (p.doctorRole === 'RABER' || p.doctorRole === 'KONSUL')) {
        const externalMain = roleDoctor;
        roleDoctor = mainDpjpInDivision;
        mainDpjp = externalMain;
      } else if (!roleDoctorInDivision && p.doctorRole === 'DPJP') {
        mainDpjp = roleDoctor;
        roleDoctor = '';
      }
      return {
        id: `pt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        name: p.name.trim(), age: p.age.trim(), jk: p.jk === 'P' || p.jk === 'L' ? p.jk : '', rm: p.rm.trim(),
        room: normalizeRoomName(p.room) || '', kamar: p.kamar.trim(), dpjp: roleDoctor,
        doctorRole: p.doctorRole as DoctorRole,
        supervisingDpjp: mainDpjp || undefined,
        dx: p.dx.trim(), updatedAt: timestamp, teamCode: teamCode || '', date, division,
      };
    });
    onImportPatients(newPatients); onClose();
  };

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/80 via-white to-cyan-50/60">
        <div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs"><AiSparkleIcon size={22} className="shrink-0" /></div><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h2 className="text-base sm:text-lg font-extrabold text-slate-900">AI Impor Catatan Pasien</h2><span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">{division}</span><span className="text-xs text-slate-500">{formatIndonesianDate(date)}</span></div><p className="text-xs text-slate-500 truncate">AI memahami hubungan DPJP utama, RABER (rawat bersama), dan KONSUL.</p></div></div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {error && <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5"><AlertCircle className="w-4 h-4 shrink-0" /><div className="flex-1 font-medium">{error}</div></div>}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700"><b>Aturan klinis:</b> DPJP adalah dokter utama yang bertanggung jawab. RABER adalah dokter yang <b>rawat bersama</b> dengan DPJP, bukan DPJP utama. KONSUL adalah dokter yang dimintai konsultasi, bukan DPJP utama kecuali teks menyatakan demikian. <b>Spesialisasi tidak menentukan peran.</b> Contoh: DPJP dokter anak + RABER dr. Bedah Anak → dokter anak tetap DPJP utama, dr. Bedah Anak tetap RABER.</div>
        <div className="space-y-2"><div className="flex items-center justify-between gap-2 flex-wrap"><label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><FileText className="w-4 h-4 text-teal-600" />Tempel Catatan Teks Pasien:</label><div className="flex gap-1.5"><button type="button" onClick={handlePasteClipboard} className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold">Tempel</button><button type="button" onClick={() => { setInputText(sampleNote); setError(null); }} className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold">Contoh</button>{inputText && <button type="button" onClick={handleClear} className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold"><RotateCcw className="w-3.5 h-3.5 inline mr-1" />Bersihkan</button>}</div></div><textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Tempel catatan operan pasien di sini..." className="w-full min-h-52 rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" /><button type="button" onClick={handleRunAi} disabled={isLoading || !inputText.trim()} className="w-full min-h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"><AiSparkleIcon size={18} className="shrink-0" /><span>{isLoading ? 'Menganalisis...' : 'Analisis dengan AI'}</span></button></div>
        {hasParsed && <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-extrabold text-sm text-slate-900">Hasil ekstraksi — wajib verifikasi</h3><button type="button" onClick={addItem} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"><Plus className="w-3.5 h-3.5 inline mr-1" />Tambah</button></div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800"><b>Periksa struktur dokter:</b> untuk RABER/KONSUL, <b>Dokter Peran</b> = dokter bedah yang menjadi RABER/KONSUL; <b>DPJP Utama</b> = dokter yang bertanggung jawab utama (misalnya dokter anak).</div>
          {parsedList.map((p, index) => { const role = p.doctorRole; const needs = role === 'RABER' || role === 'KONSUL'; return <div key={index} className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex justify-between"><b className="text-sm">Pasien {index + 1}</b><button type="button" onClick={() => setParsedList((prev) => prev.filter((_, i) => i !== index))} className="text-red-500"><Trash2 className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{(['name','age','jk','rm','room','kamar','dpjp','dx'] as (keyof ParsedPatientRaw)[]).map((field) => <label key={field} className="text-xs font-semibold text-slate-600">{field === 'dpjp' ? 'DOKTER PERAN' : field.toUpperCase()}<input value={String(p[field] || '')} onChange={(e) => updateItem(index, field, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>)}</div>
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 space-y-2"><div className="text-[11px] font-extrabold text-teal-900">PERAN DOKTER</div><div className="grid grid-cols-3 gap-1.5">{ROLE_OPTIONS.map((o) => <button key={o.value} type="button" onClick={() => updateRole(index, o.value)} className={`rounded-lg px-2 py-2 text-xs font-bold border ${role === o.value ? 'bg-white border-teal-400 text-teal-700' : 'bg-white/50 border-slate-200 text-slate-500'}`}>{o.label}</button>)}</div>{!role && <p className="text-[10px] font-bold text-red-700">Peran belum dapat ditentukan dari teks. Pilih peran sebelum impor.</p>}{needs && <label className="block text-xs font-bold text-amber-900">DPJP UTAMA *<input value={p.supervisingDpjp || ''} onChange={(e) => updateItem(index, 'supervisingDpjp', e.target.value)} list={`ai-supervising-${index}`} placeholder="Contoh: dr. Ahmad Wisnu Wardhana, Sp.A" className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" /><datalist id={`ai-supervising-${index}`}>{[...new Set([...PEDIATRIC_CONSULTANTS, ...knownDpjps])].map((d) => <option key={d} value={d} />)}</datalist></label>}</div>
          </div>; })}
          <button type="button" onClick={handleConfirmImport} className="w-full min-h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm"><CheckCircle2 className="w-4 h-4 inline mr-2" />Impor {parsedList.length} Pasien ke Database</button>
        </div>}
      </div>
    </div>
  </div>;
}
