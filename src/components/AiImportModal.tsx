import React, { useState } from 'react';
import { Sparkles, X, ClipboardPaste, Trash2, CheckCircle2, AlertCircle, Plus, ArrowRight, FileText, User, Building2, Stethoscope, Activity, RotateCcw } from 'lucide-react';
import { Patient } from '../types';
import { parsePatientsWithAi, ParsedPatientRaw } from '../lib/aiService';
import { MASTER_ROOMS, normalizeRoomName } from '../data/constants';
import { formatIndonesianDate } from '../utils/storage';

interface AiImportModalProps { isOpen: boolean; onClose: () => void; division: string; date: string; teamCode?: string; knownRooms?: string[]; knownDpjps?: string[]; existingPatients?: Patient[]; onImportPatients: (newPatients: Patient[]) => void; }

export function AiImportModal({ isOpen, onClose, division, date, teamCode, knownRooms = MASTER_ROOMS, knownDpjps = [], existingPatients = [], onImportPatients }: AiImportModalProps) {
  const [inputText, setInputText] = useState(''); const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [parsedList, setParsedList] = useState<ParsedPatientRaw[]>([]); const [hasParsed, setHasParsed] = useState(false);
  if (!isOpen) return null;

  const sampleNote = `Operan Pasien Stase Sebelumnya:\n\n1. Tn. Sutrisno (L / 54 th) RM: 01-88-29\nRuang Melati Bed 3\nDPJP: ${knownDpjps[0] || 'dr. Bambang, Sp.B(K)BD'}\nDx: Cholelithiasis simptomatik\n\n2. Ny. Siti Aminah, 38 th, P, No RM 02-33-41\nBangsal Teratai kamar 2A\nKonsulen: ${knownDpjps[1] || 'dr. Ahmad Toboroni Nasution, Sp. B(K)BD'}\nDiagnosis: Appendisitis Akut\n\n3. An. Rafa (L / 5 th) RM: 020918\nRuang Dahlia Bed 4B\nDPJP: ${knownDpjps[0] || 'dr. Konsulen'}\nDx: Hernia Inguinalis Lateralis Dextra`;
  const handleLoadSample = () => { setInputText(sampleNote); setError(null); };
  const handlePasteClipboard = async () => { try { const text = await navigator.clipboard.readText(); if (text) { setInputText(text); setError(null); } } catch { setError('Izin akses clipboard ditolak oleh browser. Silakan tempel (Ctrl+V) langsung ke kolom teks.'); } };
  const handleClear = () => { setInputText(''); setParsedList([]); setHasParsed(false); setError(null); };
  const handleRunAi = async () => { if (!inputText.trim()) { setError('Silakan masukkan atau tempel catatan pasien terlebih dahulu.'); return; } setIsLoading(true); setError(null); try { const results = await parsePatientsWithAi(inputText, division, knownRooms, knownDpjps); if (!results?.length) { setError('AI tidak mendeteksi data pasien pada teks yang diberikan.'); setParsedList([]); } else { setParsedList(results); setHasParsed(true); } } catch (err: any) { console.error('AI Parse error:', err); setError(err?.message || 'Gagal memproses catatan dengan AI.'); } finally { setIsLoading(false); } };
  const handleUpdateItem = (index: number, field: keyof ParsedPatientRaw, value: string) => setParsedList((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const handleRemoveItem = (index: number) => setParsedList((prev) => prev.filter((_, i) => i !== index));
  const handleAddNewItem = () => setParsedList((prev) => [...prev, { name: '', age: '', jk: '', rm: '', room: '', kamar: '', dpjp: '', dx: '' }]);

  const handleConfirmImport = () => {
    if (!parsedList.length) return;
    const timestamp = new Date().toISOString();
    const newPatients: Patient[] = parsedList.filter((p) => p.name.trim()).map((p, idx) => ({
      id: `pt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      name: p.name.trim(), age: p.age.trim(), jk: p.jk === 'P' || p.jk === 'L' ? p.jk : '', rm: p.rm.trim(),
      room: normalizeRoomName(p.room) || '', kamar: p.kamar.trim(), dpjp: p.dpjp.trim(), dx: p.dx.trim(), updatedAt: timestamp,
      teamCode: teamCode || '', date, division
    }));
    if (!newPatients.length) { setError('Semua pasien harus memiliki nama yang valid.'); return; }
    onImportPatients(newPatients); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60"><div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0"><Sparkles className="w-5 h-5 text-amber-300 animate-pulse" /></div><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">AI Impor Catatan Pasien</h2><span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">{division}</span><span className="text-xs text-slate-500 font-medium">{formatIndonesianDate(date)}</span></div><p className="text-xs text-slate-500 truncate mt-0.5">Ekstrak catatan operan stase atau teks bebas ke database pasien otomatis dengan AI</p></div></div><button type="button" onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"><X className="w-5 h-5" /></button></div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><div className="flex-1 font-medium">{error}</div></div>}
          <div className="space-y-2"><div className="flex items-center justify-between gap-2 flex-wrap"><label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><FileText className="w-4 h-4 text-blue-600" />Tempel Catatan Teks Pasien:</label><div className="flex items-center gap-1.5 text-xs"><button type="button" onClick={handlePasteClipboard} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1"><ClipboardPaste className="w-3.5 h-3.5" />Tempel</button><button type="button" onClick={handleLoadSample} className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />Contoh Catatan</button>{inputText && <button type="button" onClick={handleClear} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-semibold flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />Bersihkan</button>}</div></div><textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Tempel catatan operan pasien di sini..." className="w-full min-h-52 rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" /><button type="button" onClick={handleRunAi} disabled={isLoading || !inputText.trim()} className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" />{isLoading ? 'Menganalisis...' : 'Analisis dengan AI'}</button></div>
          {hasParsed && <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-extrabold text-sm text-slate-900">Hasil ekstraksi — wajib verifikasi sebelum impor</h3><button type="button" onClick={handleAddNewItem} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Tambah</button></div><div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800"><b>Catatan:</b> AI hanya mengekstrak informasi dari teks. Field yang tidak jelas dibiarkan kosong dan tidak boleh dianggap sebagai fakta klinis. Periksa kembali terutama diagnosis, jenis kelamin, ruangan, DPJP, dan No. RM.</div>{parsedList.map((p, index) => <div key={index} className="rounded-2xl border border-slate-200 p-4 space-y-3"><div className="flex justify-between gap-2"><div className="font-bold text-sm">Pasien {index + 1}</div><button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500"><Trash2 className="w-4 h-4" /></button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{(['name','age','jk','rm','room','kamar','dpjp','dx'] as (keyof ParsedPatientRaw)[]).map((field) => <label key={field} className="text-xs font-semibold text-slate-600">{field.toUpperCase()}<input value={p[field] || ''} onChange={(e) => handleUpdateItem(index, field, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>)}</div></div>)}<button type="button" onClick={handleConfirmImport} className="w-full min-h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" />Impor {parsedList.length} Pasien ke Database</button></div>}
        </div>
      </div>
    </div>
  );
}
