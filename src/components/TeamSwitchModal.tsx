import React, { useEffect, useState } from 'react';
import { DivisionTeam } from '../types';
import { DIVISIONS, getDefaultTeamCode } from '../data/constants';
import { saveJoinedTeam, loadJoinedTeams } from '../utils/teamRegistry';
import { today } from '../utils/storage';
import { getCurrentWeekRange, getTeam, createOrUpdateTeam } from '../lib/teamService';
import { Users, KeyRound, Copy, Check, X, RefreshCw, ArrowLeftRight, ShieldCheck, CalendarDays, Plus, LogIn, ArrowLeft } from 'lucide-react';
import { useDivisionColors, getDivisionColorTheme } from '../utils/divisionColors';

interface TeamSwitchModalProps { isOpen: boolean; onClose: () => void; currentTeam: DivisionTeam; currentDivision: string; koasName: string; onSwitchTeam: (newTeam: DivisionTeam, carryOverFromYesterday: boolean) => void; }
function previousWeekStart(weekStart: string) { const d = new Date(`${weekStart}T12:00:00`); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); }
function getWeekLabel(start: string, end: string) { return `${start} s/d ${end}`; }
function friendlyTeamError(err: unknown) { const code = (err as { code?: string })?.code; const message = err instanceof Error ? err.message : String(err || ''); if (code === 'permission-denied' || /missing or insufficient permissions/i.test(message)) return 'Firebase menolak akses ke data tim. Pastikan Rules Firestore terbaru sudah ter-deploy.'; return message || 'Gagal bergabung atau membuat tim.'; }

export function TeamSwitchModal({ isOpen, onClose, currentTeam, currentDivision, koasName, onSwitchTeam }: TeamSwitchModalProps) {
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
    }
  }, [isOpen, currentDivision, koasName]);

  if (!isOpen) return null;
  const week = getCurrentWeekRange(weekDate);

  const goMode = (next: 'create' | 'join') => { setMode(next); setError(''); setJoinPreview(null); setTeamCodeInput(next === 'create' ? getDefaultTeamCode(selectedDivision) : ''); setTeamNameInput(next === 'create' ? `Tim ${selectedDivision}` : ''); };
  const handleDivisionChange = (division: string) => { setSelectedDivision(division); setTeamCodeInput(getDefaultTeamCode(division)); setTeamNameInput(`Tim ${division}`); };
  const handleRandomPin = () => { const prefix = selectedDivision.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase(); setTeamCodeInput(`${prefix}-${Math.floor(100 + Math.random() * 900)}`); };

  const handleJoinPreview = async () => {
    const cleanCode = teamCodeInput.trim().toUpperCase();
    if (!cleanCode) { setError('Masukkan PIN tim terlebih dahulu.'); return; }
    setError(''); setBusy(true);
    try {
      const team = await getTeam(cleanCode);
      if (!team) throw new Error(`Tim dengan PIN ${cleanCode} tidak ditemukan.`);
      setJoinPreview(team);
    } catch (err) { setError(friendlyTeamError(err)); }
    finally { setBusy(false); }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const cleanMember = memberNameInput.trim() || koasName || 'Pengguna';
      let finalTeam: DivisionTeam;

      if (mode === 'join') {
        const cleanCode = teamCodeInput.trim().toUpperCase();
        const existing = joinPreview || await getTeam(cleanCode);
        if (!existing) throw new Error(`Tim dengan PIN ${cleanCode} tidak ditemukan.`);
        const previous = existing.weekStart ? previousWeekStart(existing.weekStart) : '';
        const duplicate = loadJoinedTeams().find((team) => team.division === existing.division && !!team.weekStart && !!existing.weekStart && (team.weekStart === existing.weekStart || team.weekStart === previous));
        if (duplicate && duplicate.teamCode !== existing.teamCode) throw new Error(`Divisi ${existing.division} sudah dipakai akun ini pada pekan ${duplicate.weekStart}. Pekan berikutnya harus memakai divisi berbeda.`);
        finalTeam = { ...existing, teamCode: cleanCode, members: Array.from(new Set([...(existing.members || []), cleanMember])) };
      } else {
        const cleanCode = teamCodeInput.trim().toUpperCase() || getDefaultTeamCode(selectedDivision);
        const cleanName = teamNameInput.trim() || `Tim ${selectedDivision}`;
        const existing = await getTeam(cleanCode);
        if (existing) throw new Error(`PIN ${cleanCode} sudah digunakan. Gunakan PIN lain atau pilih menu Gabung Tim.`);
        finalTeam = { teamCode: cleanCode, division: selectedDivision, teamName: cleanName, members: [cleanMember], weekStart: week.weekStart, weekEnd: week.weekEnd, createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString() };
        finalTeam = await createOrUpdateTeam(finalTeam, true);
      }

      saveJoinedTeam(finalTeam);
      localStorage.setItem('sweepinganku:activeTeam', JSON.stringify(finalTeam));
      onSwitchTeam(finalTeam, carryOver);
      onClose();
    } catch (err) { setError(friendlyTeamError(err)); }
    finally { setBusy(false); }
  };

  const copyPin = async () => { try { await navigator.clipboard.writeText(currentTeam.teamCode || ''); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div><div><h2 className="font-extrabold text-base sm:text-lg text-slate-900">Gabung / Buat Tim</h2><p className="text-[11px] text-slate-500">Pilih sesuai kebutuhan Anda.</p></div></div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {currentTeam.teamCode && mode === 'choose' && (
            <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${currentTeamTheme.bannerBg}`}>
              <div className="min-w-0">
                <div className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 ${currentTeamTheme.text}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />Tim aktif
                </div>
                <div className="font-extrabold text-sm text-slate-900 truncate mt-1">
                  {currentTeam.teamName || currentTeam.division}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: currentTeamTheme.hex }} />
                  <span>{currentTeam.division} · PIN {currentTeam.teamCode}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={copyPin}
                className={`shrink-0 px-2.5 py-2 rounded-lg bg-white border ${currentTeamTheme.border} text-xs font-bold ${currentTeamTheme.text} flex items-center gap-1 cursor-pointer shadow-2xs`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Tersalin' : 'Salin PIN'}
              </button>
            </div>
          )}

          {mode === 'choose' ? (
            <div className="space-y-3">
              <button type="button" onClick={() => goMode('create')} className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-left transition-all cursor-pointer"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><Plus className="w-5 h-5" /></div><div className="flex-1"><div className="text-sm font-extrabold text-slate-900">Buat Tim Baru</div><div className="text-xs text-slate-500 mt-0.5">Anda membuat tim sendiri. Pilih divisi dan <b>tanggal pekan</b> (Senin–Minggu).</div></div><ArrowLeftRight className="w-4 h-4 text-slate-400" /></div></button>
              <button type="button" onClick={() => goMode('join')} className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-left transition-all cursor-pointer"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><LogIn className="w-5 h-5" /></div><div className="flex-1"><div className="text-sm font-extrabold text-slate-900">Gabung ke Tim</div><div className="text-xs text-slate-500 mt-0.5">Masukkan <b>PIN tim</b>. Divisi, nama tim, dan tanggal pekan otomatis mengikuti pembuat tim.</div></div><ArrowLeftRight className="w-4 h-4 text-slate-400" /></div></button>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setMode('choose')} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" />Kembali ke pilihan</button>
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-700 font-medium">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'create' ? <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-2xs border border-white" style={{ backgroundColor: selectedDivTheme.hex }} />
                      <span>Divisi Stase</span>
                    </label>
                    <select value={selectedDivision} onChange={(e) => handleDivisionChange(e.target.value)} className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
                      {(DIVISIONS || []).map((division) => <option key={division} value={division}>{division}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-blue-600" />Tanggal pekan divisi</label><input required type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" /><p className="text-[11px] text-slate-500 mt-1.5">Tanggal akan otomatis dibulatkan ke <b>Senin–Minggu</b>: {week.weekStart} s/d {week.weekEnd}.</p></div>
                  <div><div className="flex items-center justify-between mb-1.5"><label className="text-xs font-bold text-slate-700">Kode Tim / PIN</label><button type="button" onClick={handleRandomPin} className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 cursor-pointer"><RefreshCw className="w-3 h-3" />Acak PIN</button></div><div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input required value={teamCodeInput} onChange={(e) => setTeamCodeInput(e.target.value.toUpperCase())} placeholder="Contoh: URO-101" className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 text-sm font-mono font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div></div>
                  <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Tim</label><input required value={teamNameInput} onChange={(e) => setTeamNameInput(e.target.value)} placeholder={`Tim ${selectedDivision}`} className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" /><p className="text-[10px] text-slate-400 mt-1">Nama ini menjadi nama bersama untuk semua anggota tim.</p></div>
                </> : <>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5"><div className="text-xs font-extrabold text-emerald-900">Gabung dengan PIN</div><p className="text-[11px] text-emerald-700 mt-0.5">Tidak perlu memilih divisi atau tanggal. Semuanya mengikuti tim yang sudah dibuat.</p></div>
                  <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Kode Tim / PIN</label><div className="flex gap-2"><input required value={teamCodeInput} onChange={(e) => { setTeamCodeInput(e.target.value.toUpperCase()); setJoinPreview(null); }} placeholder="Contoh: URO-101" className="flex-1 min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm font-mono font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" /><button type="button" onClick={handleJoinPreview} disabled={busy} className="px-4 min-h-11 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-60 cursor-pointer">{busy ? 'Mencari...' : 'Cari Tim'}</button></div></div>
                  {joinPreview && (() => {
                    const previewTheme = getDivisionColorTheme(joinPreview.division);
                    return (
                      <div className={`rounded-xl border p-4 transition-all ${previewTheme.bannerBg}`}>
                        <div className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${previewTheme.text}`}>
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: previewTheme.hex }} />
                          <span>Tim ditemukan</span>
                        </div>
                        <div className="mt-1 text-sm font-extrabold text-slate-900">{joinPreview.teamName}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{joinPreview.division} · {joinPreview.weekStart || '-'} s/d {joinPreview.weekEnd || '-'}</div>
                      </div>
                    );
                  })()}
                </>}

                <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Anggota</label><div className="relative"><Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input required value={memberNameInput} onChange={(e) => setMemberNameInput(e.target.value)} placeholder="Nama Anda" className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div></div>
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer"><input type="checkbox" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} className="mt-0.5 w-4 h-4 cursor-pointer" /><span className="text-xs"><b className="block text-amber-900">Bawa / operan pasien aktif</b><span className="text-amber-700">Salin pasien dari hari sebelumnya ke tanggal hari ini.</span></span></label>
                <div className="pt-2 border-t border-slate-100 flex gap-2"><button type="button" onClick={() => setMode('choose')} className="flex-1 min-h-11 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Kembali</button><button type="submit" disabled={busy || (mode === 'join' && !joinPreview)} className="flex-1 min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60">{busy ? 'Memproses...' : mode === 'create' ? <><Plus className="w-4 h-4" />Buat Tim</> : <><LogIn className="w-4 h-4" />Gabung ke Tim</>}</button></div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
