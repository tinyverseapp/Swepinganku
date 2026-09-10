/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Patient, PageMode, DivisionTeam } from './types';
import {
  DIVISIONS,
  DIVISION_CONSULTANTS,
  DEFAULT_ROOMS,
  formatKamarOrBed,
  formatPatientNameWithHonorific,
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
  handoverYesterdayPatients,
  getStorageKey,
  isRemovedDoctor,
} from './utils/storage';
import { getSavedActiveTeam } from './utils/teamRegistry';
import {
  subscribeToPatients,
  savePatientsBatch,
  deletePatientFromFirestore,
  upsertPatientToFirestore,
} from './lib/firestoreService';
import type { Unsubscribe } from 'firebase/firestore';

import { Topbar } from './components/Topbar';
import { ControlsBar } from './components/ControlsBar';
import { WeekDaysBar } from './components/WeekDaysBar';
import { PatientCard } from './components/PatientCard';
import { PatientModal } from './components/PatientModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ReportModal } from './components/ReportModal';
import { WeeklyModal } from './components/WeeklyModal';
import { DocumentSweepingView } from './components/DocumentSweepingView';
import { TeamSwitchModal } from './components/TeamSwitchModal';
import { NextjsRepoModal } from './components/NextjsRepoModal';
import { SettingsModal } from './components/SettingsModal';
import { TeamMembersPanel } from './components/TeamMembersPanel';
import {
  Users,
  UserPlus,
  GitPullRequest,
  CheckCircle2,
  Stethoscope,
  Settings,
  Minimize2,
  Maximize2,
} from 'lucide-react';

const EMPTY_TEAM: DivisionTeam = {
  teamCode: '',
  division: '',
  teamName: '',
  members: [],
};

function getInitialTeam(): DivisionTeam {
  return getSavedActiveTeam() || EMPTY_TEAM;
}

export default function App() {
  const initialTeam = getInitialTeam();
  const [koasName, setKoasNameState] = useState<string>(() => getKoasName());
  const [date, setDate] = useState<string>(() => today());
  const [division, setDivision] = useState<string>(() => initialTeam.division || '');
  const [pageMode, setPageMode] = useState<PageMode>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDpjpFilter, setSelectedDpjpFilter] = useState('all');
  const [patients, setPatients] = useState<Patient[]>(() => (
    initialTeam.teamCode && initialTeam.division ? loadPatients(today(), initialTeam.division, initialTeam.teamCode) : []
  ));
  const [activeTeam, setActiveTeam] = useState<DivisionTeam>(initialTeam);

  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportMode, setReportMode] = useState<'dpjp' | 'all'>('dpjp');
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isNextjsModalOpen, setIsNextjsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [compactMode, setCompactModeState] = useState(() => getCompactMode());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => setToastMessage(msg), []);

  const handleToggleCompactMode = useCallback(() => {
    setCompactModeState((prev) => {
      const next = !prev;
      setCompactMode(next);
      showToast(next ? 'Mode Ringkas diaktifkan.' : 'Mode Ringkas dinonaktifkan.');
      return next;
    });
  }, [showToast]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Divisi dan data sekarang sepenuhnya mengikuti tim yang pernah di-join.
  // Tidak ada lagi perubahan divisi otomatis berdasarkan tanggal/jadwal rotasi.
  useEffect(() => {
    if (!division || !activeTeam.teamCode) {
      setPatients([]);
      setSelectedDpjpFilter('all');
      return;
    }

    const local = loadPatients(date, division, activeTeam.teamCode);
    setPatients(local);
    setSelectedDpjpFilter('all');

    const unsub: Unsubscribe = subscribeToPatients(
      activeTeam.teamCode,
      date,
      (firestorePatients) => {
        const normalized = firestorePatients.map((p) => ({
          ...p,
          teamCode: p.teamCode || activeTeam.teamCode,
          date: p.date || date,
          division: p.division || division,
        }));
        savePatients(date, division, normalized, activeTeam.teamCode);
        setPatients(normalized);
      },
      (error) => showToast(`Firebase gagal tersambung: ${error.message}`),
    );

    return () => unsub();
  }, [date, division, activeTeam.teamCode, showToast]);

  const handleUpdateKoasName = (name: string) => {
    saveKoasName(name);
    setKoasNameState(name);
    showToast(`Nama Koas diubah menjadi: ${name}`);
  };

  const handleSavePatient = (patientData: Patient) => {
    const patient: Patient = {
      ...patientData,
      teamCode: activeTeam.teamCode,
      date,
      division,
      updatedAt: new Date().toISOString(),
    };
    const existingIndex = patients.findIndex((p) => p.id === patient.id);
    const updated = existingIndex >= 0
      ? patients.map((p, index) => index === existingIndex ? patient : p)
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
    if (!division || !activeTeam.teamCode) {
      showToast('Silakan bergabung ke tim terlebih dahulu.');
      return;
    }
    const result = handoverYesterdayPatients(date, division);
    if (result.addedCount > 0) {
      const refreshed = loadPatients(date, division, activeTeam.teamCode);
      const withFirebaseMeta = refreshed.map((p) => ({ ...p, teamCode: activeTeam.teamCode, date, division }));
      setPatients(withFirebaseMeta);
      savePatientsBatch(activeTeam.teamCode, date, withFirebaseMeta)
        .then(() => showToast(`Berhasil mengoper ${result.addedCount} pasien dan sinkron ke Firebase.`))
        .catch((error) => showToast(`Operan tersimpan lokal, tetapi Firebase gagal: ${error.message}`));
    } else {
      showToast('Tidak ada pasien baru yang perlu dioper.');
    }
  };

  const handleCopyFromDay = (fromDate: string, dayName: string) => {
    const raw = localStorage.getItem(getStorageKey(fromDate, division, activeTeam.teamCode));
    if (!raw) {
      showToast(`Data pada hari ${dayName} (${fromDate}) masih kosong.`);
      return;
    }
    try {
      const sourcePatients: Patient[] = JSON.parse(raw);
      const currentRms = new Set(patients.map((p) => p.rm.trim().toLowerCase()));
      const toAdd = sourcePatients
        .filter((p) => !currentRms.has(p.rm.trim().toLowerCase()))
        .map((p) => ({ ...p, id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, teamCode: activeTeam.teamCode, date, division, updatedAt: new Date().toISOString() }));
      if (!toAdd.length) {
        showToast(`Semua pasien dari hari ${dayName} sudah ada.`);
        return;
      }
      const merged = [...patients, ...toAdd];
      setPatients(merged);
      savePatients(date, division, merged, activeTeam.teamCode);
      savePatientsBatch(activeTeam.teamCode, date, merged)
        .then(() => showToast(`Berhasil menyalin ${toAdd.length} pasien dan sinkron ke Firebase.`))
        .catch((error) => showToast(`Data disalin lokal, tetapi Firebase gagal: ${error.message}`));
    } catch {
      showToast('Gagal memproses data salinan.');
    }
  };

  const handleDateChange = useCallback((newDate: string) => {
    // Tanggal hanya mengubah hari data, tidak pernah mengubah divisi.
    setDate(newDate);
  }, []);

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
      if (newTeam.teamCode && withFirebaseMeta.length) {
        savePatientsBatch(newTeam.teamCode, date, withFirebaseMeta).catch((error) => showToast(`Firebase gagal menyimpan operan: ${error.message}`));
      }
      showToast(`Terhubung ke Tim ${newTeam.teamName || newTeam.teamCode}. Dioper ${result.addedCount} pasien.`);
    } else {
      showToast(`Terhubung ke Tim ${newTeam.teamName || newTeam.teamCode}.`);
    }
  };

  const consultants = useMemo(() => {
    return (DIVISION_CONSULTANTS[division] || []).filter((c) => !isRemovedDoctor(c));
  }, [division]);

  const existingDpjps = useMemo(() => {
    const set = new Set<string>();
    consultants.forEach((c) => set.add(c));
    patients.forEach((p) => { if (p.dpjp?.trim() && !isRemovedDoctor(p.dpjp)) set.add(p.dpjp.trim()); });
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
      <Topbar
        koasName={koasName}
        onUpdateKoasName={handleUpdateKoasName}
        onAddPatient={() => { setEditingPatient(null); setIsPatientModalOpen(true); }}
        pageMode={pageMode}
        onPageModeChange={setPageMode}
        onOpenNextjsModal={() => setIsNextjsModalOpen(true)}
        activeTeam={activeTeam}
        onOpenTeamModal={() => setIsTeamModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      <TeamMembersPanel />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {pageMode === 'document' ? (
          <DocumentSweepingView
            patients={patients}
            date={date}
            division={division}
            koasName={koasName}
            dpjps={existingDpjps}
            allRooms={DEFAULT_ROOMS}
            onDateChange={handleDateChange}
            onBackToDashboard={() => setPageMode('dashboard')}
            onAddPatient={() => { setEditingPatient(null); setIsPatientModalOpen(true); }}
            onEditPatient={(patient) => { setEditingPatient(patient); setIsPatientModalOpen(true); }}
            activeTeam={activeTeam}
            onOpenTeamModal={() => setIsTeamModalOpen(true)}
            onHandoverPatients={handleHandoverYesterday}
          />
        ) : (
          <>
            <ControlsBar
              date={date}
              division={division}
              divisions={DIVISIONS}
              onDateChange={handleDateChange}
              onDivisionChange={(nextDivision) => {
                const joined = activeTeam.division === nextDivision || nextDivision === division;
                if (joined) setDivision(nextDivision);
              }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenWeekly={() => setIsWeeklyModalOpen(true)}
              activeTeam={activeTeam}
              onOpenTeamModal={() => setIsTeamModalOpen(true)}
              onHandoverPatients={handleHandoverYesterday}
              onAddPatient={() => { setEditingPatient(null); setIsPatientModalOpen(true); }}
            />
            <WeekDaysBar currentDate={date} division={division} currentPatientCount={patients.length} onSelectDate={handleDateChange} onCopyFromDay={handleCopyFromDay} />

            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Users className="w-4 h-4 text-blue-600" /><span>Total {totalCount} Pasien</span></span>
                  {selectedDpjpFilter !== 'all' && <><span className="text-slate-300">|</span><span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">{filteredPatients.length} pasien ({selectedDpjpFilter})</span></>}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button type="button" onClick={handleToggleCompactMode} className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${compactMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                    {compactMode ? <><Minimize2 className="w-3.5 h-3.5 text-blue-600" /><span className="hidden sm:inline">Mode Ringkas:</span><b>Aktif</b></> : <><Maximize2 className="w-3.5 h-3.5 text-slate-400" /><span className="hidden sm:inline">Mode Ringkas:</span><span>Standar</span></>}
                  </button>
                  <button type="button" onClick={() => setIsSettingsModalOpen(true)} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer" title="Buka Pengaturan"><Settings className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" />Filter DPJP:</span>
                <button type="button" onClick={() => setSelectedDpjpFilter('all')} className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 cursor-pointer ${selectedDpjpFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Semua DPJP ({patients.length})</button>
                {existingDpjps.map((d) => {
                  const count = patients.filter((p) => p.dpjp === d).length;
                  return <button key={d} type="button" onClick={() => setSelectedDpjpFilter(d)} className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 cursor-pointer ${selectedDpjpFilter === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{d.split(',')[0]} ({count})</button>;
                })}
              </div>
            </div>

            {filteredPatients.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 sm:p-12 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3"><Users className="w-7 h-7" /></div>
                <h3 className="text-base font-bold text-slate-800">{!activeTeam.teamCode ? 'Belum bergabung ke tim' : searchQuery || selectedDpjpFilter !== 'all' ? 'Tidak ada pasien yang sesuai filter' : `Belum ada pasien terdaftar untuk ${division}`}</h3>
                <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">{!activeTeam.teamCode ? 'Bergabunglah ke tim menggunakan PIN agar divisi dan data pasien tersedia.' : searchQuery || selectedDpjpFilter !== 'all' ? 'Coba ganti kata kunci pencarian atau pilih filter "Semua DPJP".' : 'Mulai sweeping dengan menambahkan pasien baru atau tarik daftar pasien dari hari sebelumnya.'}</p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button type="button" onClick={() => setIsTeamModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer"><UserPlus className="w-4 h-4" /><span>{activeTeam.teamCode ? 'Ganti / Masuk Tim' : 'Gabung Tim'}</span></button>
                  {activeTeam.teamCode && <><button type="button" onClick={() => { setEditingPatient(null); setIsPatientModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl cursor-pointer"><UserPlus className="w-4 h-4" /><span>+ Tambah Pasien Baru</span></button><button type="button" onClick={handleHandoverYesterday} className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl cursor-pointer"><GitPullRequest className="w-4 h-4 text-amber-600" /><span>Operan Pasien Kemarin</span></button></>}
                </div>
              </div>
            ) : (
              <div className={`grid ${compactMode ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4'}`}>
                {filteredPatients.map((patient) => <PatientCard key={patient.id} patient={patient} isCompact={compactMode} onEdit={() => { setEditingPatient(patient); setIsPatientModalOpen(true); }} onDelete={() => setDeletingPatient(patient)} onQuickShare={() => handleQuickSharePatient(patient)} />)}
              </div>
            )}
          </>
        )}
      </main>

      {toastMessage && <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5"><div className="bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /><span>{toastMessage}</span></div></div>}

      <PatientModal isOpen={isPatientModalOpen} initialData={editingPatient} defaultDpjp={consultants[0] || ''} existingDpjps={existingDpjps} division={division} divisionConsultants={consultants} onClose={() => { setIsPatientModalOpen(false); setEditingPatient(null); }} onSave={handleSavePatient} />
      <DeleteConfirmModal patient={deletingPatient} division={division} date={date} onClose={() => setDeletingPatient(null)} onConfirm={handleConfirmDelete} />
      <ReportModal isOpen={isReportModalOpen} mode={reportMode} date={date} division={division} koasName={koasName} selectedDpjp={selectedDpjpFilter !== 'all' ? selectedDpjpFilter : consultants[0] || ''} patients={patients} onClose={() => setIsReportModalOpen(false)} />
      <WeeklyModal isOpen={isWeeklyModalOpen} currentDate={date} division={division} onClose={() => setIsWeeklyModalOpen(false)} />
      <TeamSwitchModal isOpen={isTeamModalOpen} onClose={() => setIsTeamModalOpen(false)} currentTeam={activeTeam} currentDivision={division} koasName={koasName} onSwitchTeam={handleSwitchTeam} />
      <NextjsRepoModal isOpen={isNextjsModalOpen} onClose={() => setIsNextjsModalOpen(false)} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} compactMode={compactMode} onToggleCompactMode={handleToggleCompactMode} koasName={koasName} onUpdateKoasName={handleUpdateKoasName} activeTeam={activeTeam} onOpenTeamModal={() => setIsTeamModalOpen(true)} />
    </div>
  );
}
