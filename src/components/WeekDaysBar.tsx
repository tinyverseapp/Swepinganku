import { useMemo, useState, useEffect } from 'react';
import { getWeekDays, shiftDateByDays, getStorageKey, today, formatIndonesianDate, isRemovedDoctor } from '../utils/storage';
import { subscribeToTeamAllPatients } from '../lib/firestoreService';
import { ChevronLeft, ChevronRight, Calendar, Copy, CheckCircle2, ArrowRight } from 'lucide-react';
import { useDivisionColors } from '../utils/divisionColors';

interface WeekDaysBarProps {
  currentDate: string;
  division: string;
  currentPatientCount: number;
  onSelectDate: (date: string) => void;
  onCopyFromDay?: (fromDate: string, dayName: string) => void;
  onDeleteAllDay?: (date: string, dayName: string, count: number) => void;
  teamCode?: string;
}

export function WeekDaysBar({
  currentDate,
  division,
  currentPatientCount,
  onSelectDate,
  onCopyFromDay,
  onDeleteAllDay,
  teamCode
}: WeekDaysBarProps) {
  const { activeTheme } = useDivisionColors(division);
  const todayDate = today();
  const effectiveDate = currentDate || todayDate;
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');
  const [remoteCounts, setRemoteCounts] = useState<Record<string, number>>({});

  // Real-time Firestore subscription: updates patient counts for all days in the team immediately
  useEffect(() => {
    if (!teamCode) {
      setRemoteCounts({});
      return;
    }
    const unsub = subscribeToTeamAllPatients(
      teamCode,
      (allPatients) => {
        const counts: Record<string, number> = {};
        allPatients.forEach((p) => {
          if (p.date && !isRemovedDoctor(p.dpjp)) {
            counts[p.date] = (counts[p.date] || 0) + 1;
          }
        });
        setRemoteCounts(counts);
      },
      (err) => {
        console.warn('Realtime week counts error:', err);
      }
    );
    return () => unsub();
  }, [teamCode]);

  const weekDays = useMemo(() => {
    return getWeekDays(effectiveDate, effectiveDate);
  }, [effectiveDate]);

  // Compute patient count for each day of this week in real time
  const patientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    weekDays.forEach((w) => {
      // 1. If remote real-time Firestore count is available for this team, use it directly
      if (teamCode && typeof remoteCounts[w.date] === 'number') {
        counts[w.date] = w.date === effectiveDate ? Math.max(remoteCounts[w.date], currentPatientCount) : remoteCounts[w.date];
        return;
      }
      // 2. If it's the currently open day, use currentPatientCount
      if (w.date === effectiveDate) {
        counts[w.date] = currentPatientCount;
        return;
      }
      // 3. Look up from local cache using team key first, then division fallback
      const teamKey = teamCode ? getStorageKey(w.date, division, teamCode) : null;
      const raw = (teamKey && localStorage.getItem(teamKey)) || localStorage.getItem(getStorageKey(w.date, division));
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const filtered = Array.isArray(parsed) ? parsed.filter((p: any) => !isRemovedDoctor(p?.dpjp)) : [];
          counts[w.date] = filtered.length;
        } catch {
          counts[w.date] = 0;
        }
      } else {
        counts[w.date] = 0;
      }
    });
    return counts;
  }, [weekDays, effectiveDate, division, teamCode, currentPatientCount, remoteCounts]);

  const startDateStr = weekDays[0]?.date || '';
  const endDateStr = weekDays[6]?.date || '';

  const handlePrevWeek = () => {
    const newDate = shiftDateByDays(effectiveDate, -7);
    onSelectDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = shiftDateByDays(effectiveDate, 7);
    onSelectDate(newDate);
  };

  const handleTodayWeek = () => {
    onSelectDate(todayDate);
  };

  const isCurrentWeek = weekDays.some((w) => w.date === todayDate);

  // Check if current day is empty and find the closest previous day with patients
  const currentIdx = weekDays.findIndex((w) => w.date === effectiveDate);
  const currentDayName = currentIdx >= 0 ? weekDays[currentIdx].dayName : 'Hari ini';

  let targetPreviousDay: { date: string; dayName: string; count: number } | null = null;
  if (currentIdx > 0) {
    for (let i = currentIdx - 1; i >= 0; i--) {
      const dDate = weekDays[i].date;
      const cnt = patientCounts[dDate] || 0;
      if (cnt > 0) {
        targetPreviousDay = { date: dDate, dayName: weekDays[i].dayName, count: cnt };
        break;
      }
    }
    // Fallback to immediate previous day if count was 0 or not yet counted
    if (!targetPreviousDay && currentIdx > 0) {
      const prev = weekDays[currentIdx - 1];
      const teamKey = teamCode ? getStorageKey(prev.date, division, teamCode) : null;
      const raw = (teamKey && localStorage.getItem(teamKey)) || localStorage.getItem(getStorageKey(prev.date, division));
      let cnt = patientCounts[prev.date] || 0;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) cnt = parsed.filter((p: any) => !isRemovedDoctor(p?.dpjp)).length;
        } catch {}
      }
      if (cnt > 0) {
        targetPreviousDay = { date: prev.date, dayName: prev.dayName, count: cnt };
      }
    }
  } else if (currentIdx === 0) {
    // If it's Monday, check Sunday before Monday
    const prevSundayDate = shiftDateByDays(weekDays[0].date, -1);
    const teamKey = teamCode ? getStorageKey(prevSundayDate, division, teamCode) : null;
    const raw = (teamKey && localStorage.getItem(teamKey)) || localStorage.getItem(getStorageKey(prevSundayDate, division));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter((p: any) => !isRemovedDoctor(p?.dpjp));
          if (filtered.length > 0) {
            targetPreviousDay = { date: prevSundayDate, dayName: 'Minggu Lalu', count: filtered.length };
          }
        }
      } catch {}
    }
  }

  const showCopyPrompt = currentPatientCount === 0 && targetPreviousDay && targetPreviousDay.count > 0 && Boolean(onCopyFromDay);

  const handleCopyClick = () => {
    if (!targetPreviousDay || !onCopyFromDay) return;
    setCopyStatus('copying');
    onCopyFromDay(targetPreviousDay.date, targetPreviousDay.dayName);
    setTimeout(() => {
      setCopyStatus('copied');
      setTimeout(() => {
        setCopyStatus('idle');
      }, 3500);
    }, 150);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3">
      {/* Header with Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Jadwal Sweeping 1 Minggu
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${activeTheme.badge}`}>
                {division}
              </span>
              {isCurrentWeek && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full">
                  Minggu Berjalan
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Senin s.d. Minggu: {formatIndonesianDate(startDateStr, { day: '2-digit', month: 'short' })} – {formatIndonesianDate(endDateStr, { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Week navigation buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={handlePrevWeek}
            title="Minggu Sebelumnya"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleTodayWeek}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
              isCurrentWeek
                ? 'bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={handleNextWeek}
            title="Minggu Berikutnya"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row of 7 Days: Senin to Minggu */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {(weekDays || []).map((w) => {
          const count = patientCounts[w.date] || 0;
          const isSelected = w.date === currentDate;

          return (
            <div key={w.date} className="relative group/day flex">
              <button
                type="button"
                onClick={() => onSelectDate(w.date)}
                className={`w-full flex flex-col items-center justify-between p-1 sm:p-2 rounded-xl border text-center transition-all cursor-pointer relative overflow-hidden min-h-[66px] sm:min-h-[70px] ${
                  isSelected
                    ? 'bg-teal-700 border-teal-700 text-white shadow-sm ring-2 ring-teal-500/30'
                    : w.isToday
                    ? 'bg-emerald-50/60 border-emerald-300 text-slate-800 hover:bg-emerald-100/50'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                }`}
              >
                {/* Today dot */}
                {w.isToday && !isSelected && (
                  <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-emerald-500" title="Hari ini" />
                )}

                {/* Day Name (Senin, Selasa, etc.) */}
                <span className={`text-[10px] sm:text-xs font-bold leading-tight ${
                  isSelected ? 'text-white' : 'text-slate-800'
                }`}>
                  <span className="hidden sm:inline">{w.dayName}</span>
                  <span className="sm:hidden">{w.shortName}</span>
                </span>

                {/* Date (e.g., 07 Sep) */}
                <span className={`text-[9px] sm:text-[11px] font-medium leading-none my-0.5 ${
                  isSelected ? 'text-white/85' : 'text-slate-500'
                }`}>
                  {w.dayOfMonth} <span className="hidden sm:inline">{w.monthName}</span>
                </span>

                {/* Patient Count Badge */}
                <span
                  className={`text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.2 rounded-full mt-0.5 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : count > 0
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-200/60 text-slate-500'
                  }`}
                >
                  {count}<span className="hidden sm:inline"> pas</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Helper notice if current day has 0 patients but previous day has patients */}
      {showCopyPrompt && targetPreviousDay && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="leading-relaxed">
              Belum ada pasien terdata di hari <b>{currentDayName}</b>. Ingin salin daftar pasien dari <b>{targetPreviousDay.dayName}</b> ({targetPreviousDay.count} pasien)?
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyClick}
            disabled={copyStatus === 'copying'}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 cursor-pointer ml-auto shrink-0 ${
              copyStatus === 'copied'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/20'
                : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white'
            }`}
          >
            {copyStatus === 'copied' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                <span>Tersalin ({targetPreviousDay.count} pasien)</span>
              </>
            ) : copyStatus === 'copying' ? (
              <>
                <Copy className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Menyalin...</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>Salin dari {targetPreviousDay.dayName} ({targetPreviousDay.count} pasien)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
