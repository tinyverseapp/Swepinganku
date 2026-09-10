import React from 'react';
import { Settings, X, Minimize2, Maximize2, KeyRound, Check, Sparkles, ArrowRight } from 'lucide-react';
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

export function SettingsModal({ isOpen, onClose, compactMode, onToggleCompactMode, activeTeam, onOpenTeamModal }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center"><Settings className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-base text-slate-900">Pengaturan</h3><p className="text-xs text-slate-500">Preferensi tampilan aplikasi &amp; tim</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer" aria-label="Tutup Pengaturan"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1"><div className="flex items-center gap-2"><span className="font-bold text-sm text-slate-900">Mode Ringkas</span><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${compactMode ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-700'}`}>{compactMode ? 'Aktif' : 'Nonaktif'}</span></div><p className="text-xs text-slate-600 leading-relaxed">Kurangi padding dan ukuran kartu pasien agar lebih banyak data terlihat sekaligus.</p></div>
              <button type="button" role="switch" aria-checked={compactMode} onClick={onToggleCompactMode} className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${compactMode ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform flex items-center justify-center ${compactMode ? 'translate-x-5 text-blue-600' : 'translate-x-0 text-slate-400'}`}>{compactMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</span></button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
              <button type="button" onClick={() => compactMode && onToggleCompactMode()} className={`p-2.5 rounded-lg border text-left cursor-pointer ${!compactMode ? 'bg-white border-blue-500 shadow-2xs' : 'bg-white/60 border-slate-200 opacity-60'}`}><div className="flex items-center justify-between mb-1"><span className="font-bold text-[11px] text-slate-800">Standar</span>{!compactMode && <Check className="w-3.5 h-3.5 text-blue-600" />}</div><div className="text-[10.5px] text-slate-500">Tampilan lebih lega dan nyaman dibaca.</div></button>
              <button type="button" onClick={() => !compactMode && onToggleCompactMode()} className={`p-2.5 rounded-lg border text-left cursor-pointer ${compactMode ? 'bg-white border-blue-500 shadow-2xs' : 'bg-white/60 border-slate-200 opacity-60'}`}><div className="flex items-center justify-between mb-1"><span className="font-bold text-[11px] text-blue-700 flex items-center gap-1"><Sparkles className="w-3 h-3" />Ringkas</span>{compactMode && <Check className="w-3.5 h-3.5 text-blue-600" />}</div><div className="text-[10.5px] text-slate-500">Lebih banyak pasien terlihat dalam satu layar.</div></button>
            </div>
          </div>

          {activeTeam?.teamCode && <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Tim aktif</div><div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">{activeTeam.teamName || activeTeam.division}</div><div className="text-[11px] text-slate-500 font-mono mt-0.5">PIN: <b className="text-blue-700">{activeTeam.teamCode}</b></div></div>
            {onOpenTeamModal && <button type="button" onClick={() => { onClose(); onOpenTeamModal(); }} className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer flex items-center gap-1 shrink-0">Ganti Tim <ArrowRight className="w-3 h-3" /></button>}
          </div>}

          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-3 text-xs text-blue-800"><div className="font-bold mb-1 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />Profil akun</div><div>Nama akun dan foto profil sekarang dikelola sepenuhnya melalui menu <b>Profil</b> di Topbar.</div></div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex justify-end"><button type="button" onClick={onClose} className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer">Selesai</button></div>
      </div>
    </div>
  );
}
