import React from 'react';
import {
  Settings,
  X,
  Minimize2,
  Maximize2,
  UserCheck,
  KeyRound,
  Check,
  Smartphone,
  Monitor,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { DivisionTeam } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  compactMode: boolean;
  onToggleCompactMode: () => void;
  koasName: string;
  onUpdateKoasName: (name: string) => void;
  activeTeam?: DivisionTeam;
  onOpenTeamModal?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  compactMode,
  onToggleCompactMode,
  koasName,
  onUpdateKoasName,
  activeTeam,
  onOpenTeamModal
}: SettingsModalProps) {
  const [tempKoasName, setTempKoasName] = React.useState(koasName);
  const [savedNameSuccess, setSavedNameSuccess] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setTempKoasName(koasName);
      setSavedNameSuccess(false);
    }
  }, [isOpen, koasName]);

  if (!isOpen) return null;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempKoasName.trim()) {
      onUpdateKoasName(tempKoasName.trim());
      setSavedNameSuccess(true);
      setTimeout(() => setSavedNameSuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 id="settings-modal-title" className="font-bold text-base text-slate-900">
                Pengaturan
              </h3>
              <p className="text-xs text-slate-500">
                Preferensi tampilan kartu pasien &amp; profil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            aria-label="Tutup Pengaturan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-700">
          {/* 1. Compact Mode Setting Section */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    Mode Ringkas (Compact Mode)
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                      compactMode
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {compactMode ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mengurangi padding dan ukuran font kartu pasien agar lebih banyak pasien dapat terlihat di layar sekaligus tanpa harus banyak scroll.
                </p>
              </div>

              {/* iOS-style toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={compactMode}
                onClick={onToggleCompactMode}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                  compactMode ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span className="sr-only">Toggle Compact Mode</span>
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                    compactMode ? 'translate-x-5 text-blue-600' : 'translate-x-0 text-slate-400'
                  }`}
                >
                  {compactMode ? (
                    <Minimize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                </span>
              </button>
            </div>

            {/* Visual comparison hint */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div
                onClick={() => {
                  if (compactMode) onToggleCompactMode();
                }}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  !compactMode
                    ? 'bg-white border-blue-500 shadow-2xs ring-1 ring-blue-500/20'
                    : 'bg-white/60 border-slate-200 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] text-slate-800">Standar</span>
                  {!compactMode && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="text-[10.5px] text-slate-500">
                  Padding luas (16px), font normal, sangat nyaman untuk membaca satu per satu.
                </div>
              </div>

              <div
                onClick={() => {
                  if (!compactMode) onToggleCompactMode();
                }}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  compactMode
                    ? 'bg-white border-blue-500 shadow-2xs ring-1 ring-blue-500/20'
                    : 'bg-white/60 border-slate-200 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] text-blue-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    Ringkas
                  </span>
                  {compactMode && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="text-[10.5px] text-slate-500">
                  Padding ramping (10px), font padat, memuat hingga 4–6 pasien per pandangan layar.
                </div>
              </div>
            </div>
          </div>

          {/* 2. Koas Name Settings */}
          <form onSubmit={handleSaveName} className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Nama Koas / Residen (Pengirim Laporan WA)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tempKoasName}
                onChange={(e) => setTempKoasName(e.target.value)}
                placeholder="Contoh: dr. Muda Budi"
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1"
              >
                {savedNameSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Tersimpan</span>
                  </>
                ) : (
                  <span>Simpan</span>
                )}
              </button>
            </div>
          </form>

          {/* 3. Team & PIN Info */}
          {activeTeam && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {activeTeam.teamName || activeTeam.division}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Kode PIN: <b className="text-blue-700">{activeTeam.teamCode}</b>
                  </div>
                </div>
              </div>
              {onOpenTeamModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTeamModal();
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                >
                  <span>Ganti Tim</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
