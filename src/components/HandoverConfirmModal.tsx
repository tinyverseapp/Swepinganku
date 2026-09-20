import { useEffect, useState, useMemo } from 'react';
import { GitPullRequest, ArrowRight, Calendar, Users, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatIndonesianDate, shiftDateByDays, loadPatients, hasPodInDiagnosis } from '../utils/storage';

interface HandoverConfirmModalProps {
  isOpen: boolean;
  date: string;
  division: string;
  teamCode?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function HandoverConfirmModal({
  isOpen,
  date,
  division,
  teamCode,
  onClose,
  onConfirm
}: HandoverConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  const yesterdayDate = useMemo(() => shiftDateByDays(date, -1), [date]);

  const yesterdayFormatted = useMemo(() => {
    return formatIndonesianDate(yesterdayDate, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [yesterdayDate]);

  const targetFormatted = useMemo(() => {
    return formatIndonesianDate(date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [date]);

  const yesterdayPatients = useMemo(() => {
    if (!isOpen) return [];
    return loadPatients(yesterdayDate, division, teamCode);
  }, [isOpen, yesterdayDate, division, teamCode]);

  const currentPatients = useMemo(() => {
    if (!isOpen) return [];
    return loadPatients(date, division, teamCode);
  }, [isOpen, date, division, teamCode]);

  const stats = useMemo(() => {
    const currentRms = new Set(
      currentPatients.map((p) => (p.rm || '').trim().toLowerCase()).filter(Boolean)
    );
    const newCount = yesterdayPatients.filter((p) => {
      const rm = (p.rm || '').trim().toLowerCase();
      return !rm || !currentRms.has(rm);
    }).length;
    const existingCount = yesterdayPatients.length - newCount;
    const podCount = yesterdayPatients.filter((p) => {
      const rm = (p.rm || '').trim().toLowerCase();
      const isNew = !rm || !currentRms.has(rm);
      return isNew && hasPodInDiagnosis(p.dx);
    }).length;
    return {
      totalYesterday: yesterdayPatients.length,
      newCount,
      existingCount,
      podCount
    };
  }, [yesterdayPatients, currentPatients]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handover-dialog-title"
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
            <GitPullRequest className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <h3
            id="handover-dialog-title"
            className="text-base font-bold text-slate-900"
          >
            Konfirmasi Operan Pasien Kemarin
          </h3>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin menarik dan mengoper daftar pasien aktif dari hari kemarin ke tanggal sweeping hari ini?
          </p>
        </div>

        {/* Info Alur Tanggal Operan */}
        <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Dari (Kemarin)
              </span>
              <span className="font-semibold text-slate-800 block truncate" title={yesterdayFormatted}>
                {yesterdayFormatted}
              </span>
            </div>
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Ke (Hari Ini)
              </span>
              <span className="font-semibold text-teal-700 block truncate" title={targetFormatted}>
                {targetFormatted}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Divisi: <strong className="text-slate-700">{division}</strong></span>
            {teamCode && <span>PIN: <strong className="font-mono text-slate-700">{teamCode}</strong></span>}
          </div>
        </div>

        {/* Status Pasien Kemarin */}
        <div className="mt-3.5 p-3 rounded-xl border text-xs">
          {stats.totalYesterday === 0 ? (
            <div className="flex items-start gap-2 text-amber-700 bg-amber-50/50 p-1 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Tidak ditemukan pasien terdata pada hari kemarin. Operan tetap bisa dijalankan namun tidak ada pasien baru yang ditambahkan.
              </span>
            </div>
          ) : stats.newCount === 0 ? (
            <div className="flex items-start gap-2 text-teal-700 bg-teal-50/60 p-1 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
              <span>
                Semua <strong>{stats.totalYesterday} pasien</strong> dari kemarin sudah tercatat pada hari ini. Tidak ada pasien duplikat yang ditambahkan.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-slate-700">
              <Users className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
              <div>
                <span>
                  Ditemukan <strong>{stats.totalYesterday} pasien</strong> kemarin. Sebanyak{' '}
                  <strong className="text-teal-700 font-bold">{stats.newCount} pasien baru</strong> akan ditambahkan ke hari ini.
                </span>
                {stats.existingCount > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    ({stats.existingCount} pasien lainnya sudah ada di hari ini dan tidak diduplikasi).
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {stats.podCount > 0 && (
          <div className="mt-3 p-3 bg-indigo-50/90 border border-indigo-200/80 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900 leading-relaxed shadow-2xs">
            <span className="text-base leading-none shrink-0 mt-0.5">⚡</span>
            <div>
              <p className="font-bold text-indigo-950">Otomatis Update POD (Post Operative Day)</p>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                Ditemukan <strong>{stats.podCount} pasien</strong> dengan catatan POD. Nilai hari operasi akan otomatis bertambah <strong>+1 hari</strong> saat disalin ke hari ini (misal: POD 1 → POD 2).
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[38px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Memproses Operan...</span>
              </>
            ) : (
              <>
                <GitPullRequest className="w-4 h-4 shrink-0" />
                <span>Ya, Oper Pasien</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
