import React, { useState } from 'react';
import { LogOut, AlertTriangle, X, RefreshCw, KeyRound, ShieldAlert } from 'lucide-react';
import { DivisionTeam } from '../types';
import { useDivisionColors } from '../utils/divisionColors';

interface LeaveTeamModalProps {
  isOpen: boolean;
  team: DivisionTeam | null;
  userName?: string;
  onClose: () => void;
  onConfirmLeave: (teamCode: string) => Promise<void> | void;
}

export function LeaveTeamModal({
  isOpen,
  team,
  userName,
  onClose,
  onConfirmLeave,
}: LeaveTeamModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { activeTheme } = useDivisionColors(team?.division);

  if (!isOpen || !team) return null;

  const handleConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirmLeave(team.teamCode);
      onClose();
    } catch (err: any) {
      console.error('[LeaveTeamModal] Gagal keluar tim:', err);
      setError(err?.message || 'Terjadi kesalahan saat keluar dari tim. Silakan coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-team-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <LogOut className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 id="leave-team-modal-title" className="font-extrabold text-base text-rose-950">
                Keluar dari Tim
              </h3>
              <p className="text-xs text-rose-700 font-medium">Konfirmasi pelepasan keanggotaan tim</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Target Team Card */}
          <div className={`p-3.5 rounded-xl border ${activeTheme.bannerBg} space-y-2`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border ${activeTheme.badge}`}>
                {team.division || 'Stase'}
              </span>
              <span className="font-mono text-xs font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-slate-500" />
                PIN: {team.teamCode}
              </span>
            </div>
            <div className="font-extrabold text-sm text-slate-900">
              {team.teamName || `Tim ${team.division}`}
            </div>
            {team.weekStart && (
              <div className="text-[11px] text-slate-500">
                Pekan Aktif: {team.weekStart} s/d {team.weekEnd}
              </div>
            )}
          </div>

          {/* Explanation Notes */}
          <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                Akun Anda <strong>{userName ? `(${userName})` : ''}</strong> akan dihapus dari daftar anggota tim ini.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5 ml-1.5" />
              <div>
                <strong>Data pasien tim tetap aman</strong> dan tersimpan untuk rekan koas lainnya di tim ini.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0 mt-1.5 ml-1.5" />
              <div>
                Anda dapat bergabung kembali kapan saja menggunakan PIN <strong>{team.teamCode}</strong>.
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[38px]"
          >
            {busy ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <LogOut className="w-3.5 h-3.5" />
                <span>Ya, Keluar dari Tim</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
