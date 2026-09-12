import React, { useState, useMemo } from 'react';
import { Patient } from '../types';
import { MASTER_ROOMS, normalizeRoomName, formatKamarOrBed, formatPatientNameWithHonorific } from '../data/constants';
import { parseDateSafely, generateDocSweepingReportText, getWeekDays, formatDateIso, today } from '../utils/storage';
import { FileText, Copy, Printer, Check, Plus, ArrowLeft, MoreVertical, SlidersHorizontal, ChevronLeft, ChevronRight, CalendarDays, KeyRound, GitPullRequest, Users, PanelLeftClose, Menu, X, Sparkles } from 'lucide-react';
import { DivisionTeam } from '../types';

interface DocumentSweepingViewProps {
  patients: Patient[]; date: string; division: string; koasName: string; dpjps: string[]; allRooms: string[];
  onDateChange?: (newDate: string) => void; onBackToDashboard: () => void; onAddPatient: () => void;
  onEditPatient: (patient: Patient) => void; activeTeam?: DivisionTeam; onOpenTeamModal?: () => void;
  onHandoverPatients?: () => void; onOpenAiImport?: () => void;
}

export function DocumentSweepingView({ patients, date, division, koasName, dpjps, allRooms, onDateChange, onBackToDashboard, onAddPatient, onEditPatient, activeTeam, onOpenTeamModal, onHandoverPatients, onOpenAiImport }: DocumentSweepingViewProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [includeEmptyRooms, setIncludeEmptyRooms] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  const d = parseDateSafely(date);
  const dayName = useMemo(() => { try { return d.toLocaleDateString('id-ID', { weekday: 'long' }); } catch { return 'Hari ini'; } }, [d]);
  const fullDateStr = useMemo(() => { try { return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return date; } }, [d, date]);
  const weekDays = useMemo(() => getWeekDays(date, date), [date]);
  const isCurrentDateToday = useMemo(() => date === today(), [date]);

  const handlePrevDay = () => { const cur = parseDateSafely(date); cur.setDate(cur.getDate() - 1); onDateChange?.(formatDateIso(cur)); };
  const handleNextDay = () => { const cur = parseDateSafely(date); cur.setDate(cur.getDate() + 1); onDateChange?.(formatDateIso(cur)); };
  const handleToday = () => onDateChange?.(today());

  const getDpjpInitials = (dpjpName: string): string => {
    const clean = dpjpName.replace(/^(dr\.|prof\.|drg\.)\s*/i, '').replace(/,.*$/, '');
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 3) return words.map(w => w[0].toUpperCase()).join('').slice(0, 4);
    if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
    return clean.slice(0, 4).toUpperCase();
  };

  const getRoleLabel = (patient?: Patient): string => {
    if (patient?.doctorRole === 'RABER') return 'Raber';
    if (patient?.doctorRole === 'KONSUL') return 'Konsul';
    return 'DPJP';
  };

  const getDoctorRoles = (doctor: string): string[] => {
    const roles = new Set<string>();
    (Array.isArray(patients) ? patients : []).filter(p => p.dpjp === doctor).forEach(p => roles.add(getRoleLabel(p)));
    return roles.size ? Array.from(roles) : ['DPJP'];
  };

  const currentTabPatients = useMemo(() => {
    const list = Array.isArray(patients) ? patients : [];
    return activeTab === 'all' ? list : list.filter(p => p.dpjp === activeTab);
  }, [patients, activeTab]);

  const sortedRooms = useMemo(() => {
    const base = allRooms && allRooms.length > 0 ? allRooms : MASTER_ROOMS;
    const currentRooms = Array.from(new Set((currentTabPatients || []).map(p => normalizeRoomName(p.room))));
    const customList = currentRooms.filter(cr => !base.some(br => br.toLowerCase() === cr.toLowerCase()));
    return [...base, ...customList];
  }, [allRooms, currentTabPatients]);

  const handleCopyWA = async () => {
    const text = generateDocSweepingReportText({ mode: activeTab === 'all' ? 'all' : 'dpjp', date, division, koasName, selectedDpjp: activeTab === 'all' ? undefined : activeTab, patients: currentTabPatients, allRooms: sortedRooms });
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { alert('Teks laporan berhasil disiapkan!'); }
  };
  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 sticky top-0 z-20 shadow-xs print:hidden">
        <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={onBackToDashboard} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer min-h-[36px]" title="Kembali ke Dashboard Kartu Pasien"><ArrowLeft className="w-4 h-4" /><span>Kartu</span></button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div><div className="flex items-center gap-1.5"><span className="font-extrabold text-sm sm:text-base text-slate-900">Sweeping {division}</span><span className="text-[10px] sm:text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">Dokumen</span></div><p className="text-[10px] sm:text-[11px] text-slate-500">{dayName}, {fullDateStr} · {currentTabPatients.length} Pasien</p></div>
          </div>
          <button onClick={onAddPatient} className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 active:bg-blue-700 text-white shadow-xs min-h-[36px] cursor-pointer"><Plus className="w-3.5 h-3.5" /><span>Tambah Pasien</span></button>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 sm:pb-0 w-full sm:w-auto">
          <button onClick={handleCopyWA} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[36px] shrink-0 ${copied ? 'bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`} title="Salin laporan sweeping berformat WhatsApp">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}<span>{copied ? 'Tersalin!' : 'Salin WA'}</span></button>
          {onHandoverPatients && <button onClick={onHandoverPatients} className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 transition-colors shadow-2xs cursor-pointer min-h-[36px] shrink-0" title="Operan pasien dari hari kemarin ke hari ini"><GitPullRequest className="w-3.5 h-3.5 text-amber-600" /><span>Operan</span></button>}
          <button onClick={() => setIncludeEmptyRooms(!includeEmptyRooms)} className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer min-h-[36px] shrink-0 ${includeEmptyRooms ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="Tampilkan semua ruangan lengkap dengan (0)"><SlidersHorizontal className="w-3.5 h-3.5" /><span>R. Kosong (0): {includeEmptyRooms ? 'On' : 'Off'}</span></button>
          {activeTeam && onOpenTeamModal && <button onClick={onOpenTeamModal} className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 transition-colors cursor-pointer min-h-[36px] shrink-0" title="Ganti Tim / Kode PIN Divisi"><KeyRound className="w-3.5 h-3.5 text-blue-600" /><span className="font-mono font-bold">PIN: {activeTeam.teamCode}</span></button>}
          <button onClick={handlePrint} className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer min-h-[36px] shrink-0" title="Cetak Dokumen atau Simpan PDF"><Printer className="w-4 h-4 text-slate-500" /><span className="hidden sm:inline">Cetak</span></button>
          {onOpenAiImport && <button onClick={onOpenAiImport} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs cursor-pointer min-h-[36px] shrink-0" title="Ekstrak & Impor Catatan Pasien dengan AI"><Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" /><span>AI Impor</span></button>}
          <button onClick={onAddPatient} className="hidden sm:flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-black text-white transition-colors shadow-xs cursor-pointer min-h-[36px] shrink-0"><Plus className="w-4 h-4" /><span>Tambah Pasien</span></button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto print:hidden shadow-xs sticky top-[53px] z-10">
        <div className="flex items-center gap-1.5 shrink-0"><span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mr-1"><CalendarDays className="w-4 h-4 text-blue-600" /><span className="hidden sm:inline">Tab Hari:</span></span>
          <button onClick={handlePrevDay} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer" title="Hari Sebelumnya (H-1)"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex items-center gap-1">{(weekDays || []).map(w => { const isSelected = w.date === date; return <button key={w.date} onClick={() => onDateChange?.(w.date)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${isSelected ? 'bg-blue-600 text-white shadow-xs font-bold' : w.isToday ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'}`} title={`${w.dayName}, ${w.date}`}><span>{w.dayName}</span><span className={`text-[11px] px-1.5 py-0.2 rounded font-mono ${isSelected ? 'bg-blue-700 text-white' : 'bg-white/80 text-slate-600'}`}>{w.dayOfMonth}</span>{w.isToday && !isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" title="Hari Ini" />}</button>; })}</div>
          <button onClick={handleNextDay} className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer" title="Hari Berikutnya (H+1)"><ChevronRight className="w-4 h-4" /></button>
          {!isCurrentDateToday && <button onClick={handleToday} className="ml-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer">Hari Ini</button>}
        </div>
        <div className="flex items-center gap-2 shrink-0"><label className="text-xs text-slate-500 font-medium hidden md:inline">Kalender:</label><input type="date" value={date} onChange={e => e.target.value && onDateChange?.(e.target.value)} className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer" title="Pilih tanggal khusus" /></div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="md:hidden bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto print:hidden shadow-2xs shrink-0">
          <button type="button" onClick={() => setActiveTab('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors min-h-[36px] ${activeTab === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}><FileText className="w-3.5 h-3.5" /><span>Semua Pasien ({patients.length})</span></button>
          {(dpjps || []).map(dpjp => { const count = (Array.isArray(patients) ? patients : []).filter(p => p.dpjp === dpjp).length; const isActive = activeTab === dpjp; return <button key={dpjp} type="button" onClick={() => setActiveTab(dpjp)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors min-h-[36px] ${isActive ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}><span>{dpjp}</span><span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>{count}</span></button>; })}
        </div>

        {isSidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden="true" />}
        {!isSidebarOpen && <div className="shrink-0 flex items-start pt-3 pl-2 sm:pl-3 z-30 print:hidden"><button type="button" onClick={() => setIsSidebarOpen(true)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 active:scale-95 text-slate-800 border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer" title="Buka Sidebar" aria-label="Buka Sidebar"><Menu className="w-5 h-5 text-slate-800" strokeWidth={2.2} /></button></div>}

        {isSidebarOpen && <aside className="relative fixed inset-y-0 left-0 z-50 md:static md:z-auto w-72 lg:w-80 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col shadow-xl md:shadow-xs print:hidden animate-in slide-in-from-left-2 duration-150">
          <button type="button" onClick={() => setIsSidebarOpen(false)} className="hidden md:flex absolute -right-3.5 top-4 z-20 w-7 h-7 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-full shadow-xs items-center justify-center text-slate-500 hover:text-blue-600 transition-all cursor-pointer" title="Tutup Sidebar"><ChevronLeft className="w-4 h-4" /></button>
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /><span className="font-bold text-xs uppercase tracking-wider text-slate-700">Tab Dokumen</span></div><div className="flex items-center gap-1.5"><button type="button" onClick={onAddPatient} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Tambah Pasien Baru"><Plus className="w-4 h-4" /></button><button type="button" onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-100 active:scale-95 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl shadow-2xs transition-all cursor-pointer" title="Tutup Sidebar" aria-label="Tutup Sidebar"><PanelLeftClose className="w-4 h-4 text-slate-700" /></button></div></div>
          <div className="p-2 space-y-1 overflow-y-auto flex-1">
            <button type="button" onClick={() => { setActiveTab('all'); if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${activeTab === 'all' ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs' : 'text-slate-700 hover:bg-slate-100 border border-transparent'}`}><div className="flex items-center gap-2.5 truncate"><FileText className={`w-4 h-4 shrink-0 ${activeTab === 'all' ? 'text-blue-600' : 'text-slate-400'}`} /><div className="truncate"><div className="font-bold">Semua Pasien</div><div className="text-[10px] text-slate-400 font-normal">Seluruh Divisi {division}</div></div></div><span className={`text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 ${activeTab === 'all' ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-600'}`}>{patients.length}</span></button>
            <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Dokter ({(dpjps || []).length})</div>
            {(dpjps || []).map(dpjp => { const count = (Array.isArray(patients) ? patients : []).filter(p => p.dpjp === dpjp).length; const isActive = activeTab === dpjp; const initials = getDpjpInitials(dpjp); const roles = getDoctorRoles(dpjp); return <button key={dpjp} type="button" onClick={() => { setActiveTab(dpjp); if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${isActive ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs' : 'text-slate-700 hover:bg-slate-100 border border-transparent'}`}><div className="flex items-center gap-2.5 truncate"><span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>{initials}</span><span className="truncate font-medium" title={dpjp}>{dpjp}</span><span className="flex gap-1 shrink-0">{roles.map(role => <span key={role} className="text-[8px] uppercase tracking-wide font-bold bg-slate-100 text-slate-500 border border-slate-200 rounded px-1 py-0.5">{role}</span>)}</span></div><div className="flex items-center gap-1 shrink-0"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-blue-200 text-blue-900' : count > 0 ? 'bg-slate-100 text-slate-700 font-bold' : 'text-slate-400'}`}>{count}</span>{isActive && <MoreVertical className="w-3.5 h-3.5 text-blue-500 ml-1" />}</div></button>; })}
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 shrink-0"><div>Aktif: <b className="text-slate-800">{activeTab === 'all' ? 'Semua Pasien' : activeTab}</b></div><div className="text-[10px] text-slate-400 mt-0.5">Peran dokter ditampilkan mengikuti data pasien.</div></div>
        </aside>}

        <main className="flex-1 overflow-y-auto p-2 sm:p-6 lg:p-10 flex justify-center">
          <div className="bg-white w-full max-w-4xl shadow-md border border-slate-200/80 rounded-sm p-4 sm:p-10 md:p-16 min-h-[900px] text-slate-900 font-sans text-sm sm:text-[15px] leading-relaxed relative print:shadow-none print:border-none print:p-0">
            <div className="mb-6 space-y-2 text-slate-800"><p>Selamat pagi, dokter. Mohon maaf mengganggu waktunya, dokter.</p><p>Perkenalkan, dokter, saya <span className="font-semibold text-slate-900">{koasName || 'dr. Muda / Koas Bedah'}</span> selaku dokter muda yang saat ini sedang menjalani stase bedah Divisi <span className="font-semibold text-slate-900">{division}</span>. Mohon izin untuk melaporkan pasien dokter di ruangan rawat inap pada hari ini, dokter. 🙏🏻</p></div>
            <div className="my-5 space-y-1 font-bold"><p className="text-slate-900">*{dayName}, <span className="text-rose-600">{fullDateStr}</span>*</p><p className="text-slate-900">*Total pasien: <span className="text-rose-600">{currentTabPatients.length} pasien</span>*</p>{activeTab !== 'all' && <p className="text-blue-700">*{getDoctorRoles(activeTab).join(' / ')}: {activeTab}*</p>}</div>
            <div className="my-6 border-b border-slate-200" />
            <div className="space-y-6">
              {(sortedRooms || []).map(roomName => {
                const roomPatients = (currentTabPatients || []).filter(p => normalizeRoomName(p.room).toLowerCase() === roomName.toLowerCase());
                if (roomPatients.length === 0) {
                  if (!includeEmptyRooms) return null;
                  return <div key={roomName} className="space-y-1.5"><div className="font-bold text-slate-900 tracking-wide">*{roomName.toUpperCase()} (0)*</div><div className="text-slate-400 select-none tracking-widest font-mono text-xs">____________________________________________________</div></div>;
                }
                return <div key={roomName} className="space-y-2"><div className="font-bold text-slate-900 flex items-center justify-between"><span>*{roomName.toUpperCase()} ({roomPatients.length})*</span></div><ol className="space-y-2 list-none pl-0">{roomPatients.map((patient, idx) => {
                  const bedOrKamar = formatKamarOrBed(patient.room, patient.kamar);
                  const formattedName = formatPatientNameWithHonorific(patient.name, patient.age, patient.jk);
                  const roleLabel = getRoleLabel(patient);
                  return <li key={patient.id} className="group p-2 -mx-2 rounded-lg hover:bg-blue-50/60 transition-colors flex items-start justify-between gap-3 text-slate-800"><div className="flex-1 leading-relaxed"><span className="font-semibold text-slate-900 mr-2">{idx + 1}.</span><span className="font-medium text-slate-900">{bedOrKamar}</span><span className="text-slate-400 mx-1.5">/</span><span className="font-bold text-slate-900">{formattedName}</span><span className="text-slate-400 mx-1.5">/</span><span>{patient.jk}</span><span className="text-slate-400 mx-1.5">/</span><span>{patient.age}</span><span className="text-slate-400 mx-1.5">/</span><span className="font-mono text-xs text-slate-700 font-semibold">{patient.rm}</span><span className="text-slate-400 mx-1.5">/</span><span className="text-slate-800">{patient.dx}</span><span className="text-blue-700 font-medium ml-2">[{roleLabel}: {patient.dpjp}]</span></div><button onClick={() => onEditPatient(patient)} className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-blue-600 rounded shadow-2xs transition-all shrink-0 cursor-pointer print:hidden" title="Edit Pasien Ini">Edit</button></li>;
                })}</ol></div>;
              })}
            </div>
            <div className="mt-10 pt-6 border-t border-slate-200 text-slate-800"><p>Mohon maaf jika terdapat kesalahan, dokter. Terima kasih, dokter. 🙏🏻</p></div>
          </div>
        </main>
      </div>
    </div>
  );
}
