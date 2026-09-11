import React from 'react';
import { Settings, X, KeyRound, ArrowRight } from 'lucide-react';
import { DivisionTeam } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTeam?: DivisionTeam;
  onOpenTeamModal?: () => void;
}

export function SettingsModal({ isOpen, onClose, activeTeam, onOpenTeamModal }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center"><Settings className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-base text-slate-900">Pengaturan</h3><p className="text-xs text-slate-500">Pengaturan tim</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer" aria-label="Tutup Pengaturan"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {activeTeam?.teamCode && <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Tim aktif</div><div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">{activeTeam.teamName || activeTeam.division}</div><div className="text-[11px] text-slate-500 font-mono mt-0.5">PIN: <b className="text-blue-700">{activeTeam.teamCode}</b></div></div>
            {onOpenTeamModal && <button type="button" onClick={() => { onClose(); onOpenTeamModal(); }} className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer flex items-center gap-1 shrink-0">Ganti Tim <ArrowRight className="w-3 h-3" /></button>}
          </div>}

          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-3 text-xs text-blue-800"><div className="font-bold mb-1 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />Mode tampilan</div><div>Mode Ringkas ditetapkan permanen agar daftar pasien tetap padat dan nyaman digunakan di layar desktop maupun mobile.</div></div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex justify-end"><button type="button" onClick={onClose} className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer">Selesai</button></div>
      </div>
    </div>
  );
}
