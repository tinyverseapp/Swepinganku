import { useEffect } from 'react';
import {
  Calendar,
  KeyRound,
  Users,
  GitPullRequest,
  UserPlus,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { DivisionTeam } from '../types';
import { getJoinedDivisions, getSavedActiveTeam } from '../utils/teamRegistry';
import { useDivisionColors } from '../utils/divisionColors';
import { AiSparkleIcon } from './AiSparkleIcon';

interface ControlsBarProps {
  date: string;
  division: string;
  divisions: string[];
  onDateChange: (date: string) => void;
  onDivisionChange: (division: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenReport?: (mode: 'dpjp' | 'all') => void;
  onOpenWeekly: () => void;
  onOpenRoster?: () => void;
  onOpenDocumentView?: () => void;
  activeTeam?: DivisionTeam;
  onOpenTeamModal?: () => void;
  onHandoverPatients?: () => void;
  onAddPatient?: () => void;
  onOpenAiImport?: () => void;
}

export function ControlsBar({
  date,
  division,
  divisions,
  onDateChange,
  onDivisionChange,
  onOpenWeekly,
  activeTeam,
  onOpenTeamModal,
  onHandoverPatients,
  onAddPatient,
  onOpenAiImport
}: ControlsBarProps) {
  const savedTeam = getSavedActiveTeam();
  const joinedDivisions = getJoinedDivisions();
  const effectiveDivision = savedTeam?.division || division;
  const visibleDivisions = (divisions || []).filter((d) => joinedDivisions.includes(d) || d === effectiveDivision);
  const { activeTheme } = useDivisionColors(effectiveDivision);

  // Re-apply the user's persisted team immediately after mount.
  useEffect(() => {
    if (savedTeam?.division && savedTeam.division !== division) {
      onDivisionChange(savedTeam.division);
    }
  }, [savedTeam?.division]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-4">
      {activeTeam && onOpenTeamModal && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border shadow-2xs transition-all ${activeTheme.bannerBg}`}>
          <div className="flex items-start gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${activeTheme.bg} text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0 transition-colors`}>
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900">{activeTeam.teamName || effectiveDivision}</span>
                <span className={`font-mono text-[11px] font-extrabold bg-white ${activeTheme.text} px-2 py-0.5 rounded-md border ${activeTheme.border} shadow-2xs`}>
                  PIN: {activeTeam.teamCode}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${activeTheme.badge}`}>
                  {effectiveDivision}
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{activeTeam.members?.join(', ') || '1 Koas'}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Partner yang memasukkan PIN <b>{activeTeam.teamCode}</b> otomatis terhubung dan berbagi daftar pasien yang sama.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            {onHandoverPatients && (
              <button
                type="button"
                onClick={onHandoverPatients}
                className="flex-1 sm:flex-initial px-3 py-2 text-xs font-bold bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer min-h-[38px]"
                title="Tarik pasien dari hari kemarin ke hari ini"
              >
                <GitPullRequest className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Operan Pasien Kemarin</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenTeamModal}
              className="flex-1 sm:flex-initial px-3 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer min-h-[38px]"
            >
              <span>Ganti Tim / PIN</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Tanggal Sweeping</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 sm:py-2 text-sm sm:text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer min-h-[42px]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-2xs border border-white"
              style={{ backgroundColor: activeTheme.hex }}
            />
            <span>Divisi Bedah</span>
          </label>
          <select
            value={effectiveDivision}
            onChange={(e) => onDivisionChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 sm:py-2 text-sm sm:text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer min-h-[42px]"
          >
            {visibleDivisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold"><Sparkles className="w-3.5 h-3.5 text-teal-600" /><span>Aksi &amp; Rekap:</span></div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenAiImport && (
            <button
              type="button"
              onClick={onOpenAiImport}
              className="group flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer min-h-[40px]"
              title="Salin & Tempel Catatan Teks untuk Diubah Menjadi Pasien Otomatis oleh AI"
            >
              <AiSparkleIcon size={16} className="shrink-0 transition-transform duration-200 group-hover:scale-115" />
              <span>AI Impor Catatan</span>
            </button>
          )}
          {onAddPatient && <button type="button" onClick={onAddPatient} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer min-h-[40px]" title="Tambah Pasien Baru"><UserPlus className="w-4 h-4 shrink-0" /><span>Tambah Pasien</span></button>}
          <button type="button" onClick={onOpenWeekly} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer min-h-[40px]" title="Lihat Rekapitulasi Mingguan dan Ekspor Excel/CSV"><FileSpreadsheet className="w-4 h-4 text-emerald-100 shrink-0" /><span>Rekap Mingguan &amp; CSV</span></button>
        </div>
      </div>
    </div>
  );
}
