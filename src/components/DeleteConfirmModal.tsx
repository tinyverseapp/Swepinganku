import { Patient } from '../types';
import { formatKamarOrBed, isBedRoom } from '../data/constants';
import { Trash2, AlertTriangle, X, LogOut, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseDateSafely, formatDateIso } from '../utils/storage';

interface DeleteConfirmModalProps {
  patient: Patient | null;
  division: string;
  date: string;
  onClose: () => void;
  onConfirm: (patient: Patient) => void;
}

type DeleteAction = 'discharged' | 'permanent';

function safeId(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9_\-.:]/g, '_').substring(0, 40);
}

function getWeekStart(date: string): string {
  const d = parseDateSafely(date);
  if (Number.isNaN(d.getTime())) return date;
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return formatDateIso(d);
}

function rmKey(rm: string): string {
  const clean = String(rm || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean.replace(/^0+/, '') || clean;
}

/**
 * Permanent deletion removes both the daily record and its weekly-history
 * record in one atomic Firestore batch. This is deliberately kept inside the
 * confirmation UI so the existing discharge/delete flow remains unchanged.
 */
async function permanentlyDeleteFromFirestore(patient: Patient, date: string): Promise<void> {
  const teamCode = patient.teamCode || '';
  if (!teamCode) return;

  const effectiveDate = patient.date || date;
  const weekStart = getWeekStart(effectiveDate);
  const dailyId = `${safeId(teamCode)}_${safeId(effectiveDate)}_${safeId(patient.id)}`;
  const weeklyId = `__WEEKLY__${safeId(teamCode)}_${safeId(weekStart)}_${safeId(rmKey(patient.rm))}`;

  const batch = writeBatch(db);
  batch.delete(doc(db, 'sweepinganku', dailyId));
  if (patient.rm) {
    batch.delete(doc(db, 'sweepinganku', weeklyId));
  }
  await batch.commit();
}

export function DeleteConfirmModal({
  patient,
  division,
  date,
  onClose,
  onConfirm
}: DeleteConfirmModalProps) {
  const [pendingAction, setPendingAction] = useState<DeleteAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isProcessing]);

  useEffect(() => {
    setPendingAction(null);
    setIsProcessing(false);
    setErrorMessage(null);
  }, [patient]);

  if (!patient) return null;

  const formattedLocation = formatKamarOrBed(patient.room, patient.kamar);
  const isBed = isBedRoom(patient.room);

  const handleAction = async (action: DeleteAction) => {
    if (isProcessing) return;

    if (action === 'discharged') {
      // Existing behavior: App's normal delete flow records the occurrence in
      // weekly history before removing the daily patient record.
      onConfirm(patient);
      return;
    }

    if (pendingAction !== 'permanent') {
      setPendingAction('permanent');
      setErrorMessage(null);
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      // Remove the weekly occurrence first, atomically with the daily record.
      // After this succeeds, pass an empty RM to the existing delete handler so
      // it removes the already-deleted daily document without recreating history.
      await permanentlyDeleteFromFirestore(patient, date);
      onConfirm({ ...patient, rm: '' });
    } catch (error: any) {
      console.error('[Delete] permanent delete failed:', error);
      setErrorMessage(error?.message || 'Gagal menghapus permanen dari Firebase.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <h3 id="delete-dialog-title" className="text-base font-bold text-slate-900">
            Keluarkan Pasien dari Daftar?
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Pilih keterangan tindakan untuk pasien berikut pada Divisi <b>{division}</b>:
          </p>

          <div className="mt-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm text-slate-900">{patient.name}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  isBed
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-slate-200/80 text-slate-700 border-slate-300'
                }`}
              >
                {formattedLocation}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                RM: {patient.rm}
              </span>
              <span>·</span>
              <span>DPJP: {patient.dpjp}</span>
            </div>
            {patient.dx && (
              <p className="text-[11px] text-slate-500 line-clamp-2 pt-1 border-t border-slate-200/60">
                Dx: {patient.dx}
              </p>
            )}
          </div>

          {pendingAction === 'permanent' ? (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2 text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold">Hapus permanen?</p>
                  <p className="mt-0.5 leading-relaxed">
                    Data harian <b>dan riwayat rekapan minggu ini</b> akan dihapus. Gunakan ini hanya jika pasien memang salah input.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <b>Pasien Pulang</b> → pasien dihapus dari daftar hari ini, tetapi tetap masuk rekapan mingguan.
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-2 mt-5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="sm:flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 transition-colors cursor-pointer text-center min-h-[42px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => handleAction('discharged')}
            disabled={isProcessing}
            className="sm:flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm transition-all cursor-pointer min-h-[42px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4" />
            <span>Pasien Pulang</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction('permanent')}
            disabled={isProcessing}
            className="sm:flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm transition-all cursor-pointer min-h-[42px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>{pendingAction === 'permanent' ? 'Ya, Hapus Permanen' : 'Hapus Permanen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
