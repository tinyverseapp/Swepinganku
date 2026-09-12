import { useEffect, useRef, useState } from 'react';
import { FileText, LayoutGrid, Settings, LogOut, UserRound, X, Edit2, ShieldCheck } from 'lucide-react';
import { PageMode, DivisionTeam } from '../types';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut, updateProfile, User } from 'firebase/auth';
import { useDivisionColors } from '../utils/divisionColors';
import { isAdmin } from '../lib/admin';
import { BrandLogoIcon } from './BrandLogo';

interface TopbarProps {
  koasName: string;
  onUpdateKoasName: (name: string) => void;
  onAddPatient?: () => void;
  pageMode?: PageMode;
  onPageModeChange?: (mode: PageMode) => void;
  onOpenNextjsModal?: () => void;
  activeTeam?: DivisionTeam;
  onOpenTeamModal?: () => void;
  onOpenSettings?: () => void;
}

export function Topbar({ koasName, onUpdateKoasName, pageMode = 'dashboard', onPageModeChange, onOpenSettings, activeTeam }: TopbarProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const { activeTheme } = useDivisionColors(activeTeam?.division);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false); setIsEditingProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openProfile = () => {
    setProfileName(user?.displayName || koasName || '');
    setProfilePhoto(user?.photoURL || '');
    setProfileError(''); setIsProfileOpen(true); setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const nextName = profileName.trim();
    if (!nextName) { setProfileError('Nama profil tidak boleh kosong.'); return; }
    setProfileBusy(true); setProfileError('');
    try {
      await updateProfile(user, { displayName: nextName, photoURL: profilePhoto.trim() || null });
      setUser({ ...user }); onUpdateKoasName(nextName); setIsEditingProfile(false);
    } catch (error) {
      console.error('[Auth] updateProfile error:', error); setProfileError('Profil gagal diperbarui. Silakan coba lagi.');
    } finally { setProfileBusy(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); setIsProfileOpen(false); }
    catch (error) { console.error('[Auth] signOut error:', error); setProfileError('Gagal keluar dari akun. Silakan coba lagi.'); }
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Pengguna';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 p-1.5 flex items-center justify-center shadow-2xs shrink-0">
            <BrandLogoIcon className="w-full h-full" size={26} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                <span>Sweping</span>
                <span className="text-teal-600">anku</span>
              </span>
              {activeTeam?.division && (
                <span className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${activeTheme.badge}`}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activeTheme.hex }} />
                  <span>{activeTeam.division}</span>
                </span>
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate flex items-center gap-1.5">
              <span>Surgical Sweeping &amp; WA Report</span>
              {activeTeam?.division && (
                <span className={`sm:hidden inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border ${activeTheme.badge}`}>
                  <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: activeTheme.hex }} />
                  <span>{activeTeam.division}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {onPageModeChange && <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold flex-1 sm:flex-initial">
            <button type="button" onClick={() => onPageModeChange('dashboard')} className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg transition-all cursor-pointer min-h-[36px] ${pageMode === 'dashboard' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 active:bg-slate-200/60'}`}><LayoutGrid className="w-3.5 h-3.5 shrink-0" /><span>Kartu Pasien</span></button>
            <button type="button" onClick={() => onPageModeChange('document')} className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg transition-all cursor-pointer min-h-[36px] ${pageMode === 'document' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900 active:bg-slate-200/60'}`}><FileText className="w-3.5 h-3.5 shrink-0" /><span>Dokumen Sweeping</span></button>
          </div>}
          {user && <div ref={profileRef} className="relative shrink-0">
            <button type="button" onClick={() => isProfileOpen ? setIsProfileOpen(false) : openProfile()} className="group flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Buka menu profil" aria-expanded={isProfileOpen}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-blue-100 text-blue-700 border-2 border-white ring-1 ring-slate-200 shadow-xs flex items-center justify-center font-extrabold text-xs sm:text-sm">{user.photoURL ? <img src={user.photoURL} alt="Foto profil" className="w-full h-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : initials}</div>
              <div className="hidden lg:block text-left max-w-36">
                <div className="text-xs font-bold text-slate-800 truncate">{displayName}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {isAdmin(user) ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Admin</span>
                    </span>
                  ) : (
                    user.email || 'Akun pengguna'
                  )}
                </div>
              </div>
            </button>
            {isProfileOpen && <div className="absolute right-0 top-[calc(100%+8px)] w-[min(330px,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden z-50">
              {!isEditingProfile ? <>
                <div className="p-4 bg-gradient-to-br from-blue-50 to-white border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold border-2 border-white ring-1 ring-blue-100 shrink-0">
                      {user.photoURL ? <img src={user.photoURL} alt="Foto profil" className="w-full h-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-900 truncate">{displayName}</div>
                      <div className="text-xs text-slate-500 truncate">{user.email}</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {isAdmin(user) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Status: Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span>Status: Anggota</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-2"><button type="button" onClick={() => { setProfileName(user.displayName || koasName || ''); setProfilePhoto(user.photoURL || ''); setProfileError(''); setIsEditingProfile(true); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"><Edit2 className="w-4 h-4 text-blue-600" />Edit Profil</button>
                  {onOpenSettings && <button type="button" onClick={() => { setIsProfileOpen(false); onOpenSettings(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"><Settings className="w-4 h-4 text-slate-500" />Pengaturan</button>}
                  <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer"><LogOut className="w-4 h-4" />Keluar</button>
                </div>
              </> : <div className="p-4">
                <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><UserRound className="w-4 h-4 text-blue-600" /><span className="font-extrabold text-sm text-slate-900">Edit Profil</span></div><button type="button" onClick={() => setIsEditingProfile(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer" title="Tutup"><X className="w-4 h-4" /></button></div>
                {profileError && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{profileError}</div>}
                <label className="block mb-3"><span className="text-xs font-semibold text-slate-600">Nama Profil</span><input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="mt-1.5 w-full min-h-10 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" placeholder="Nama lengkap" /></label>
                <label className="block mb-1"><span className="text-xs font-semibold text-slate-600">URL Foto Profil</span><input type="url" value={profilePhoto} onChange={(e) => setProfilePhoto(e.target.value)} className="mt-1.5 w-full min-h-10 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" placeholder="https://..." /></label>
                <p className="text-[10px] text-slate-400 mb-4">Untuk akun Google, foto Google digunakan otomatis bila tersedia.</p>
                <div className="flex items-center gap-2"><button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 min-h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Batal</button><button type="button" onClick={handleSaveProfile} disabled={profileBusy} className="flex-1 min-h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60 cursor-pointer">{profileBusy ? 'Menyimpan...' : 'Simpan Profil'}</button></div>
              </div>}
            </div>}
          </div>}
        </div>
      </div>
    </header>
  );
}
