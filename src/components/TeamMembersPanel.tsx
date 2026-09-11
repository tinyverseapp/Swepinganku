import { useEffect, useRef, useState } from 'react';
import { Users, Circle, RefreshCw, ChevronDown, LogOut } from 'lucide-react';
import { subscribeToTeamMembers, registerTeamMember, leaveTeam, TeamMember } from '../lib/teamMembersService';
import { subscribeToTeam } from '../lib/teamService';
import { getSavedActiveTeam, removeJoinedTeam } from '../utils/teamRegistry';
import { auth } from '../lib/firebase';

export function TeamMembersPanel() {
  const [teamCode, setTeamCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const readTeam = () => {
      try {
        const raw = localStorage.getItem('sweepinganku:activeTeam');
        const saved = raw ? JSON.parse(raw) : null;
        const team = saved?.teamCode ? saved : getSavedActiveTeam();
        setTeamCode(team?.teamCode?.trim().toUpperCase() || '');
        setTeamName(team?.teamName || 'Tim aktif');
      } catch {
        setTeamCode('');
        setTeamName('');
      }
    };
    readTeam();
    const timer = window.setInterval(readTeam, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!teamCode) { setMembers([]); return; }
    setError('');
    const currentUser = auth.currentUser;
    if (currentUser) {
      registerTeamMember(teamCode, currentUser.uid, currentUser.displayName || '', currentUser.email || '')
        .catch((err) => { console.error('[Firestore] registerTeamMember error:', err); setError('Gagal mendaftarkan Anda ke tim.'); });
    }

    const unsubTeam = subscribeToTeam(teamCode, (team) => {
      if (!team) return;
      setTeamName(team.teamName || 'Tim aktif');
      try {
        const raw = localStorage.getItem('sweepinganku:activeTeam');
        const local = raw ? JSON.parse(raw) : {};
        localStorage.setItem('sweepinganku:activeTeam', JSON.stringify({ ...local, ...team, teamCode }));
      } catch {}
    }, (err) => console.error('[Firestore] team metadata:', err));

    const unsubMembers = subscribeToTeamMembers(teamCode, setMembers, (err) => {
      console.error(err);
      setError('Daftar anggota belum dapat dimuat.');
    });
    return () => { unsubTeam(); unsubMembers(); };
  }, [teamCode]);

  const handleLeaveTeam = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !teamCode || leaving) return;
    const confirmed = window.confirm(`Keluar dari ${teamName || 'tim ini'}?\n\nAnda tidak akan lagi terdaftar sebagai anggota tim ini pada akun ini.`);
    if (!confirmed) return;

    setLeaving(true);
    setError('');
    try {
      await leaveTeam(teamCode, currentUser.uid);
      const remainingTeams = removeJoinedTeam(teamCode);
      const nextTeam = remainingTeams[remainingTeams.length - 1];
      if (nextTeam) {
        localStorage.setItem('sweepinganku:activeTeam', JSON.stringify(nextTeam));
      } else {
        // Empty marker prevents the legacy default team from being recreated after leaving.
        localStorage.setItem('sweepinganku:activeTeam', JSON.stringify({ teamCode: '', division: '', teamName: '', members: [] }));
      }
      setOpen(false);
      // Reinitialize App state from the updated account/team registry.
      window.location.reload();
    } catch (err) {
      console.error('[Firestore] leaveTeam error:', err);
      setError(err instanceof Error ? err.message : 'Gagal keluar dari tim. Pastikan koneksi dan Rules Firebase tersedia.');
    } finally {
      setLeaving(false);
    }
  };

  if (!teamCode) return null;

  return (
    <div ref={panelRef} className="fixed left-3 bottom-3 z-50">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 min-h-9 max-w-[220px] rounded-full border border-slate-200 bg-white/95 backdrop-blur shadow-lg hover:shadow-xl hover:bg-slate-50 px-3 py-2 transition-all cursor-pointer" aria-label="Lihat anggota tim" aria-expanded={open}>
        <Users className="w-4 h-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold text-slate-700 truncate">{teamName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 bottom-[calc(100%+8px)] w-[min(340px,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 bg-gradient-to-br from-blue-50 to-white border-b border-slate-100">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-sm font-extrabold text-slate-900 truncate">{teamName}</div><div className="text-[10px] text-slate-500 mt-0.5">Kode tim: {teamCode}</div></div><span className="shrink-0 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">{members.length} akun</span></div>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {error ? <div className="flex items-center gap-2 px-3 py-3 text-xs text-amber-700"><RefreshCw className="w-3.5 h-3.5" />{error}</div> : members.length === 0 ? <div className="py-5 text-xs text-slate-400 text-center">Belum ada akun lain di tim ini.</div> : <div className="space-y-0.5">{members.map((member) => <div key={member.uid} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-slate-50"><div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-extrabold shrink-0">{(member.name || member.email || '?').trim().charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-800 truncate">{member.name || 'Pengguna'}</div><div className="text-[10px] text-slate-500 truncate">{member.email || 'Email tidak tersedia'}</div></div><Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500 shrink-0" title="Terdaftar di tim" /></div>)}</div>}
          </div>
          <div className="px-3 py-3 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={handleLeaveTeam} disabled={leaving} className="w-full min-h-10 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
              <LogOut className="w-4 h-4" />
              {leaving ? 'Sedang keluar...' : 'Keluar dari Tim'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
