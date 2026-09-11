import React, { useState } from 'react';
import {
  Sparkles,
  X,
  ClipboardPaste,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  FileText,
  User,
  Building2,
  Stethoscope,
  Activity,
  RotateCcw
} from 'lucide-react';
import { Patient } from '../types';
import { parsePatientsWithAi, ParsedPatientRaw } from '../lib/aiService';
import { MASTER_ROOMS } from '../data/constants';
import { formatIndonesianDate } from '../utils/storage';

interface AiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  division: string;
  date: string;
  teamCode?: string;
  knownRooms?: string[];
  knownDpjps?: string[];
  existingPatients?: Patient[];
  onImportPatients: (newPatients: Patient[]) => void;
}

export function AiImportModal({
  isOpen,
  onClose,
  division,
  date,
  teamCode,
  knownRooms = MASTER_ROOMS,
  knownDpjps = [],
  existingPatients = [],
  onImportPatients,
}: AiImportModalProps) {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedList, setParsedList] = useState<ParsedPatientRaw[]>([]);
  const [hasParsed, setHasParsed] = useState(false);

  if (!isOpen) return null;

  const sampleNote = `Operan Pasien Stase Sebelumnya:

1. Tn. Sutrisno (L / 54 th) RM: 01-88-29
Ruang Melati Bed 3
DPJP: ${knownDpjps[0] || 'dr. Bambang, Sp.B(K)BD'}
Dx: Cholelithiasis simptomatik

2. Ny. Siti Aminah, 38 th, P, No RM 02-33-41
Bangsal Bougenville kamar 2A
Konsulen: ${knownDpjps[1] || 'dr. Ahmad Toboroni Nasution, Sp. B(K)BD'}
Diagnosis: Appendisitis Akut

3. An. Rafa (L / 5 th) RM: 020918
Ruang Dahlia Bed 4B
DPJP: ${knownDpjps[0] || 'dr. Konsulen'}
Dx: Hernia Inguinalis Lateralis Dextra`;

  const handleLoadSample = () => {
    setInputText(sampleNote);
    setError(null);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        setError(null);
      }
    } catch {
      setError('Izin akses clipboard ditolak oleh browser. Silakan tempel (Ctrl+V) langsung ke kolom teks.');
    }
  };

  const handleClear = () => {
    setInputText('');
    setParsedList([]);
    setHasParsed(false);
    setError(null);
  };

  const handleRunAi = async () => {
    if (!inputText.trim()) {
      setError('Silakan masukkan atau tempel catatan pasien terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await parsePatientsWithAi(inputText, division, knownRooms, knownDpjps);
      if (!results || results.length === 0) {
        setError('AI tidak mendeteksi data pasien pada teks yang diberikan. Pastikan teks memuat nama pasien dan informasi klinis.');
        setParsedList([]);
      } else {
        setParsedList(results);
        setHasParsed(true);
      }
    } catch (err: any) {
      console.error('AI Parse error:', err);
      setError(err?.message || 'Gagal memproses catatan dengan AI. Pastikan server aktif dan kunci Gemini terpasang.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateItem = (index: number, field: keyof ParsedPatientRaw, value: string) => {
    setParsedList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setParsedList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddNewItem = () => {
    const newItem: ParsedPatientRaw = {
      name: '',
      age: '',
      jk: 'L',
      rm: '',
      room: knownRooms[0] || 'Bougenville',
      kamar: '',
      dpjp: knownDpjps[0] || '',
      dx: '',
    };
    setParsedList((prev) => [...prev, newItem]);
  };

  const handleConfirmImport = () => {
    if (parsedList.length === 0) return;

    const timestamp = new Date().toISOString();
    const formattedDate = date;

    const newPatients: Patient[] = parsedList
      .filter((p) => p.name.trim().length > 0)
      .map((p, idx) => ({
        id: `pt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        name: p.name.trim(),
        age: p.age.trim(),
        jk: p.jk === 'P' ? 'P' : 'L',
        rm: p.rm.trim(),
        room: p.room.trim() || 'Ruangan',
        kamar: p.kamar.trim() || '-',
        dpjp: p.dpjp.trim() || (knownDpjps[0] || 'Dokter DPJP'),
        dx: p.dx.trim(),
        updatedAt: timestamp,
        teamCode: teamCode || '',
        date: formattedDate,
        division: division,
      }));

    if (newPatients.length === 0) {
      setError('Semua pasien harus memiliki nama yang valid.');
      return;
    }

    onImportPatients(newPatients);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                  AI Impor Catatan Pasien
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {division}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {formatIndonesianDate(date)}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                Ekstrak catatan operan stase atau teks bebas ke database pasien otomatis dengan AI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Tempel Catatan Teks Pasien:</span>
              </label>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-slate-600" />
                  <span>Tempel</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Contoh Catatan</span>
                </button>
                {inputText && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Bersihkan</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Tempel catatan operan atau teks pasien di sini...\n\nContoh:\n1. Tn. Budi (L/45 th) RM: 01-22-33\nR. Bougenville Bed 2\nDPJP: ${knownDpjps[0] || 'dr. Konsulen'}\nDx: Appendisitis Akut`}
                rows={hasParsed ? 4 : 8}
                className="w-full rounded-xl border border-slate-300 p-3.5 text-xs sm:text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white bg-slate-50 outline-none transition-all resize-y"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>Format output database: <b>Nama, Usia, Jenis Kelamin (L/P), No RM, Ruangan, Kamar, DPJP, dan Diagnosis kerja</b>.</span>
              <span>{inputText.length} karakter</span>
            </div>
          </div>

          {/* AI Trigger Button */}
          <div className="flex justify-center pt-1 pb-2">
            <button
              type="button"
              onClick={handleRunAi}
              disabled={isLoading || !inputText.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className={`w-4 h-4 text-amber-300 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Sedang Memproses dengan Gemini AI...' : 'Ekstrak Pasien dengan AI'}</span>
            </button>
          </div>

          {/* Parsed Result Preview */}
          {hasParsed && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                    Pratinjau Data Pasien ({parsedList.length} Terdeteksi)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </div>

              {parsedList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                  Belum ada pasien yang siap diimpor.
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {parsedList.map((p, index) => (
                    <div
                      key={index}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700">Pasien #{index + 1}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          title="Hapus pasien ini dari daftar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                        {/* Nama */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Nama Pasien *
                          </label>
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                            placeholder="Contoh: Tn. Sutrisno"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
                          />
                        </div>

                        {/* Gender */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Jenis Kelamin *
                          </label>
                          <select
                            value={p.jk}
                            onChange={(e) => handleUpdateItem(index, 'jk', e.target.value as 'L' | 'P')}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-none cursor-pointer"
                          >
                            <option value="L">L (Laki-laki)</option>
                            <option value="P">P (Perempuan)</option>
                          </select>
                        </div>

                        {/* Usia */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Usia
                          </label>
                          <input
                            type="text"
                            value={p.age}
                            onChange={(e) => handleUpdateItem(index, 'age', e.target.value)}
                            placeholder="Contoh: 45 th"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                          />
                        </div>

                        {/* No RM */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            No. RM
                          </label>
                          <input
                            type="text"
                            value={p.rm}
                            onChange={(e) => handleUpdateItem(index, 'rm', e.target.value)}
                            placeholder="Contoh: 01-88-29"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                          />
                        </div>

                        {/* Ruangan */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Ruangan / Bangsal
                          </label>
                          <input
                            type="text"
                            list={`rooms-list-${index}`}
                            value={p.room}
                            onChange={(e) => handleUpdateItem(index, 'room', e.target.value)}
                            placeholder="Pilih / ketik ruangan"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                          />
                          <datalist id={`rooms-list-${index}`}>
                            {knownRooms.map((r) => (
                              <option key={r} value={r} />
                            ))}
                          </datalist>
                        </div>

                        {/* Kamar / Bed */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Kamar / Bed
                          </label>
                          <input
                            type="text"
                            value={p.kamar}
                            onChange={(e) => handleUpdateItem(index, 'kamar', e.target.value)}
                            placeholder="Contoh: Bed 3 / 2A"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                          />
                        </div>

                        {/* DPJP */}
                        <div className="sm:col-span-2 md:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Dokter DPJP
                          </label>
                          <input
                            type="text"
                            list={`dpjp-list-${index}`}
                            value={p.dpjp}
                            onChange={(e) => handleUpdateItem(index, 'dpjp', e.target.value)}
                            placeholder="Nama dokter DPJP"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                          />
                          <datalist id={`dpjp-list-${index}`}>
                            {knownDpjps.map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </div>

                        {/* Diagnosis */}
                        <div className="sm:col-span-2 md:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                            <span>Diagnosis Kerja / Klinis *</span>
                            <span className="text-[10px] text-slate-400 font-normal">Hanya diagnosis utama</span>
                          </label>
                          <input
                            type="text"
                            value={p.dx}
                            onChange={(e) => handleUpdateItem(index, 'dx', e.target.value)}
                            placeholder="Contoh: Appendisitis Akut, Cholelithiasis simptomatik"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:bg-white focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            {hasParsed && parsedList.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Simpan {parsedList.length} Pasien ke Database</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
