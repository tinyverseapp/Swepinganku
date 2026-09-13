import { Patient } from '../types';
import { isBedRoom, formatKamarOrBed } from '../data/constants';
import { Edit2, Trash2, Stethoscope, Share2, CalendarDays, Building2 } from 'lucide-react';

interface PatientCardProps {
  key?: string;
  patient: Patient;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePresence?: (patient: Patient) => void;
  onQuickShare?: () => void;
  onMove?: () => void;
  isCompact?: boolean;
}

export function PatientCard({ patient, onEdit, onDelete, onTogglePresence, onQuickShare, onMove, isCompact = false }: PatientCardProps) {
  const isMale = patient.jk === 'L';
  const isBed = isBedRoom(patient.room);
  const formattedLocation = formatKamarOrBed(patient.room, patient.kamar);
  const doctorRole = patient.doctorRole || 'DPJP';
  const roleLabel = doctorRole === 'RABER' ? 'Raber' : doctorRole === 'KONSUL' ? 'Konsul' : 'DPJP';
  const isMarkedPulang = patient.presenceStatus === 'pulang';

  return (
    <div className={`bg-white rounded-xl shadow-xs transition-all flex flex-col justify-between ${
      isMarkedPulang
        ? 'border-2 border-amber-300 ring-1 ring-amber-200/70 bg-amber-50/15'
        : 'border border-slate-200 hover:border-slate-300'
    } ${isCompact ? 'p-2.5 sm:p-3 space-y-2' : 'p-4'}`}>
      <div>
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className={`font-bold text-slate-900 leading-snug truncate ${isCompact ? 'text-xs sm:text-[13px]' : 'text-sm'}`} title={patient.name}>{patient.name}</h4>
              {isMarkedPulang && (
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                  Tanda Pulang
                </span>
              )}
            </div>
            <div className={`flex flex-wrap items-center gap-1.5 ${isCompact ? 'mt-0.5' : 'mt-1'}`}>
              <span className={`font-bold rounded-full ${isCompact ? 'text-[9px] px-1.5 py-0.2' : 'text-[10px] px-2 py-0.5'} ${isMale ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'}`}>{patient.jk} · {patient.age || 'Usia -'}</span>
              <span className={`font-mono font-semibold text-slate-600 bg-slate-100 rounded-md ${isCompact ? 'text-[10px] px-1.5 py-0.2' : 'text-xs px-2 py-0.5'}`}>RM: {patient.rm}</span>
            </div>
          </div>
          <span className={`shrink-0 font-bold border ${isCompact ? 'text-[10.5px] px-2 py-0.5 rounded-md' : 'text-xs px-2.5 py-1 rounded-lg'} ${isBed ? 'bg-purple-50 text-purple-800 border-purple-200 font-mono' : 'bg-slate-100 text-slate-800 border-slate-200'}`} title={isBed ? `Format Bed (${patient.room})` : 'Kamar Pasien'}>{formattedLocation}</span>
        </div>

        <div className={`flex items-center gap-1.5 text-slate-700 font-semibold bg-teal-50/70 border border-teal-100/80 rounded-lg ${isCompact ? 'mt-1.5 px-2 py-1 text-[10.5px]' : 'mt-2 px-2.5 py-1.5 text-xs'}`} title={`Ruangan: ${patient.room || '-'}`}>
          <Building2 className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-teal-600 shrink-0`} />
          <span className="text-slate-500">Ruang:</span><span className="truncate text-teal-900">{patient.room || '-'}</span>
        </div>

        <div className={`border-t border-slate-100 ${isCompact ? 'mt-2 pt-1.5 space-y-1 text-[11px]' : 'mt-3 pt-2.5 space-y-2 text-xs'}`}>
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Stethoscope className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-teal-600 shrink-0`} />
            <span className="truncate">{patient.dpjp || '-'}</span>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200 rounded-md px-1.5 py-0.5">{roleLabel}</span>
          </div>
          {patient.supervisingDpjp && <div className={`text-slate-600 bg-amber-50 border border-amber-100 rounded-lg leading-snug ${isCompact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]'}`} title="DPJP utama dari luar divisi; hanya sebagai catatan tambahan"><span className="font-bold text-amber-800">DPJP Utama:</span> {patient.supervisingDpjp}</div>}
          <div className={`text-slate-800 font-normal bg-slate-50 border border-slate-100 rounded-lg leading-relaxed whitespace-pre-wrap ${isCompact ? 'p-1.5 text-[10.5px] line-clamp-2 hover:line-clamp-none transition-all' : 'p-2.5 text-[11px]'}`}>{patient.dx || 'Diagnosis klinis belum diisi.'}</div>
        </div>
      </div>

      <div className={`border-t border-slate-100 flex items-center justify-between gap-2 ${isCompact ? 'mt-2 pt-1.5' : 'mt-3.5 pt-2.5'}`}>
        {/* Tombol Tanda Sweeping Pagi (Hijau jika masih ada, Kuning/Amber jika rencana pulang) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePresence?.(patient);
          }}
          className={`inline-flex items-center gap-1.5 font-bold rounded-lg border transition-all cursor-pointer select-none ${
            isMarkedPulang
              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
          } ${isCompact ? 'text-[10.5px] px-2 py-1 min-h-[28px]' : 'text-xs px-2.5 py-1.5 min-h-[32px]'}`}
          title={
            isMarkedPulang
              ? 'Status: Tanda Pulang (menunggu evaluasi residen). Klik untuk ubah jadi Masih Ada.'
              : 'Status: Masih Ada di ruangan. Klik untuk tandai Rencana Pulang.'
          }
          aria-label={
            isMarkedPulang
              ? `Tandai ${patient.name} masih ada di ruangan`
              : `Tandai ${patient.name} rencana pulang`
          }
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isMarkedPulang ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span>{isMarkedPulang ? 'Tanda Pulang' : 'Masih Ada'}</span>
        </button>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {onMove && <button type="button" onClick={onMove} className={`text-slate-500 hover:text-violet-600 hover:bg-violet-50 active:bg-violet-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${isCompact ? 'min-w-[28px] min-h-[28px] p-1.5' : 'min-w-[36px] min-h-[36px] p-2 sm:p-1.5'}`} title="Pindahkan ke hari lain" aria-label={`Pindahkan ${patient.name} ke hari lain`}><CalendarDays className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} /></button>}
          {onQuickShare && <button type="button" onClick={onQuickShare} className={`text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${isCompact ? 'min-w-[28px] min-h-[28px] p-1.5' : 'min-w-[36px] min-h-[36px] p-2 sm:p-1.5'}`} title="Salin Data Pasien Ini" aria-label="Salin data pasien"><Share2 className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} /></button>}
          <button type="button" onClick={onEdit} className={`text-slate-500 hover:text-teal-700 hover:bg-teal-50 active:bg-teal-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${isCompact ? 'min-w-[28px] min-h-[28px] p-1.5' : 'min-w-[36px] min-h-[36px] p-2 sm:p-1.5'}`} title="Edit Pasien" aria-label="Edit data pasien"><Edit2 className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} /></button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className={`rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
              isMarkedPulang
                ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300'
                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100'
            } ${isCompact ? 'min-w-[28px] min-h-[28px] p-1.5' : 'min-w-[36px] min-h-[36px] p-2 sm:p-1.5'}`}
            title={isMarkedPulang ? 'ACC Residen: Hapus data pasien pulang ini' : 'Hapus Pasien'}
            aria-label={`Hapus data pasien ${patient.name}`}
          >
            <Trash2 className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </button>
        </div>
      </div>
    </div>
  );
}
