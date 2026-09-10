/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Patient, PageMode, DivisionTeam, RotationWeek } from './types';
import {
  DIVISIONS,
  DIVISION_CONSULTANTS,
  DEFAULT_ROOMS,
  formatKamarOrBed,
  formatPatientNameWithHonorific
} from './data/constants';
import {
  today,
  getKoasName,
  saveKoasName,
  getCompactMode,
  setCompactMode,
  loadPatients,
  savePatients,
  loadCurrentTeam,
  saveCurrentTeam,
  loadRotationRoster,
  saveRotationRoster,
  findRotationWeekForDate,
  getInitialDivisionFromRotation,
  handoverYesterdayPatients,
  getStorageKey,
  shiftDateByDays,
  formatIndonesianDate,
  isRemovedDoctor
} from './utils/storage';
import {
  subscribeToPatients,
  savePatientsBatch,
  deletePatientFromFirestore,
  upsertPatientToFirestore,
} from './lib/firestoreService';
import type { Unsubscribe } from 'firebase/firestore';

// Component imports
import { Topbar } from './components/Topbar';
import { ControlsBar } from './components/ControlsBar';
import { RotationBanner } from './components/RotationBanner';
import { WeekDaysBar } from './components/WeekDaysBar';
import { PatientCard } from './components/PatientCard';
import { PatientModal } from './components/PatientModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ReportModal } from './components/ReportModal';
import { WeeklyModal } from './components/WeeklyModal';
import { DocumentSweepingView } from './components/DocumentSweepingView';
import { RotationModal } from './components/RotationModal';
import { TeamSwitchModal } from './components/TeamSwitchModal';
import { NextjsRepoModal } from './components/NextjsRepoModal';
import { SettingsModal } from './components/SettingsModal';

import {
  Users,
  UserPlus,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Stethoscope,
  Sparkles,
  Search,
  Settings,
  Minimize2,
  Maximize2
} from 'lucide-react';

export default function App() {
  const [koasName, setKoasNameState] = useState<string>(() => getKoasName());
  const [date, setDate] = useState<string>(() => today());
  const [roster, setRoster] = useState<RotationWeek[]>(() => loadRotationRoster());
  const [division, setDivision] = useState<string>(() => getInitialDivisionFromRotation(today()));
  const [pageMode, setPageMode] = useState<PageMode>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDpjpFilter, setSelectedDpjpFilter] = useState<string>('all');
  const [patients, setPatients] = useState<Patient[]>(() => {
    const initialDiv = getInitialDivisionFromRotation(today());
    return loadPatients(today(), initialDiv);
  });
  const [activeTeam, setActiveTeam] = useState<DivisionTeam>(() => {
    const initialDiv = getInitialDivisionFromRotation(today());
    return loadCurrentTeam(initialDiv);
  });

  const [isPatientModalOpen, setIsPatientModalOpen] = useState<boolean>(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportMode, setReportMode] = useState<'dpjp' | 'all'>('dpjp');
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState<boolean>(false);
  const [isRotationModalOpen, setIsRotationModalOpen] = useState<boolean>(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState<boolean>(false);
  const [isNextjsModalOpen, setIsNextjsModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [compactMode, setCompactModeState] = useState<boolean>(() => getCompactMode());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => setToastMessage(msg), []);

  const handleToggleCompactMode = useCallback(() => {
    setCompactModeState((prev) => {
      const next = !prev;
      setCompactMode(next);
      showToast(next ? 'Mode Ringkas diaktifkan (tampilan lebih padat & hemat ruang)' : 'Mode Ringkas dinonaktifkan (tampilan kartu standar)');
      return next;
    });
  }, [showToast]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const team = loadCurrentTeam(division);
    setActiveTeam(team);
    setSelectedDpjpFilter('all');

    const local = loadPatients(date, division, team.teamCode);
    setPatients(local);

    let unsub: Unsubscribe | null = null;
    if (team.teamCode) {
      unsub = subscribeToPatients(team.teamCode, date, (firestorePatients) => {
        // Firestore is the source of truth. An empty snapshot must clear the UI.
        const normalized = firestorePatients.map((p) => ({
          ...p,
          teamCode: p.teamCode || team.teamCode,
          date: p.date || date,
          division: p.division || division,
        }));
        savePatients(date, division, normalized, team.teamCode);
        setPatients(normalized);
      }, (error) => {
        showToast(`Firebase gagal tersambung: ${error.message}`);
      });
    }

    return () => {
      if (unsub) unsub();
    };
  }, [date, division, showToast]);

  const handleUpdateKoasName = (name: string) => {
    saveKoasName(name);
    setKoasNameState(name);
    showToast(`Nama Koas diubah menjadi: ${name}`);
  };

  const handleSavePatient = (patientData: Patient) => {
    const now = new Date().toISOString();
    const patient: Patient = {
      ...patientData,
      teamCode: activeTeam.teamCode,
      date,
      division,
      updatedAt: now,
    };
    const existingIndex = patients.findIndex((p) => p.id === patient.id);
    const updated = existingIndex >= 0
      ? patients.map((p, i) => i === existingIndex ? patient : p)
      : [patient, ...patients];

    setPatients(updated);
    savePatients(date, division, updated, activeTeam.teamCode);
    setIsPatientModalOpen(false);
    setEditingPatient(null);

    if (activeTeam.teamCode) {
      upsertPatientToFirestore(patient, activeTeam.teamCode, date)
        .then(() => showToast(`Data ${patient.name} tersimpan dan tersinkron ke Firebase.`))
        .catch((error) => showToast(`Gagal sinkron Firebase: ${error.message}`));
    }
  };

  const handleConfirmDelete = (patient: Patient) => {
    const updated = patients.filter((p) => p.id !== patient.id);
    setPatients(updated);
    savePatients(date, division, updated, activeTeam.teamCode);
    setDeletingPatient(null);

    if (activeTeam.teamCode) {
      deletePatientFromFirestore({ ...patient, teamCode: activeTeam.teamCode, date })
        .then(() => showToast(`Data ${patient.name} dihapus dari Firebase.`))
        .catch((error) => showToast(`Gagal menghapus dari Firebase: ${error.message}`));
    } else {
      showToast(`Data ${patient.name} telah dihapus.`);
    }
  };

  const handleQuickSharePatient = async (patient: Patient) => {
    const formattedName = formatPatientNameWithHonorific(patient.name, patient.age, patient.jk);
    const location = formatKamarOrBed(patient.room, patient.kamar);
    const text = `*Data Pasien Sweeping (${division})*\nNama: ${formattedName} (${patient.jk} / ${patient.age || '-'})\nRM: ${patient.rm}\nRuang/Kamar: ${patient.room} - ${location}\nDPJP: ${patient.dpjp}\nDiagnosis: ${patient.dx}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Data ${patient.name} berhasil disalin ke clipboard!`);
    } catch {
      showToast('Gagal menyalin otomatis ke clipboard.');
    }
  };

  const handleHandoverYesterday = () => {
    const result = handoverYesterdayPatients(date, division);
    if (result.addedCount > 0) {
      const refreshed = loadPatients(date, division, activeTeam.teamCode);
      const withFirebaseMeta = refreshed.map((p) => ({ ...p, teamCode: activeTeam.teamCode, date, division }));
      setPatients(withFirebaseMeta);
      if (activeTeam.teamCode) {
        savePatientsBatch(activeTeam.teamCode, date, withFirebaseMeta)
          .then(() => showToast(`Berhasil mengoper ${result.addedCount} pasien dan sinkron ke Firebase.`))
          .catch((error) => showToast(`Operan tersimpan lokal, tetapi Firebase gagal: ${error.message}`));
      } else {
        showToast(`Berhasil mengoper ${result.addedCount} pasien dari hari kemarin!`);
      }
    } else {
      showToast('Tidak ada pasien baru yang perlu dioper (atau data kemarin masih kosong).');
    }
  };

  const handleCopyFromDay = (fromDate: string, dayName: string) => {
    const sourceKey = getStorageKey(fromDate, division);
    const raw = localStorage.getItem(sourceKey);
    if (!raw) {
      showToast(`Data pada hari ${dayName} (${fromDate}) masih kosong.`);
      return;
    }
    try {
      const sourcePatients: Patient[] = JSON.parse(raw);
      if (!Array.isArray(sourcePatients) || sourcePatients.length === 0) {
        showToast(`Tidak ada pasien pada hari ${dayName}.`);
        return;
      }
      const currentRms = new Set(patients.map((p) => p.rm.trim().toLowerCase()));
      const toAdd = sourcePatients
        .filter((p) => !currentRms.has(p.rm.trim().toLowerCase()))
        .map((p) => ({
          ...p,
          id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          teamCode: activeTeam.teamCode,
          date,
          division,
          updatedAt: new Date().toISOString()
        }));
      if (toAdd.length === 0) {
        showToast(`Semua pasien dari hari ${dayName} sudah ada pada daftar hari ini.`);
        return;
      }
      const merged = [...patients, ...toAdd];
      setPatients(merged);
      savePatients(date, division, merged, activeTeam.teamCode);
      if (activeTeam.teamCode) {
        savePatientsBatch(activeTeam.teamCode, date, merged)
          .then(() => showToast(`Berhasil menyalin ${toAdd.length} pasien dan sinkron ke Firebase.`))
          .catch((error) => showToast(`Data disalin lokal, tetapi Firebase gagal: ${error.message}`));
      } else {
        showToast(`Berhasil menyalin ${toAdd.length} pasien dari hari ${dayName}!`);
      }
    } catch {
      showToast('Gagal memproses data salinan.');
    }
  };

  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
    const scheduledWeek = findRotationWeekForDate(newDate, roster);
    if (scheduledWeek && scheduledWeek.division) setDivision(scheduledWeek.division);
  }, [roster]);

  const handleSelectRotationWeek = (week: RotationWeek) => {
    setDate(week.startDate);
    setDivision(week.division);
    const updatedTeam = loadCurrentTeam(week.division);
    setActiveTeam(updatedTeam);
    showToast(`Beralih ke Minggu ${week.weekNumber}: ${week.division}`);
  };

  const handleSaveRoster = (newRoster: RotationWeek[]) => {
    setRoster(newRoster);
    saveRotationRoster(newRoster);
    const activeWeek = findRotationWeekForDate(date, newRoster);
    if (activeWeek && activeWeek.division) {
      setDivision(activeWeek.division);
      const updatedTeam = loadCurrentTeam(activeWeek.division);
      setActiveTeam(updatedTeam);
      showToast(`Jadwal disimpan! Divisi otomatis sinkron ke: ${activeWeek.division} (Minggu ${activeWeek.weekNumber})`);
    } else {
      showToast('Jadwal rotasi 10 pekan berhasil disimpan!');
    }
  };

  const handleSwitchTeam = (newTeam: DivisionTeam, carryOverFromYesterday: boolean) => {
    setActiveTeam(newTeam);
    saveCurrentTeam(newTeam);
    setDivision(newTeam.division);
    const refreshed = loadPatients(date, newTeam.division, newTeam.teamCode);
    setPatients(refreshed);

    if (carryOverFromYesterday) {
      const result = handoverYesterdayPatients(date, newTeam.division, true);
      const afterHandover = loadPatients(date, newTeam.division, newTeam.teamCode);
      const withFirebaseMeta = afterHandover.map((p) => ({ ...p, teamCode: newTeam.teamCode, date, division: newTeam.division }));
      setPatients(withFirebaseMeta);
      if (newTeam.teamCode && withFirebaseMeta.length > 0) {
        savePatientsBatch(newTeam.teamCode, date, withFirebaseMeta).catch((error) => showToast(`Firebase gagal menyimpan operan: ${error.message}`));
      }
      showToast(`Terhubung ke Tim ${newTeam.teamName || newTeam.teamCode}. Dioper ${result.addedCount} pasien!`);
    } else {
      showToast(`Terhubung ke Tim PIN: ${newTeam.teamCode}`);
    }
  };

  const consultants = useMemo(() => {
    const list = DIVISION_CONSULTANTS[division] || [];
    return list.filter((c) => !isRemovedDoctor(c));
  }, [division]);

  const existingDpjps = useMemo(() => {
    const set = new Set<string>();
    consultants.forEach((c) => { if (!isRemovedDoctor(c)) set.add(c); });
    patients.forEach((p) => { if (p.dpjp && p.dpjp.trim() && !isRemovedDoctor(p.dpjp)) set.add(p.dpjp.trim()); });
    return Array.from(set);
  }, [consultants, patients]);

  const filteredPatients = useMemo(() => patients.filter((p) => {
    if (selectedDpjpFilter !== 'all' && p.dpjp !== selectedDpjpFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.rm.toLowerCase().includes(q) || p.dx.toLowerCase().includes(q) || p.dpjp.toLowerCase().includes(q) || p.room.toLowerCase().includes(q) || p.kamar.toLowerCase().includes(q);
  }), [patients, selectedDpjpFilter, searchQuery]);

  const totalCount = patients.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <Topbar koasName={koasName} onUpdateKoasName={handleUpdateKoasName} onAddPatient={() => { setEditingPatient(null); setIsPatientModalOpen(true); }} pageMode={pageMode} onPageModeChange={setPageMode} onOpenNextjsModal={() => setIsNextjsModalOpen(true)} activeTeam={activeTeam} onOpenTeamModal={() => setIsTeamModalOpen(true)} onOpenSettings={() => setIsSettingsModalOpen(true)} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {pageMode === 'document' ? (
          <DocumentSweepingView patients={patients} date={date} division={division} koasName={koasName} dpjps={existingDpjps} allRooms={DEFAULT_ROOMS} onDateChange={handleDateChange} onBackToDashboard={() => setPageMode('dashboard')} onAddPatient={() => { setEditingPatient(null); setIsPatientModalOpen(true); }} onEditPatient={(patient) => { setEditingPatient(patient); setIsPatientModalOpen(true); }} activeTeam={activeTeam} onOpenTeamModal={() => setIsTeamModalOpen(true)} onHandoverPatients={handleHandoverYesterday} />
        ) : (
          <>
            <RotationBanner currentDate={date} currentDivision={division} roster={roster} onSelectWeek={handleSelectRotationWeek} onOpenRosterModal={() => setIsRotationModalOpen(true)} />
            <ControlsBar date={date} division={division} divisions={DIVISIONS} onDateChange={handleDateChange} onDivisionChange={setDivision} searchQuery={searchQuery} onSearchChange={setSearchQuery} onOpenReport={(mode) => { setReportMode(mode); setIsReportModalOpen(true); }} onOpenWeekly={() => setIsWeeklyModalOpen(true)} onOpenRoster={() => setIsRotationModalOpen(true)} onOpenDocumentView={() => setPageMode('document')} activeTeam={activeTeam} onOpenTeamModal={() => setIsTeamModalOpen(true)} onHandoverPatients={handleHandoverYesterday} onAddPatient={() => { setEditingPatient(null); setIsPatientModalOpen(true); }} />
            <WeekDaysBar currentDate={date} division={division} currentPatientCount={patients.length} onSelectDate={handleDateChange} onCopyFromDay={handleCopyFromDay} />
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Users className="w-4 h-4 text-blue-600" /><span>Total {totalCount} Pasien</span></span>{selectedDpjpFilter !== 'all' && <><span className="text-slate-300">|</span><span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">{filteredPatients.length} pasien ({selectedDpjpFilter})</span></>}</div><div className="flex items-center gap-1.5 sm:gap-2"><button type="button" onClick={handleToggleCompactMode} className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${compactMode ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{compactMode ? <><Minimize2 className="w-3.5 h-3.5 text-blue-600" /><span className="hidden sm:inline">Mode Ringkas:</span> <b>Aktif</b></> : <><Maximize2 className="w-3.5 h-3.5 text-slate-400" /><span className="hidden sm:inline">Mode Ringkas:</span> <span>Standar</span></>}</button><button type="button" onClick={() => setIsSettingsModalOpen(true)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer" title="Buka Pengaturan Aplikasi" aria-label="Buka Pengaturan"><Settings className="w-3.5 h-3.5" /></button></div></div>
              <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs"><span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5 text-slate-400" />Filter DPJP:</span><button type="button" onClick={() => setSelectedDpjpFilter('all')} className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all cursor-pointer ${selectedDpjpFilter === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>Semua DPJP ({patients.length})</button>{existingDpjps.map((d) => { const count = patients.filter((p) => p.dpjp === d).length; const isSelected = selectedDpjpFilter === d; return <button key={d} type="button" onClick={() => setSelectedDpjpFilter(d)} className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all cursor-pointer ${isSelected ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>{d.split(',')[0]} ({count})</button>; })}</div>
            </div>
            {filteredPatients.length === 0 ? <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 sm:p-12 text-center flex flex-col items-center justify-center"><div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3"><Users className="w-7 h-7" /></div><h3 className="text-base font-bold text-slate-800">{searchQuery || selectedDpjpFilter !== 'all' ? 'Tidak ada pasien yang sesuai filter' : `Belum ada pasien terdaftar untuk ${division}`}</h3><p className="text-xs text-slate-500 max-w-md mt-1 mb-5">{searchQuery || selectedDpjpFilter !== 'all' ? 'Coba ganti kata kunci pencarian atau pilih filter "Semua DPJP".' : 'Mulai sweeping dengan menambahkan pasien baru atau tarik daftar pasien dari hari sebelumnya.'}</p><div className="flex flex-wrap items-center justify-center gap-2.5"><button type="button" onClick={() => { setEditingPatient(null); setIsPatientModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"><UserPlus className="w-4 h-4" /><span>+ Tambah Pasien Baru</span></button><button type="button" onClick={handleHandoverYesterday} className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"><GitPullRequest className="w-4 h-4 text-amber-600" /><span>Operan Pasien Kemarin</span></button></div></div> : <div className={`grid ${compactMode ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4'}`}>{filteredPatients.map((patient) => <PatientCard key={patient.id} patient={patient} isCompact={compactMode} onEdit={() => { setEditingPatient(patient); setIsPatientModalOpen(true); }} onDelete={() => setDeletingPatient(patient)} onQuickShare={() => handleQuickSharePatient(patient)} />)}</div>}
          </>
        )}
      </main>
      {toastMessage && <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200"><div className="bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-800"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>{toastMessage}</span></div></div>}
      <PatientModal isOpen={isPatientModalOpen} initialData={editingPatient} defaultDpjp={consultants[0] || ''} existingDpjps={existingDpjps} division={division} divisionConsultants={consultants} onClose={() => { setIsPatientModalOpen(false); setEditingPatient(null); }} onSave={handleSavePatient} />
      <DeleteConfirmModal patient={deletingPatient} division={division} date={date} onClose={() => setDeletingPatient(null)} onConfirm={handleConfirmDelete} />
      <ReportModal isOpen={isReportModalOpen} mode={reportMode} date={date} division={division} koasName={koasName} selectedDpjp={selectedDpjpFilter !== 'all' ? selectedDpjpFilter : consultants[0] || ''} patients={patients} onClose={() => setIsReportModalOpen(false)} />
      <WeeklyModal isOpen={isWeeklyModalOpen} currentDate={date} division={division} onClose={() => setIsWeeklyModalOpen(false)} />
      <RotationModal isOpen={isRotationModalOpen} onClose={() => setIsRotationModalOpen(false)} roster={roster} onSaveRoster={handleSaveRoster} currentDate={date} onJumpToWeek={(week) => { handleSelectRotationWeek(week); setIsRotationModalOpen(false); }} />
      <TeamSwitchModal isOpen={isTeamModalOpen} onClose={() => setIsTeamModalOpen(false)} currentTeam={activeTeam} currentDivision={division} koasName={koasName} onSwitchTeam={handleSwitchTeam} />
      <NextjsRepoModal isOpen={isNextjsModalOpen} onClose={() => setIsNextjsModalOpen(false)} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} compactMode={compactMode} onToggleCompactMode={handleToggleCompactMode} koasName={koasName} onUpdateKoasName={handleUpdateKoasName} activeTeam={activeTeam} onOpenTeamModal={() => setIsTeamModalOpen(true)} />
    </div>
  );
}
