import React, { useState, useEffect } from 'react';
import { DivisionTeam } from '../types';
import { DIVISIONS, getDefaultTeamCode } from '../data/constants';
import { saveJoinedTeam } from '../utils/teamRegistry';
import { Users, KeyRound, Copy, Check, X, RefreshCw, ArrowLeftRight, ShieldCheck } from 'lucide-react';

interface TeamSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTeam: DivisionTeam;
  currentDivision: string;
  koasName: string;
  onSwitchTeam: (newTeam: DivisionTeam, carryOverFromYesterday: boolean) => void;
}

export function TeamSwitchModal({ isOpen, onClose, currentTeam, currentDivision, koasName, onSwitchTeam }: TeamSwitchModalProps) {
  const [selectedDivision, setSelectedDivision] = useState(currentDivision || DIVISIONS[0] || '');
  const [teamCodeInput, setTeamCodeInput] = useState(currentTeam.teamCode || '');
  const [teamNameInput, setTeamNameInput] = useState(currentTeam.teamName || '');
  const [memberNameInput, setMemberNameInput] = useState(koasName);
  const [carryOver, setCarryOver] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialDivision = currentDivision || DIVISIONS[0] || '';
      setSelectedDivision(initialDivision);
      setTeamCodeInput(currentTeam.teamCode || getDefaultTeamCode(initialDivision));
      setTeamNameInput(currentTeam.teamName || `Tim ${initialDivision}`);
      setMemberNameInput(koasName);
    }
  }, [isOpen, currentDivision, currentTeam, koasName]);

  if (!isOpen) return null;

  const handleDivisionChange = (division: string) => {
    setSelectedDivision(division);
    setTeamCodeInput(getDefaultTeamCode(division));
    setTeamNameInput(`Tim ${division}`);
  };

  const handleRandomPin = () => {
    const prefix = selectedDivision.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
    setTeamCodeInput(`${prefix}-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanCode = teamCodeInput.trim().toUpperCase() || getDefaultTeamCode(selectedDivision);
    const cleanName = teamNameInput.trim() || `Tim ${selectedDivision}`;
    const cleanMember = memberNameInput.trim() || koasName || 'Pengguna';
    const sameTeam = currentTeam.teamCode?.trim().toUpperCase() === cleanCode;
    const members = Array.from(new Set([...(sameTeam ? currentTeam.members || [] : []), cleanMember])).filter(Boolean);
    const updatedTeam: DivisionTeam = {
      teamCode: cleanCode,
      division: selectedDivision,
      teamName: cleanName,
      members: members.length ? members : [cleanMember],
      lastUpdated: new Date().toISOString(),
    };

    saveJoinedTeam(updatedTeam);
    localStorage.setItem('sweepinganku:activeTeam', JSON.stringify(updatedTeam));
    onSwitchTeam(updatedTeam, carryOver);
    onClose();
  };

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(currentTeam.teamCode || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
            <div><h2 className="font-extrabold text-base sm:text-lg text-slate-900">Ganti Tim</h2><p className="text-[11px] text-slate-500">Bergabung ke tim berdasarkan divisi dan PIN.</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {currentTeam.teamCode && <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="text-[10px] uppercase tracking-wider font-bold text-blue-700 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Tim aktif</div><div className="font-extrabold text-sm text-slate-900 truncate mt-1">{currentTeam.teamName || currentTeam.division}</div><div className="text-[11px] text-slate-500">{currentTeam.division} · PIN {currentTeam.teamCode}</div></div>
            <button type="button" onClick={copyPin} className="shrink-0 px-2.5 py-2 rounded-lg bg-white border border-blue-200 text-xs font-bold text-blue-700 flex items-center gap-1 cursor-pointer">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Tersalin' : 'Salin PIN'}</button>
          </div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Divisi Stase</label>
              <select value={selectedDivision} onChange={(e) => handleDivisionChange(e.target.value)} className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
                {(DIVISIONS || []).map((division) => <option key={division} value={division}>{division}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Pilih divisi dan PIN tim yang ingin Anda masuki. Setelah bergabung, divisi ini akan muncul pada daftar divisi akun Anda.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5"><label className="text-xs font-bold text-slate-700">Kode Tim / PIN</label><button type="button" onClick={handleRandomPin} className="text-[11px] font-semibold text-blue-600 flex items-center gap-1 cursor-pointer"><RefreshCw className="w-3 h-3" />Acak PIN</button></div>
              <div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input required value={teamCodeInput} onChange={(e) => setTeamCodeInput(e.target.value.toUpperCase())} placeholder="Contoh: URO-101" className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 text-sm font-mono font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
              <p className="text-[11px] text-slate-500 mt-1">Gunakan PIN yang sama dengan anggota lain agar masuk ke tim dan daftar pasien yang sama.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Tim</label>
              <input required value={teamNameInput} onChange={(e) => setTeamNameInput(e.target.value)} placeholder={`Tim ${selectedDivision}`} className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Anggota</label>
              <div className="relative"><Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input required value={memberNameInput} onChange={(e) => setMemberNameInput(e.target.value)} placeholder="Nama Anda" className="w-full min-h-11 bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer"><input type="checkbox" checked={carryOver} onChange={(e) => setCarryOver(e.target.checked)} className="mt-0.5 w-4 h-4 cursor-pointer" /><span className="text-xs"><b className="block text-amber-900">Bawa / operan pasien aktif</b><span className="text-amber-700">Salin pasien dari hari sebelumnya ke tanggal hari ini pada tim yang dipilih.</span></span></label>

            <div className="pt-2 border-t border-slate-100 flex gap-2"><button type="button" onClick={onClose} className="flex-1 min-h-11 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Batal</button><button type="submit" className="flex-1 min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"><ArrowLeftRight className="w-4 h-4" />Masuk / Ganti Tim</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}
