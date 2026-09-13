import React, { useState, useMemo } from 'react';
import { Patient } from '../types';
import { MASTER_ROOMS, normalizeRoomName, formatKamarOrBed, formatPatientNameWithHonorific } from '../data/constants';
import { parseDateSafely, generateDocSweepingReportText, getWeekDays, formatDateIso, today } from '../utils/storage';
import { FileText, Copy, Check, Plus, ArrowLeft, SlidersHorizontal, ChevronLeft, ChevronRight, CalendarDays, GitPullRequest, PanelLeftClose, Menu, Trash2, Edit2 } from 'lucide-react';
import { DivisionTeam } from '../types';

interface DocumentSweepingViewProps {
  patients: Patient[]; date: string; division: string; koasName: string; dpjps: string[]; allRooms: string[];
  onDateChange?: (newDate: string) => void; onBackToDashboard: () => void; onAddPatient: () => void;
  onEditPatient: (patient: Patient) => void; activeTeam?: DivisionTeam; onOpenTeamModal?: () => void;
  onHandoverPatients?: () => void; onOpenAiImport?: () => void; onDeleteAllPatients?: () => void;
}

export function DocumentSweepingView({ patients, date, division, koasName, dpjps, allRooms, onDateChange, onBackToDashboard, onAddPatient, onEditPatient, activeTeam, onOpenTeamModal, onHandoverPatients, onOpenAiImport, onDeleteAllPatients }: DocumentSweepingViewProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [includeEmptyRooms, setIncludeEmptyRooms] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  const d = parseDateSafely(date);
  const dayName = useMemo(() => { try { return d.toLocaleDateString('id-ID', { weekday: 'long' }); } catch { return 'Hari ini'; } }, [d]);
  const fullDateStr = useMemo(() => { try { return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return date; } }, [d, date]);
  const weekDays = useMemo(() => getWeekDays(date, date), [date]);
  const isCurrentDateToday = date === today();

  const handlePrevDay = () => { const cur = parseDateSafely(date); cur.setDate(cur.getDate() - 1); onDateChange?.(formatDateIso(cur)); };
  const handleNextDay = () => { const cur = parseDateSafely(date); cur.setDate(cur.getDate() + 1); onDateChange?.(formatDateIso(cur)); };
  const handleToday = () => onDateChange?.(today());

  const getDpjpInitials = (name: string) => {
    const clean = name.replace(/^(dr\.|prof\.|drg\.)\s*/i, '').replace(/,.*$/, '');
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 3) return words.map(w => w[0].toUpperCase()).join('').slice(0, 4);
    if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
    return clean.slice(0, 4).toUpperCase();
  };

  const getRoleLabel = (patient: Patient) => patient.doctorRole === 'RABER' ? 'Raber' : patient.doctorRole === 'KONSUL' ? 'Konsul' : 'DPJP';
  const getDoctorRoles = (doctor: string) => Array.from(new Set((patients || []).filter(p => p.dpjp === doctor).map(getRoleLabel)));
  const currentTabPatients = useMemo(() => activeTab === 'all' ? (patients || []) : (patients || []).filter(p => p.dpjp === activeTab), [patients, activeTab]);

  const sortedRooms = useMemo(() => {
    const base = allRooms && allRooms.length ? allRooms : MASTER_ROOMS;
    const current = Array.from(new Set(currentTabPatients.map(p => normalizeRoomName(p.room))));
    const custom = current.filter(r => !base.some(b => String(b).toLowerCase() === String(r).toLowerCase()));
    return [...base, ...custom];	
  }, [allRooms, currentTabPatients]);

  const handleCopyWA = async () => {
    const text = generateDocSweepingReportText({ mode: activeTab === 'all' ? 'all' : 'dpjp', date, division, koasName, selectedDpjp: activeTab === 'all' ? undefined : activeTab, patients: currentTabPatients, allRooms: sortedRooms });
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { alert('Teks laporan berhasil disiapkan!'); }
  };

  return <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-slate-800 font-sans">
    <header className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sticky top-0 z-20 shadow-xs print:hidden">
      <div className="flex items-center gap-2"><button onClick={onBackToDashboard} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded-lg"><ArrowLeft className="w-4 h-4" />Kartu</button><div className="h-4 w-px bg-slate-200" /><div><div className="flex items-center gap-1.5"><span className="font-extrabold text-sm sm:text-base text-slate-900">Sweeping {division}</span><span className="text-[10px] bg-teal-50 text-teal-800 font-semibold px-2 py-0.5 rounded-full border border-teal-200">Dokumen</span></div><p className="text-[10px] text-slate-500">{dayName}, {fullDateStr} · {currentTabPatients.length} Pasien</p></div></div>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <button onClick={handleCopyWA} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white min-h-[36px]">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Tersalin!' : 'Salin WA'}</button>
        {onHandoverPatients && <button onClick={onHandoverPatients} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-300 min-h-[36px]"><GitPullRequest className="w-3.5 h-3.5" />Operan</button>}
        <button onClick={() => setIncludeEmptyRooms(!includeEmptyRooms)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50/80 text-teal-800 border border-teal-200 min-h-[36px]"><SlidersHorizontal className="w-3.5 h-3.5" />R. Kosong (0): {includeEmptyRooms ? 'On' : 'Off'}</button>
        {onDeleteAllPatients && patients.length > 0 && (
          <button
            type="button"
            onClick={onDeleteAllPatients}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 min-h-[36px] transition-colors cursor-pointer"
            title="Hapus semua pasien pada hari ini"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Semua</span>
          </button>
        )}
        <button onClick={onAddPatient} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white min-h-[36px] transition-colors shrink-0 shadow-2xs cursor-pointer"><Plus className="w-4 h-4" />Tambah Pasien</button>
      </div>
    </header>

    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto print:hidden sticky top-[53px] z-10">
      <div className="flex items-center gap-1.5"><span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mr-1"><CalendarDays className="w-4 h-4 text-teal-600" />Tab Hari:</span><button onClick={handlePrevDay} className="p-1.5 border border-slate-200 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>{weekDays.map(w => <button key={w.date} onClick={() => onDateChange?.(w.date)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${w.date === date ? 'bg-teal-700 text-white border-teal-700' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>{w.dayName} {w.dayOfMonth}</button>)}<button onClick={handleNextDay} className="p-1.5 border border-slate-200 rounded-lg"><ChevronRight className="w-4 h-4" /></button>{!isCurrentDateToday && <button onClick={handleToday} className="px-2.5 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg">Hari Ini</button>}</div>
      <div className="flex items-center gap-2"><label className="text-xs text-slate-500">Kalender:</label><input type="date" value={date} onChange={e => e.target.value && onDateChange?.(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5" /></div>
    </div>

    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {isSidebarOpen && <aside className="relative fixed inset-y-0 left-0 z-50 md:static md:z-auto w-72 lg:w-80 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col shadow-xl md:shadow-xs print:hidden">
        <button type="button" onClick={() => setIsSidebarOpen(false)} className="hidden md:flex absolute -right-3.5 top-4 z-20 w-7 h-7 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-teal-600" /><span className="font-bold text-xs uppercase tracking-wider">Tab Dokumen</span></div><button type="button" onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 border border-slate-200 rounded-xl"><PanelLeftClose className="w-4 h-4" /></button></div>
        <div className="p-2 space-y-1 overflow-y-auto flex-1">
          <button type="button" onClick={() => setActiveTab('all')} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${activeTab === 'all' ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'hover:bg-slate-100'}`}><span>Semua Pasien</span><span>{patients.length}</span></button>
          <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Dokter ({dpjps.length})</div>
          {dpjps.map(dpjp => { const count = patients.filter(p => p.dpjp === dpjp).length; const roles = getDoctorRoles(dpjp); return <button key={dpjp} type="button" onClick={() => setActiveTab(dpjp)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${activeTab === dpjp ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'hover:bg-slate-100'}`}><div className="flex items-center gap-2 truncate"><span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 shrink-0">{getDpjpInitials(dpjp)}</span><span className="truncate" title={dpjp}>{dpjp}</span><span className="flex gap-1 shrink-0">{(roles.length ? roles : ['DPJP']).map(role => <span key={role} className="text-[8px] uppercase font-bold bg-slate-100 border border-slate-200 rounded px-1 py-0.5">{role}</span>)}</span></div><span>{count}</span></button>; })}
        </div>
      </aside>}
      {!isSidebarOpen && <div className="shrink-0 flex items-start pt-3 pl-2 print:hidden"><button type="button" onClick={() => setIsSidebarOpen(true)} className="w-10 h-10 bg-white border border-slate-200 rounded-2xl flex items-center justify-center"><Menu className="w-5 h-5" /></button></div>}

      <main className="flex-1 overflow-y-auto p-2 sm:p-6 lg:p-10 flex justify-center">
        <div className="bg-white w-full max-w-4xl shadow-md border border-slate-200/80 rounded-sm p-4 sm:p-10 md:p-16 min-h-[900px] text-slate-900 text-sm sm:text-[15px] leading-relaxed relative print:shadow-none print:border-none print:p-0">
          <div className="mb-6 space-y-2 text-slate-800"><p>Selamat pagi, dokter. Mohon maaf mengganggu waktunya, dokter.</p><p>Perkenalkan, dokter, saya <span className="font-semibold">{koasName || 'dr. Muda / Koas Bedah'}</span> selaku dokter muda yang saat ini sedang menjalani stase bedah Divisi <span className="font-semibold">{division}</span>. Mohon izin untuk melaporkan pasien dokter di ruangan rawat inap pada hari ini, dokter. 🙏🏻</p></div>
          <div className="my-5 space-y-1 font-bold"><p>*{dayName}, <span className="text-rose-600">{fullDateStr}</span>*</p><p>*Total pasien: <span className="text-rose-600">{currentTabPatients.length} pasien</span>*</p>{activeTab !== 'all' && <p className="text-teal-800">*{getDoctorRoles(activeTab).join(' / ') || 'DPJP'}: {activeTab}*</p>}</div>
          <div className="my-6 border-b border-slate-200" />
          <div className="space-y-6">
            {sortedRooms.map(roomName => {
              const roomPatients = currentTabPatients.filter(p => normalizeRoomName(p.room).toLowerCase() === roomName.toLowerCase());
              if (!roomPatients.length) return includeEmptyRooms ? <div key={roomName} className="space-y-1.5"><div className="font-bold">*{roomName.toUpperCase()} (0)*</div><div className="text-slate-400 tracking-widest font-mono text-xs">____________________________________________________</div></div> : null;
              return <div key={roomName} className="space-y-2"><div className="font-bold flex items-center justify-between"><span>*{roomName.toUpperCase()} ({roomPatients.length})*</span></div><ol className="space-y-1 list-none pl-0">{roomPatients.map((patient, idx) => {
                const bedOrKamar = formatKamarOrBed(patient.room, patient.kamar);
                const formattedName = formatPatientNameWithHonorific(patient.name, patient.age, patient.jk);
                const role = getRoleLabel(patient);
                const doctorName = patient.dpjp || '-';
                const mainDpjp = patient.supervisingDpjp || '';
                return <li key={patient.id} className="group p-2 -mx-2 rounded-lg hover:bg-teal-50/50 flex items-start justify-between gap-3">
                  <div className="flex-1 leading-tight">
                    <div><span className="font-semibold mr-2">{idx + 1}.</span><span className="font-medium">{bedOrKamar}</span><span className="text-slate-400 mx-1.5">/</span><span className="font-bold">{formattedName}</span><span className="text-slate-400 mx-1.5">/</span><span>{patient.jk || '-'}</span><span className="text-slate-400 mx-1.5">/</span><span>{patient.age || '-'}</span><span className="text-slate-400 mx-1.5">/</span><span className="font-mono text-xs font-semibold">{patient.rm || '-'}</span><span className="text-slate-400 mx-1.5">/</span><span>{patient.dx || '-'}</span></div>
                    <div className="mt-0 pl-0 text-teal-800 font-medium leading-tight">
                      {role === 'DPJP' ? <div><b>DPJP:</b> {doctorName}</div> : <><div><b>DPJP:</b> {mainDpjp || '-'}</div><div><b>{role}:</b> {doctorName}</div></>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditPatient(patient)}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-xs font-semibold text-slate-700 hover:text-teal-700 rounded-lg shadow-2xs shrink-0 cursor-pointer print:hidden"
                    title="Edit data pasien"
                  >
                    <Edit2 className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Edit</span>
                  </button>
                </li>;
              })}</ol></div>;
            })}
          </div>
          <div className="mt-10 pt-6 border-t border-slate-200"><p>Mohon maaf jika terdapat kesalahan, dokter. Terima kasih, dokter. 🙏🏻</p></div>
        </div>
      </main>
    </div>
  </div>;
}
