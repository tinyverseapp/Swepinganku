import { useState, useEffect } from 'react';
import {
  computeWeeklyRecap,
  exportWeeklyCSV,
  exportPatientsCSV,
  getWeeklyPatientList,
  parseDateSafely,
  formatDateIso
} from '../utils/storage';
import { WeeklyRow, Patient } from '../types';
import { formatKamarOrBed, normalizeRoomName, formatPatientNameWithHonorific, formatRoomDisplay } from '../data/constants';
import {
  X,
  Download,
  RefreshCw,
  CalendarRange,
  Users,
  Table,
  LayoutGrid,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

interface WeeklyModalProps {
  isOpen: boolean;
  currentDate: string;
  division: string;
  teamCode?: string;
  onClose: () => void;
}

export function WeeklyModal({ isOpen, currentDate, division, teamCode, onClose }: WeeklyModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [detailedPatients, setDetailedPatients] = useState<Patient[]>([]);
  const [activeTab, setActiveTab] = useState<'table' | 'matrix'>('table');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!currentDate) return;
    const d = parseDateSafely(currentDate);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);

    const s = formatDateIso(mon);
    const e = formatDateIso(sun);
    setStartDate(s);
    setEndDate(e);

    const res = computeWeeklyRecap(s, e, division, teamCode);
    setRows(res.rows);
    setDates(res.dates);

    const detailed = getWeeklyPatientList(s, e, division, teamCode);
    setDetailedPatients(detailed);
  }, [currentDate, division, teamCode, isOpen]);

  useEffect(() => {
    if (!downloadSuccess) return;
    const t = setTimeout(() => setDownloadSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [downloadSuccess]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    if (!startDate || !endDate) return;
    const res = computeWeeklyRecap(startDate, endDate, division, teamCode);
    setRows(res.rows);
    setDates(res.dates);

    const detailed = getWeeklyPatientList(startDate, endDate, division, teamCode);
    setDetailedPatients(detailed);
  };

  const handleDownloadPatientTableCSV = () => {
    if (!detailedPatients.length) return;
    const fileName = `Rekap-Pasien-${(division || 'Bedah').replace(/\s+/g, '-')}-${startDate}_${endDate}`;
    exportPatientsCSV(
      detailedPatients,
      division,
      `${startDate}_${endDate}`,
      fileName
    );
    setDownloadSuccess('CSV Pasien berhasil diunduh (termasuk kolom Ruangan).');
  };

  const handleDownloadMatrixCSV = () => {
    if (!rows.length) return;
    exportWeeklyCSV(rows, dates, division, startDate, endDate);
    setDownloadSuccess('CSV Matriks Rekap berhasil diunduh (Format Excel rapi)');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                Rekapitulasi &amp; Ekspor CSV Pasien
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">
                Divisi {division} · Format tabel terstruktur siap buka langsung di Microsoft Excel &amp; Spreadsheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Filters & Action Bar */}
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Awal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[38px]"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[38px]"
            />
          </div>
          <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer min-h-[38px]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Hitung Rekap</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPatientTableCSV}
              disabled={detailedPatients.length === 0}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer min-h-[38px] ${
                detailedPatients.length === 0
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
              }`}
              title="Unduh file CSV berisi tabel tiap pasien sesuai data input web (No, Ruangan, DPJP, RM, Nama, Diagnosis)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV (Tabel Pasien)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadMatrixCSV}
              disabled={rows.length === 0}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs border transition-colors shadow-2xs cursor-pointer min-h-[38px] ${
                rows.length === 0
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
              title="Unduh file CSV matriks rekap per hari"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Matriks Hari</span>
            </button>
          </div>
        </div>

        {/* View mode toggle & helper banner */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tabel Pasien Unik ({detailedPatients.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Matriks Harian ({rows.length} Pasien)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>File CSV diformat dengan separator titik-koma (<b>;</b>) &amp; UTF-8 BOM untuk Microsoft Excel.</span>
          </div>
        </div>

        {downloadSuccess && (
          <div className="mt-2.5 py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Content Table */}
        <div className="mt-3 flex-1 overflow-auto border border-slate-200 rounded-xl bg-white">
          {activeTab === 'table' ? (
            detailedPatients.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">Tidak ada data pasien</p>
                <p className="text-slate-400 mt-0.5">
                  Belum ada sweeping pasien tersimpan pada rentang tanggal ini untuk {division}.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-[#70ad47] text-white border-b border-[#5b8c39] sticky top-0 font-bold z-10 shadow-xs">
                    <th className="p-2.5 border-r border-[#5b8c39] text-center w-12">No</th>
                    <th className="p-2.5 border-r border-[#5b8c39] w-28">No. RM</th>
                    <th className="p-2.5 border-r border-[#5b8c39] w-48">Nama</th>
                    <th className="p-2.5 border-r border-[#5b8c39] text-center w-12">JK</th>
                    <th className="p-2.5 border-r border-[#5b8c39] text-center w-14">Usia</th>
                    <th className="p-2.5 border-r border-[#5b8c39]">Diagnosis</th>
                    <th className="p-2.5 border-r border-[#5b8c39] w-56">DPJP</th>
                    <th className="p-2.5 w-36">Ruangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {detailedPatients.map((p, idx) => {
                    const cleanName = (p.name || '')
                      .replace(/^(tn\.?|ny\.?|an\.?|by\.?|nn\.?|sdr\.?|sdri\.?|tuan|nyonya|anak|bayi)\s+/i, '')
                      .trim();
                    const ageClean = (p.age || '').replace(/\s*(th|tahun|yr|year)s?/i, '').trim();
                    const roomClean = formatRoomDisplay(p.room, p.kamar);
                    return (
                      <tr key={`${p.date}_${p.rm}_${p.id || idx}`} className="hover:bg-emerald-50/40 transition-colors border-b border-slate-200">
                        <td className="p-2.5 text-center font-semibold text-slate-700 border-r border-slate-200">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-medium text-slate-800 whitespace-nowrap border-r border-slate-200">{p.rm}</td>
                        <td className="p-2.5 font-medium text-slate-900 whitespace-nowrap border-r border-slate-200">{cleanName || p.name}</td>
                        <td className="p-2.5 text-center font-medium text-slate-800 border-r border-slate-200">{p.jk}</td>
                        <td className="p-2.5 text-center text-slate-800 border-r border-slate-200">{ageClean || p.age || '-'}</td>
                        <td className="p-2.5 text-slate-800 border-r border-slate-200">{p.dx || '-'}</td>
                        <td className="p-2.5 text-slate-800 whitespace-nowrap font-medium border-r border-slate-200">{p.dpjp}</td>
                        <td className="p-2.5 text-slate-800 whitespace-nowrap font-medium">{roomClean}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            rows.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">Tidak ada riwayat pasien</p>
                <p className="text-slate-400 mt-0.5">
                  Belum ada sweeping tersimpan pada rentang tanggal ini untuk {division}.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0 font-bold z-10">
                    <th className="p-2.5">No</th>
                    <th className="p-2.5">No. RM</th>
                    <th className="p-2.5">Nama Pasien</th>
                    <th className="p-2.5">JK</th>
                    <th className="p-2.5">Usia</th>
                    <th className="p-2.5">DPJP</th>
                    <th className="p-2.5">Ruangan Terakhir</th>
                    <th className="p-2.5">Diagnosis</th>
                    {(dates || []).map((dt) => {
                      const d = parseDateSafely(dt);
                      let dayLabel = dt;
                      try {
                        dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit' });
                      } catch {
                        dayLabel = dt;
                      }
                      return (
                        <th key={dt} className="p-2.5 font-bold text-center border-l border-slate-200 whitespace-nowrap">
                          {dayLabel}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (
                    <tr key={row.rm} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-semibold text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-mono font-semibold text-blue-700">{row.rm}</td>
                      <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{row.name}</td>
                      <td className="p-2.5">{row.jk}</td>
                      <td className="p-2.5 whitespace-nowrap">{row.age}</td>
                      <td className="p-2.5 text-slate-700 whitespace-nowrap">{row.dpjp}</td>
                      <td className="p-2.5 font-medium whitespace-nowrap">
                        {row.lastRoom} {row.lastKamar ? `/ ${formatKamarOrBed(row.lastRoom, row.lastKamar)}` : ''}
                      </td>
                      <td className="p-2.5 max-w-xs truncate text-slate-600" title={row.dx}>
                        {row.dx}
                      </td>
                      {(dates || []).map((dt) => (
                        <td key={dt} className="p-2.5 text-center font-mono text-[11px] border-l border-slate-100 whitespace-nowrap">
                          {row.days[dt] ? (
                            <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {row.days[dt]}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}

