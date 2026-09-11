import { useEffect, useState } from 'react';
import { X, Download, RefreshCw, CalendarRange, Users, Table, LayoutGrid, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { WeeklyRow, Patient } from '../types';
import { formatKamarOrBed, normalizeRoomName, formatPatientNameWithHonorific, formatRoomDisplay } from '../data/constants';
import { exportWeeklyCSV, exportPatientsCSV, parseDateSafely, formatDateIso } from '../utils/storage';
import { fetchPatientsForDateRange, seedWeeklyHistory, subscribeToWeeklyHistory, WeeklyHistoryRecord } from '../lib/firestoreService';

interface WeeklyModalProps { isOpen: boolean; currentDate: string; division: string; teamCode?: string; onClose: () => void; }

function datesBetween(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = parseDateSafely(start);
  const stop = parseDateSafely(end);
  while (cursor <= stop && result.length < 60) { result.push(formatDateIso(cursor)); cursor.setDate(cursor.getDate() + 1); }
  return result;
}

function rmKey(rm?: string | null): string {
  const clean = String(rm || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return clean.replace(/^0+/, '') || clean;
}

function buildWeeklyData(records: WeeklyHistoryRecord[], startDate: string, endDate: string, division: string) {
  const dates = datesBetween(startDate, endDate);
  const map = new Map<string, WeeklyRow>();
  const detailMap = new Map<string, { patient: Patient; date: string }>();

  for (const record of records) {
    const occurrences = Object.entries(record.days || {})
      .filter(([dt, occurrence]) => dt >= startDate && dt <= endDate && (!division || !occurrence.patient.division || occurrence.patient.division === division))
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [dt, occurrence] of occurrences) {
      const p = occurrence.patient;
      if (!p.rm) continue;
      const key = rmKey(p.rm); if (!key) continue;
      const existing = map.get(key);
      const row = existing || {
        rm: p.rm,
        name: formatPatientNameWithHonorific(p.name, p.age, p.jk),
        jk: p.jk || '-', age: p.age || '-', dpjp: p.dpjp || '-', dx: p.dx || '',
        first: dt, last: dt, lastRoom: normalizeRoomName(p.room), lastKamar: p.kamar || '', days: {}
      };

      if (dt < row.first) row.first = dt;
      if (dt >= row.last) {
        row.last = dt;
        row.rm = p.rm || row.rm;
        row.name = formatPatientNameWithHonorific(p.name, p.age, p.jk);
        row.jk = p.jk || row.jk; row.age = p.age || row.age; row.dpjp = p.dpjp || row.dpjp; row.dx = p.dx || row.dx;
        row.lastRoom = normalizeRoomName(p.room); row.lastKamar = p.kamar || '';
      } else {
        row.name = p.name ? formatPatientNameWithHonorific(p.name, p.age, p.jk) : row.name;
        row.jk = p.jk || row.jk; row.age = p.age || row.age; row.dpjp = p.dpjp || row.dpjp; row.dx = p.dx || row.dx;
      }
      row.days[dt] = `${normalizeRoomName(p.room)} (${formatKamarOrBed(p.room, p.kamar)})`;
      map.set(key, row);

      const currentDetail = detailMap.get(key);
      if (!currentDetail || dt >= currentDetail.date) detailMap.set(key, { patient: p, date: dt });
    }
  }

  return {
    rows: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)),
    dates,
    detailedPatients: [...detailMap.values()].map((entry) => entry.patient).sort((a, b) => (a.room || '').localeCompare(b.room || '') || (a.name || '').localeCompare(b.name || ''))
  };
}

export function WeeklyModal({ isOpen, currentDate, division, teamCode, onClose }: WeeklyModalProps) {
  const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<WeeklyRow[]>([]); const [dates, setDates] = useState<string[]>([]); const [detailedPatients, setDetailedPatients] = useState<Patient[]>([]);
  const [activeTab, setActiveTab] = useState<'table' | 'matrix'>('table'); const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');

  useEffect(() => {
    if (!currentDate) return;
    const d = parseDateSafely(currentDate); const diff = (d.getDay() + 6) % 7;
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff); const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    const s = formatDateIso(mon), e = formatDateIso(sun);
    setStartDate(s); setEndDate(e);
  }, [currentDate]);

  useEffect(() => {
    if (!isOpen || !teamCode || !startDate || !endDate) return;
    let active = true;
    setLoading(true); setError(''); setRows([]); setDetailedPatients([]); setDates(datesBetween(startDate, endDate));

    const run = async () => {
      try {
        // Backfill the permanent history with all current daily records in this week.
        // This also makes older data visible in the new historical recap system.
        const currentPatients = await fetchPatientsForDateRange(teamCode, startDate, endDate);
        if (!active) return;
        await seedWeeklyHistory(teamCode, startDate, endDate, currentPatients);
        if (!active) return;

        const unsubscribe = subscribeToWeeklyHistory(teamCode, startDate, (records) => {
          if (!active) return;
          const result = buildWeeklyData(records, startDate, endDate, division);
          setRows(result.rows); setDates(result.dates); setDetailedPatients(result.detailedPatients); setLoading(false);
        }, (err) => {
          if (!active) return;
          setError(err.message || 'Gagal berlangganan rekap realtime dari Firebase.'); setLoading(false);
        });

        // Store the unsubscribe function on the effect instance without exposing it to React state.
        cleanup = unsubscribe;
      } catch (err) {
        if (!active) return;
        console.error('[Firestore] weekly realtime recap:', err);
        setError(err instanceof Error ? err.message : 'Gagal memuat rekap dari Firebase.'); setLoading(false);
      }
    };

    let cleanup: (() => void) | undefined;
    void run();
    return () => { active = false; cleanup?.(); };
  }, [isOpen, teamCode, startDate, endDate, division]);

  useEffect(() => { if (!downloadSuccess) return; const t = setTimeout(() => setDownloadSuccess(null), 3000); return () => clearTimeout(t); }, [downloadSuccess]);
  if (!isOpen) return null;

  const handleGenerate = () => {
    // The weekly recap is already a realtime Firestore subscription. This button is kept
    // as an explicit refresh by changing the same range dependency through a fresh load.
    setRows([]); setDetailedPatients([]); setError('');
    const refresh = async () => {
      if (!teamCode || !startDate || !endDate) return;
      setLoading(true);
      try {
        const currentPatients = await fetchPatientsForDateRange(teamCode, startDate, endDate);
        await seedWeeklyHistory(teamCode, startDate, endDate, currentPatients);
        setDownloadSuccess('Rekap berhasil disegarkan dari Firebase.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal menyegarkan rekap.');
      } finally { setLoading(false); }
    };
    void refresh();
  };

  const handleDownloadPatientTableCSV = () => {
    if (!detailedPatients.length) return;
    exportPatientsCSV(detailedPatients, division, `${startDate}_${endDate}`, `Rekap-Pasien-${(division || 'Bedah').replace(/\s+/g, '-')}-${startDate}_${endDate}`);
    setDownloadSuccess('CSV Pasien berhasil diunduh dari data Firebase terbaru.');
  };
  const handleDownloadMatrixCSV = () => {
    if (!rows.length) return;
    exportWeeklyCSV(rows, dates, division, startDate, endDate);
    setDownloadSuccess('CSV Matriks berhasil diunduh dari data Firebase terbaru.');
  };

  return <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
    <div className="bg-white rounded-2xl max-w-6xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><CalendarRange className="w-5 h-5" /></div><div><h2 className="text-base sm:text-lg font-extrabold text-slate-900">Rekapitulasi &amp; Ekspor CSV Pasien</h2><p className="text-[11px] text-slate-500">Divisi {division} · sumber data Firebase · realtime</p></div></div><button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg min-h-9 min-w-9"><X className="w-5 h-5" /></button></div>
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
        <div className="lg:col-span-3"><label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Awal</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs min-h-10" /></div>
        <div className="lg:col-span-3"><label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Akhir</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs min-h-10" /></div>
        <div className="lg:col-span-6 flex flex-wrap gap-2"><button type="button" onClick={handleGenerate} disabled={loading} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs min-h-10 disabled:opacity-60"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Memuat Firebase...' : 'Segarkan Rekap'}</button><button type="button" onClick={handleDownloadPatientTableCSV} disabled={!detailedPatients.length || loading} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs min-h-10 disabled:bg-slate-300"><FileSpreadsheet className="w-3.5 h-3.5" />Export CSV Pasien</button><button type="button" onClick={handleDownloadMatrixCSV} disabled={!rows.length || loading} className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-white text-emerald-800 font-bold text-xs min-h-10 disabled:text-slate-400"><Download className="w-3.5 h-3.5" />Export Matriks</button></div>
      </div>
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0"><div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold"><button type="button" onClick={() => setActiveTab('table')} className={`px-3 py-1.5 rounded-lg ${activeTab === 'table' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}><Table className="w-3.5 h-3.5 inline mr-1" />Tabel Pasien Unik ({detailedPatients.length})</button><button type="button" onClick={() => setActiveTab('matrix')} className={`px-3 py-1.5 rounded-lg ${activeTab === 'matrix' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}><LayoutGrid className="w-3.5 h-3.5 inline mr-1" />Matriks Harian ({rows.length})</button></div><span className="text-[11px] text-emerald-600 font-semibold">● Sinkron realtime · riwayat mingguan dipertahankan</span></div>
      {downloadSuccess && <div className="mt-2 py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{downloadSuccess}</div>}
      {error && <div className="mt-2 py-2 px-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">{error}</div>}
      <div className="mt-3 flex-1 overflow-auto border border-slate-200 rounded-xl bg-white">
        {loading ? <div className="p-12 text-center text-xs text-slate-500"><RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2" />Memuat dan menyinkronkan rekap dari Firebase...</div> : activeTab === 'table' ? (!detailedPatients.length ? <div className="p-12 text-center text-xs text-slate-500"><Users className="w-8 h-8 text-slate-300 mx-auto mb-2" /><b>Tidak ada data pasien</b></div> : <table className="w-full text-left text-xs border-collapse"><thead><tr className="bg-[#70ad47] text-white sticky top-0 font-bold"><th className="p-2.5">No</th><th className="p-2.5">No. RM</th><th className="p-2.5">Nama</th><th className="p-2.5">JK</th><th className="p-2.5">Usia</th><th className="p-2.5">Diagnosis</th><th className="p-2.5">DPJP</th><th className="p-2.5">Ruangan</th></tr></thead><tbody>{detailedPatients.map((p, i) => <tr key={`${p.rm}-${i}`} className="border-b hover:bg-emerald-50/40"><td className="p-2.5">{i + 1}</td><td className="p-2.5 font-mono">{p.rm}</td><td className="p-2.5 font-medium">{p.name}</td><td className="p-2.5">{p.jk || '-'}</td><td className="p-2.5">{p.age || '-'}</td><td className="p-2.5">{p.dx || '-'}</td><td className="p-2.5">{p.dpjp || '-'}</td><td className="p-2.5">{formatRoomDisplay(p.room, p.kamar)}</td></tr>)}</tbody></table>) : (!rows.length ? <div className="p-12 text-center text-xs text-slate-500"><Users className="w-8 h-8 text-slate-300 mx-auto mb-2" /><b>Tidak ada riwayat pasien</b></div> : <table className="w-full text-left text-xs border-collapse"><thead><tr className="bg-slate-100 text-slate-700 sticky top-0 font-bold"><th className="p-2.5">No</th><th className="p-2.5">No. RM</th><th className="p-2.5">Nama</th><th className="p-2.5">JK</th><th className="p-2.5">Usia</th><th className="p-2.5">DPJP</th><th className="p-2.5">Ruangan Terakhir</th><th className="p-2.5">Diagnosis</th>{dates.map((dt) => <th key={dt} className="p-2.5 text-center border-l whitespace-nowrap">{parseDateSafely(dt).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit' })}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.rm} className="border-b hover:bg-slate-50"><td className="p-2.5">{i + 1}</td><td className="p-2.5 font-mono font-semibold">{r.rm}</td><td className="p-2.5 font-bold whitespace-nowrap">{r.name}</td><td className="p-2.5">{r.jk}</td><td className="p-2.5">{r.age}</td><td className="p-2.5 whitespace-nowrap">{r.dpjp}</td><td className="p-2.5 whitespace-nowrap">{r.lastRoom} {r.lastKamar ? `/ ${formatKamarOrBed(r.lastRoom, r.lastKamar)}` : ''}</td><td className="p-2.5">{r.dx}</td>{dates.map((dt) => <td key={dt} className="p-2.5 text-center border-l whitespace-nowrap">{r.days[dt] || <span className="text-slate-300">-</span>}</td>)}</tr>)}</tbody></table>)}
      </div>
    </div>
  </div>;
}
