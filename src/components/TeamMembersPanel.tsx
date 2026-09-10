import { useEffect, useState } from 'react';
import { Users, Circle, RefreshCw } from 'lucide-react';
import { subscribeToTeamMembers, registerTeamMember, TeamMember } from '../lib/teamMembersService';
import { getSavedActiveTeam } from '../utils/teamRegistry';
import { auth } from '../lib/firebase';

export function TeamMembersPanel() {
  const [teamCode, setTeamCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState('');

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
      }
    };
    readTeam();
    const timer = window.setInterval(readTeam, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!teamCode) { setMembers([]); return; }
    setError('');
    const currentUser = auth.currentUser;
    if (currentUser) {
      registerTeamMember(teamCode, currentUser.uid, currentUser.displayName || '', currentUser.email || '')
        .catch((err) => { console.error('[Firestore] registerTeamMember error:', err); setError('Gagal mendaftarkan Anda ke tim.'); });
    }
    return subscribeToTeamMembers(teamCode, setMembers, (err) => {
      console.error(err);
      setError('Daftar anggota belum dapat dimuat.');
    });
  }, [teamCode]);

  if (!teamCode) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50 w-[min(340px,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="min-w-0"><div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800"><Users className="w-4 h-4 text-blue-600" />Anggota Tim</div><div className="text-[10px] text-slate-500 truncate mt-0.5">{teamName} · {teamCode}</div></div>
        <span className="shrink-0 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-full">{members.length} orang</span>
      </div>
      <div className="max-h-44 overflow-y-auto px-3 py-2">
        {error ? <div className="flex items-center gap-2 py-2 text-xs text-amber-700"><RefreshCw className="w-3.5 h-3.5" />{error}</div> : members.length === 0 ? <div className="py-3 text-xs text-slate-400 text-center">Belum ada anggota terdaftar.</div> : <div className="space-y-1">
          {members.map((member) => <div key={member.uid} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-50">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-extrabold shrink-0">{(member.name || member.email || '?').trim().charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-800 truncate">{member.name || 'Pengguna'}</div><div className="text-[10px] text-slate-500 truncate">{member.email || 'Email tidak tersedia'}</div></div>
            <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500 shrink-0" title="Anggota tim" />
          </div>)}
        </div>}
      </div>
    </div>
  );
}
