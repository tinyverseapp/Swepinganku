import { useEffect, useState } from 'react';
import { CalendarDays, ArrowRight, X, MoveRight } from 'lucide-react';
import { Patient } from '../types';
import { formatIndonesianDate, today } from '../utils/storage';

interface MovePatientModalProps {
  patient: Patient | null;
  currentDate: string;
  onClose: () => void;
  onConfirm: (targetDate: string) => void;
}

export function MovePatientModal({ patient, currentDate, onClose, onConfirm }: MovePatientModalProps) {
  const [targetDate, setTargetDate] = useState(currentDate || today());

  useEffect(() => {
    if (patient) setTargetDate(currentDate || today());
  }, [patient, currentDate]);

  if (!patient) return null;

  const sameDate = targetDate === currentDate;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900">Pindahkan Pasien</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate" title={patient.name}>{patient.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">Dari</label>
              <div className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                {formatIndonesianDate(currentDate)}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 mb-3" />
            <div>
              <label htmlFor="move-patient-date" className="block text-[11px] font-bold text-slate-500 mb-1.5">Ke tanggal</label>
              <input
                id="move-patient-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-teal-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 text-xs text-teal-900 leading-relaxed">
            Data pasien akan dihapus dari tanggal asal dan dipindahkan ke tanggal yang dipilih. Perubahan juga akan disinkronkan ke anggota tim melalui Firebase.
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            disabled={sameDate}
            onClick={() => onConfirm(targetDate)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-bold shadow-sm disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <MoveRight className="w-4 h-4" />
            Pindahkan Pasien
          </button>
        </div>
      </div>
    </div>
  );
}
