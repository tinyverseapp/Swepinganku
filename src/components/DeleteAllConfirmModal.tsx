import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { formatIndonesianDate } from '../utils/storage';

interface DeleteAllConfirmModalProps {
  target: {
    date: string;
    dayName?: string;
    count: number;
  } | null;
  division: string;
  onClose: () => void;
  onConfirm: (date: string) => Promise<void> | void;
}

export function DeleteAllConfirmModal({
  target,
  division,
  onClose,
  onConfirm,
}: DeleteAllConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, loading]);

  if (!target) return null;

  const formattedDate = formatIndonesianDate(target.date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleConfirmClick = async () => {
    setLoading(true);
    try {
      await onConfirm(target.date);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-all-dialog-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-xs">
            <Trash2 className="w-6 h-6" />
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
          <h3 id="delete-all-dialog-title" className="text-lg font-bold text-slate-900">
            Hapus Semua Pasien di Hari Ini?
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            Anda akan menghapus seluruh daftar pasien pada divisi <b>{division}</b> untuk tanggal:
          </p>

          <div className="mt-3 p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
            <div className="flex items-center justify-between text-xs font-bold text-rose-950">
              <span>{formattedDate}</span>
              <span className="px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900 font-extrabold text-[11px]">
                {target.count} Pasien
              </span>
            </div>
            <div className="mt-2 flex items-start gap-2 text-[11px] text-rose-700 leading-normal">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>
                Tindakan ini akan mengosongkan data pasien pada hari tersebut dan langsung tersinkronisasi ke seluruh anggota tim.
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[38px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Ya, Hapus Semua ({target.count})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
