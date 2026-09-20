import React, { useEffect, useState } from 'react';
import { DivisionTeam } from '../types';
import { DIVISIONS, generateDivisionPin } from '../data/constants';
import { saveJoinedTeam, loadJoinedTeams, removeJoinedTeam } from '../utils/teamRegistry';
import { today } from '../utils/storage';
import { getCurrentWeekRange, getTeam, createOrUpdateTeam } from '../lib/teamService';
import { syncUserTeamToFirebase, removeUserTeamFromFirebase } from '../lib/teamMembersService';
import { auth } from '../lib/firebase';
import {
  Users,
  KeyRound,
  Copy,
  Check,
  X,
  RefreshCw,
  ArrowLeftRight,
  ShieldCheck,
  CalendarDays,
  Plus,
  LogIn,
  ArrowLeft,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { getDivisionColorTheme } from '../utils/divisionColors';

interface TeamSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeam: DivisionTeam;
  currentDivision: string;
  koasName: string;
  onSwitchTeam: (newTeam: DivisionTeam, carryOverFromYesterday: boolean) => void;
  onLeaveTeam?: (teamCode: string) => Promise<void> | void;
}

function previousWeekStart(weekStart: string) {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function friendlyTeamError(err: unknown) {
  const code = (err as { code?: string })?.code;
  const message = err instanceof Error ? err.message : String(err || '');
  if (code === 'permission-denied' || /missing or insufficient permissions/i.test(message)) {
    return 'Firebase menolak akses ke data tim. Pastikan Rules Firestore terbaru sudah ter-deploy.';
  }
  return message || 'Gagal bergabung atau membuat tim.';
}

export function TeamSwitchModal({
  isOpen,
  onClose,
  currentTeam,
  currentDivision,
  koasName,
  onSwitchTeam,
  onLeaveTeam
}: TeamSwitchModalProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [selectedDivision, setSelectedDivision] = useState(currentDivision || DIVISIONS[0] || '');
  const [teamCodeInput, setTeamCodeInput] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [memberNameInput, setMemberNameInput] = useState(koasName);
  const [weekDate, setWeekDate] = useState(today());
  const [joinPreview, setJoinPreview] = useState<DivisionTeam | null>(null);
  const [carryOver, setCarryOver] = useState(true);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Daftar tim yang telah dimasuki & modal keluar tim
  const [joinedTeams, setJoinedTeams] = useState<DivisionTeam[]>([]);
  const [teamToLeave, setTeamToLeave] = useState<DivisionTeam | null>(null);
  const [leavingBusy, setLeavingBusy] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  const currentTeamTheme = getDivisionColorTheme(currentTeam?.division);
  const selectedDivTheme = getDivisionColorTheme(selectedDivision);

  useEffect(() => {
    if (isOpen) {
      setMode('choose');
      setSelectedDivision(currentDivision || DIVISIONS[0] || '');
      setTeamCodeInput('');
      setTeamNameInput(`Tim ${currentDivision || DIVISIONS[0] || ''}`);
      setMemberNameInput(koasName);
      setWeekDate(today());
      setJoinPreview(null);
      setError('');
      setBusy(false);
      setJoinedTeams(loadJoinedTeams());
      setTeamToLeave(null);
      setLeavingBusy(false);
      setLeaveError('');
    }
  }, [isOpen, currentDivision, koasName]);

  if (!isOpen) return null;
  const week = getCurrentWeekRange(weekDate);

  const goMode = (next: 'create' | 'join') => {
    setMode(next);
    setError('');
    setJoinPreview(null);
    setTeamCodeInput(next === 'create' ? generateDivisionPin(selectedDivision) : '');
    setTeamNameInput(next === 'create' ? `Tim ${selectedDivision}` : '');
  };

  const handleDivisionChange = (division: string) => {
    setSelectedDivision(division);
    setTeamCodeInput(generateDivisionPin(division));
    setTeamNameInput(`Tim ${division}`);
  };

  const handleRandomPin = () => {
    setTeamCodeInput(generateDivisionPin(selectedDivision));
  };

  const handleJoinPreview = async () => {
    const cleanCode = teamCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setError('Masukkan PIN tim terlebih dahulu.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const team = await getTeam(cleanCode);
      if (!team) throw new Error(`Tim dengan PIN ${cleanCode} tidak ditemukan.`);
      setJoinPreview(team);
    } catch (err) {
      setError(friendlyTeamError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const cleanMember = memberNameInput.trim() || koasName || 'Pengguna';
      let finalTeam: DivisionTeam;

      if (mode === 'join') {
        const cleanCode = teamCodeInput.trim().toUpperCase();
        const existing = joinPreview || (await getTeam(cleanCode));
        if (!existing) throw new Error(`Tim dengan PIN ${cleanCode} tidak ditemukan.`);
        const previous = existing.weekStart ? previousWeekStart(existing.weekStart) : '';
        const duplicate = loadJoinedTeams().find(
          (team) =>
            team.division === existing.division &&
            !!team.weekStart &&
            !!existing.weekStart &&
            (team.weekStart === existing.weekStart || team.weekStart === previous)
        );
        if (duplicate && duplicate.teamCode !== existing.teamCode) {
          throw new Error(
            `Divisi ${existing.division} sudah dipakai akun ini pada pekan ${duplicate.weekStart}. Pekan berikutnya harus memakai divisi berbeda.`
          );
        }
        finalTeam = {
          ...existing,
          teamCode: cleanCode,
          members: Array.from(new Set([...(existing.members || []), cleanMember]))
        };
      } else {
        let cleanCode = teamCodeInput.trim().toUpperCase() || generateDivisionPin(selectedDivision);
        const cleanName = teamNameInput.trim() || `Tim ${selectedDivision}`;
        let existing = await getTeam(cleanCode);
        if (existing && !teamCodeInput.trim()) {
          for (let attempt = 0; attempt < 5; attempt++) {
            cleanCode = generateDivisionPin(selectedDivision);
            existing = await getTeam(cleanCode);
            if (!existing) break;
          }
        }
        if (existing) {
          throw new Error(
            `PIN ${cleanCode} sudah digunakan. Klik tombol "Acak PIN" untuk mendapatkan PIN baru, atau pilih menu "Gabung ke Tim".`
          );
        }
        finalTeam = {
          teamCode: cleanCode,
          division: selectedDivision,
          teamName: cleanName,
          members: [cleanMember],
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        finalTeam = await createOrUpdateTeam(finalTeam, true);
      }

      saveJoinedTeam(finalTeam);
      localStorage.setItem('sweepinganku:activeTeam', JSON.stringify(finalTeam));
      if (auth.currentUser?.uid && finalTeam.teamCode) {
        syncUserTeamToFirebase(
          auth.currentUser.uid,
          finalTeam.teamCode,
          true,
          auth.currentUser.displayName || memberNameInput.trim() || koasName,
          auth.currentUser.email || ''
        ).catch(() => {});
      }
      onSwitchTeam(finalTeam, carryOver);
      onClose();
    } catch (err) {
      setError(friendlyTeamError(err));
    } finally {
      setBusy(false);
    }
  };

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(currentTeam.teamCode || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleSelectJoinedTeam = (team: DivisionTeam) => {
    onSwitchTeam(team, false);
    onClose();
  };

  const handleConfirmLeave = async () => {
    if (!teamToLeave) return;
    setLeavingBusy(true);
    setLeaveError('');
    try {
      const code = teamToLeave.teamCode;
      if (onLeaveTeam) {
        await onLeaveTeam(code);
      } else {
        if (auth.currentUser?.uid) {
          await removeUserTeamFromFirebase(auth.currentUser.uid, code, '', memberNameInput);
        }
        removeJoinedTeam(code);
      }
      const updated = loadJoinedTeams();
      setJoinedTeams(updated);
      setTeamToLeave(null);

      // Jika yang dikeluarkan adalah tim aktif dan tidak ada tim lain, tutup modal
      if (code.trim().toUpperCase() === currentTeam.teamCode?.trim().toUpperCase()) {
        if (updated.length === 0) {
          onClose();
        }
      }
    } catch (err) {
      setLeaveError(friendlyTeamError(err));
    } finally {
      setLeavingBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col relative">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-slate-900">Gabung / Kelola Tim</h2>
              <p className="text-[11px] text-slate-500">Buat tim, gabung tim stase, atau kelola keanggotaan tim Anda.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {currentTeam?.teamCode && mode === 'choose' && (
            <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${currentTeamTheme.bannerBg}`}>
              <div className="min-w-0">
                <div className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 ${currentTeamTheme.text}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />Tim Sedang Aktif
                </div>
                <div className="font-extrabold text-sm text-slate-900 truncate mt-1">
                  {currentTeam.teamName || currentTeam.division}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: currentTeamTheme.hex }} />
                  <span>{currentTeam.division} · PIN <strong className="font-mono">{currentTeam.teamCode}</strong></span>
                  {currentTeam.weekStart && <span>· Pekan: {currentTeam.weekStart} s/d {currentTeam.weekEnd}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={copyPin}
                  className={`px-2.5 py-1.5 rounded-lg bg-white border ${currentTeamTheme.border} text-xs font-bold ${currentTeamTheme.text} flex items-center gap-1 cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors`}
                  title="Salin PIN Tim"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin PIN'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeamToLeave(currentTeam)}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                  title="Keluar dari tim aktif ini"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>Keluar Tim</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'choose' ? (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => goMode('create')}
                  className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-extrabold text-slate-900">Buat Tim Baru</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Anda membuat tim sendiri. Pilih divisi dan <b>tanggal pekan</b> (Senin–Minggu).
                      </div>
                    </div>
                    <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => goMode('join')}
                  className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <LogIn className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-extrabold text-slate-900">Gabung ke Tim</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Masukkan <b>PIN tim</b> dari partner. Divisi, nama tim, dan tanggal pekan otomatis tersinkron.
                      </div>
                    </div>
                    <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              </div>

              {/* Daftar Semua Tim yang Pernah/Sedang Dimasuki */}
              {joinedTeams.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      Tim yang Anda Ikuti ({joinedTeams.length})
                    </span>
                    <span className="text-[10.5px] text-slate-400">Pilih untuk beralih atau keluar</span>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                    {joinedTeams.map((t) => {
                      const isActive =
                        t.teamCode.trim().toUpperCase() === currentTeam?.teamCode?.trim().toUpperCase();
                      const tTheme = getDivisionColorTheme(t.division);
                      return (
                        <div
                          key={t.teamCode}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            isActive
                              ? `${tTheme.bannerBg} border-teal-300 ring-1 ring-teal-200/50 shadow-2xs`
                              : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${tTheme.badge}`}>
                                {t.division}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-800">
                                PIN: {t.teamCode}
                              </span>
                              {isActive && (
                                <span className="text-[10px] font-extrabold text-teal-700 bg-teal-100/90 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
                                  Aktif
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-slate-800 truncate mt-1">
                              {t.teamName || `Tim ${t.division}`}
                            </div>
                            {t.weekStart && (
                              <div className="text-[10.5px] text-slate-500 mt-0.5">
                                Pekan: {t.weekStart} s/d {t.weekEnd}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => handleSelectJoinedTeam(t)}
                                className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                              >
                                Beralih
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setTeamToLeave(t)}
                              className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                              title={`Keluar dari Tim ${t.teamName || t.teamCode}`}
                            >
                              <LogOut className="w-3.5 h-3.5 text-rose-600" />
                              <span>Keluar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali ke pilihan
              </button>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-700 font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'create' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-2xs border border-white"
                          style={{ backgroundColor: selectedDivTheme.hex }}
                        />
                        <span>Divisi Stase</span>
                      </label>
                      <select
                        value={selectedDivision}
                        onChange={(e) => handleDivisionChange(e.target.value)}
                        className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                      >
                        {(DIVISIONS || []).map((division) => (
                          <option key={division} value={division}>
                            {division}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-teal-600" />
                        Tanggal pekan divisi
                      </label>
                      <input
                        required
                        type="date"
                        value={weekDate}
                        onChange={(e) => setWeekDate(e.target.value)}
                        className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        Tanggal akan otomatis dibulatkan ke <b>Senin–Minggu</b>: {week.weekStart} s/d {week.weekEnd}.
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Kode Tim / PIN</label>
                        <button
                          type="button"
                          onClick={handleRandomPin}
                          className="text-[11px] font-semibold text-teal-700 flex items-center gap-1 cursor-pointer hover:text-teal-800"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Acak PIN
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          required
                          value={teamCodeInput}
                          onChange={(e) => setTeamCodeInput(e.target.value.toUpperCase())}
                          placeholder="Contoh: URO-123"
                          className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 text-sm font-mono font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        />
                      </div>
                      <p className="text-[10.5px] text-slate-500 mt-1">
                        PIN otomatis mencantumkan identitas divisi (misal <b>URO-123</b>, <b>DIG-456</b>). Klik{' '}
                        <b>Acak PIN</b> untuk kombinasi lain.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Tim</label>
                      <input
                        required
                        value={teamNameInput}
                        onChange={(e) => setTeamNameInput(e.target.value)}
                        placeholder={`Tim ${selectedDivision}`}
                        className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Nama ini menjadi nama bersama untuk semua anggota tim.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
                      <div className="text-xs font-extrabold text-emerald-900">Gabung dengan PIN</div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Tidak perlu memilih divisi atau tanggal. Semuanya mengikuti tim yang sudah dibuat.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Kode Tim / PIN</label>
                      <div className="flex gap-2">
                        <input
                          required
                          value={teamCodeInput}
                          onChange={(e) => {
                            setTeamCodeInput(e.target.value.toUpperCase());
                            setJoinPreview(null);
                          }}
                          placeholder="Contoh: URO-123"
                          className="flex-1 min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm font-mono font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        />
                        <button
                          type="button"
                          onClick={handleJoinPreview}
                          disabled={busy}
                          className="px-4 min-h-11 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
                        >
                          {busy ? 'Mencari...' : 'Cari Tim'}
                        </button>
                      </div>
                    </div>
                    {joinPreview && (() => {
                      const previewTheme = getDivisionColorTheme(joinPreview.division);
                      return (
                        <div className={`rounded-xl border p-4 transition-all ${previewTheme.bannerBg}`}>
                          <div
                            className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${previewTheme.text}`}
                          >
                            <span
                              className="w-2 h-2 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: previewTheme.hex }}
                            />
                            <span>Tim ditemukan</span>
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-slate-900">{joinPreview.teamName}</div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {joinPreview.division} · {joinPreview.weekStart || '-'} s/d {joinPreview.weekEnd || '-'}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Anggota</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      required
                      value={memberNameInput}
                      onChange={(e) => setMemberNameInput(e.target.value)}
                      placeholder="Nama Anda"
                      className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={carryOver}
                    onChange={(e) => setCarryOver(e.target.checked)}
                    className="mt-0.5 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs">
                    <b className="block text-amber-900">Bawa / operan pasien aktif</b>
                    <span className="text-amber-700">Salin pasien dari hari sebelumnya ke tanggal hari ini.</span>
                  </span>
                </label>
                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('choose')}
                    className="flex-1 min-h-11 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={busy || (mode === 'join' && !joinPreview)}
                    className="flex-1 min-h-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {busy ? (
                      'Memproses...'
                    ) : mode === 'create' ? (
                      <>
                        <Plus className="w-4 h-4" />
                        Buat Tim
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        Gabung ke Tim
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Modal Konfirmasi Keluar dari Tim */}
        {teamToLeave && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-slate-900">Keluar dari Tim?</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Anda akan keluar dari <strong>{teamToLeave.teamName || teamToLeave.division}</strong> (PIN:{' '}
                    <span className="font-mono font-bold text-slate-800">{teamToLeave.teamCode}</span>).
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
                <p className="font-bold text-amber-950 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  Informasi Keanggotaan:
                </p>
                <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
                  Akun Anda akan dihapus dari daftar anggota tim ini. Data pasien yang sudah tercatat di tim tetap aman
                  dan tidak terhapus. Anda dapat bergabung kembali kapan saja dengan memasukkan PIN tim.
                </p>
              </div>

              {leaveError && (
                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {leaveError}
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setTeamToLeave(null)}
                  disabled={leavingBusy}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLeave}
                  disabled={leavingBusy}
                  className="px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 min-h-[38px]"
                >
                  {leavingBusy ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Ya, Keluar dari Tim</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
