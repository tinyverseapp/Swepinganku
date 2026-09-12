import { Patient } from '../types';
import { isBedRoom, formatKamarOrBed } from '../data/constants';
import { Edit2, Trash2, Stethoscope, Share2, CalendarDays, Building2 } from 'lucide-react';

interface PatientCardProps {
  key?: string;
  patient: Patient;
  onEdit: () => void;
  onDelete: () => void;
  onQuickShare?: () => void;
  onMove?: () => void;
  isCompact?: boolean;
}

export function PatientCard({ patient, onEdit, onDelete, onQuickShare, onMove, isCompact = false }: PatientCardProps) {
  const isMale = patient.jk === 'L';
  const isBed = isBedRoom(patient.room);
  const formattedLocation = formatKamarOrBed(patient.room, patient.kamar);
  const doctorRole = patient.doctorRole || 'DPJP';
  const roleLabel = doctorRole === 'RABER' ? 'Raber' : doctorRole === 'KONSUL' ? 'Konsul' : 'DPJP';

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between ${isCompact ? 'p-2.5 sm:p-3 space-y-2' : 'p-4'}`}>
      <div>
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <h4 className={`font-bold text-slate-900 leading-snug truncate ${isCompact ? 'text-xs sm:text-[13px]' : 'text-sm'}`} title={patient.name}>{patient.name}</h4>
            <div className={`flex flex-wrap items-center gap-1.5 ${isCompact ? 'mt-0.5' : 'mt-1'}`}>
              <span className={`font-bold rounded-full ${isCompact ? 'text-[9px] px-1.5 py-0.2' : 'text-[10px] px-2 py-0.5'} ${isMale ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>{patient.jk} · {patient.age || 'Usia -'}</span>
              <span className={`font-mono font-semibold text-slate-600 bg-slate-100 rounded-md ${isCompact ? 'text-[10px] px-1.5 py-0.2' : 'text-xs px-2 py-0.5'}`}>RM: {patient.rm}</span>
            </div>
          </div>
          <span className={`shrink-0 font-bold border ${isCompact ? 'text-[10.5px] px-2 py-0.5 rounded-md' : 'text-xs px-2.5 py-1 rounded-lg'} ${isBed ? 'bg-purple-50 text-purple-800 border-purple-200 font-mono' : 'bg-slate-100 text-slate-800 border-slate-200'}`} title={isBed ? `Format Bed (${patient.room})` : 'Kamar Pasien'}>{formattedLocation}</span>
        </div>

        <div className={`flex items-center gap-1.5 text-slate-700 font-semibold bg-blue-50 border border-blue-100 rounded-lg ${isCompact ? 'mt-1.5 px-2 py-1 text-[10.5px]' : 'mt-2 px-2.5 py-1.5 text-xs'}`} title={`Ruangan: ${patient.room || '-'}`}>
          <Building2 className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-blue-600 shrink-0`} />
          <span className="text-slate-500">Ruang:</span><span className="truncate text-blue-800">{patient.room || '-'}</span>
        </div>

        <div className={`border-t border-slate-100 ${isCompact ? 'mt-2 pt-1.5 space-y-1 text-[11px]' : 'mt-3 pt-2.5 space-y-2 text-xs'}`}>
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Stethoscope className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-blue-600 shrink-0`} />
            <span className="truncate">{patient.dpjp || '-'}</span>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200 rounded-md px-1.5 py-0.5">{roleLabel}</span>
          </div>
          {patient.supervisingDpjp && <div className={`text-slate-600 bg-amber-50 border border-amber-100 rounded-lg leading-snug ${isCompact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]'}`} title="DPJP utama dari luar divisi; hanya sebagai catatan tambahan"><span className="font-bold text-amber-800">DPJP Utama:</span> {patient.supervisingDpjp}</div>}
          <div className={`text-slate-800 font-normal bg-slate-50 border border-slate-100 rounded-lg leading-relaxed whitespace-pre-wrap ${isCompact ? 'p-1.5 text-[10.5px] line-clamp-2 hover:line-clamp-none transition-all' : 'p-2.5 text-[11px]'}`}>{patient.dx || 'Diagnosis klinis belum diisi.'}</div>
        </div>
      </div>

      <div className={`border-t border-slate-100 flex items-center justify-end ${isCompact ? 'mt-2 pt-1.5' : 'mt-3.5 pt-2.5'}`}>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {onMove && <button type="button" onClick={onMove} className={`text-slate-500 hover:text-violet-600 hover:bg-violet-50 active:bg-violet-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${isCompact ? 'min-w-[28px] min-h-[28px] p-1.5' : 'min-w-[36px] min-h-[36px] p-2 sm:p-1.5'}`} title="Pindahkan ke hari lain" aria-label={`Pindahkan ${patient.name} ke hari lain`}><CalendarDays className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} /></button>}
          {onQuickShare && <button type="button" onClick={onQuickShare} className={`text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${isCompact ? 'min-w-[28px] min-h-[28px] p-1.5' : 'min-w-[36px] min-h-[36px] p-2 sm:p-1.5'}`} title="Salin Data Pasien Ini" aria-label="Salin data pasien"><Share2 className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} /></button>}
          <button type="button" onClick={onEdit} className={`text-slate-500 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${isCompact ? 'min-w-[28px] min-h-[28px] p-1.5' : 'min-w-[36px] min-h-[36px] p-2 sm:p-1.5'}`} title="Edit Pasien" aria-label="Edit data pasien"><Edit2 className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className={`text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-colors flex items-center justify-center cursor-pointer ${isCompact ? 'min-w-[28px] min-h-[28px] p-1.5' : 'min-w-[36px] min-h-[36px] p-2 sm:p-1.5'}`} title="Hapus Pasien" aria-label={`Hapus data pasien ${patient.name}`}><Trash2 className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} /></button>
        </div>
      </div>
    </div>
  );
}
