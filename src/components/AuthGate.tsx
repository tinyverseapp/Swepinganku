import { FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { LogIn, Mail, LockKeyhole, ShieldCheck, Stethoscope, UserPlus, UserRound } from 'lucide-react';
import { auth } from '../lib/firebase';

interface AuthGateProps { children: ReactNode; }

function getAuthErrorMessage(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'Email atau password salah.';
    case 'auth/invalid-email': return 'Format email tidak valid.';
    case 'auth/email-already-in-use': return 'Email tersebut sudah terdaftar. Silakan login.';
    case 'auth/weak-password': return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/user-disabled': return 'Akun ini dinonaktifkan.';
    case 'auth/popup-closed-by-user': return 'Jendela Google ditutup sebelum selesai.';
    case 'auth/popup-blocked': return 'Popup Google diblokir browser. Izinkan popup lalu coba lagi.';
    case 'auth/too-many-requests': return 'Terlalu banyak percobaan. Silakan coba beberapa saat lagi.';
    case 'auth/network-request-failed': return 'Koneksi internet bermasalah. Periksa koneksi lalu coba lagi.';
    case 'auth/operation-not-allowed': return 'Metode autentikasi ini belum diaktifkan di Firebase.';
    default: return 'Autentikasi gagal. Periksa data dan konfigurasi Firebase.';
  }
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setLoading(false);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode); setError(''); setPassword(''); setConfirmPassword('');
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('Konfirmasi password tidak sama.'); return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(getAuthErrorMessage((err as { code?: string })?.code));
    } finally { setBusy(false); }
  };

  const handleGoogleAuth = async () => {
    setError(''); setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(getAuthErrorMessage((err as { code?: string })?.code));
    } finally { setBusy(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg animate-pulse"><Stethoscope className="w-6 h-6" /></div>
        <span className="text-sm font-medium">Memeriksa sesi login...</span>
      </div>
    </div>
  );

  if (!user) {
    const isRegister = mode === 'register';
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-8">
        <section className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="px-6 sm:px-8 pt-8 pb-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200"><Stethoscope className="w-7 h-7" /></div>
              <h1 className="mt-5 text-2xl font-extrabold text-slate-900">Swepinganku</h1>
              <p className="mt-1.5 text-sm text-slate-500">{isRegister ? 'Buat akun untuk mulai menggunakan Swepinganku.' : 'Silakan login untuk mengakses data sweeping.'}</p>
            </div>
            <div className="px-6 sm:px-8 pb-8">
              <div className="grid grid-cols-2 p-1 mb-5 rounded-xl bg-slate-100 border border-slate-200">
                <button type="button" onClick={() => switchMode('login')} className={`min-h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 ${!isRegister ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LogIn className="w-4 h-4" />Login</button>
                <button type="button" onClick={() => switchMode('register')} className={`min-h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 ${isRegister ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><UserPlus className="w-4 h-4" />Daftar Akun</button>
              </div>
              {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div>}
              <button type="button" onClick={handleGoogleAuth} disabled={busy} className="w-full min-h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold flex items-center justify-center gap-2.5 disabled:opacity-60"><span className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center text-xs font-bold">G</span>{busy ? 'Memproses...' : `${isRegister ? 'Daftar' : 'Masuk'} dengan Google`}</button>
              <div className="my-5 flex items-center gap-3"><div className="h-px bg-slate-200 flex-1" /><span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">atau email</span><div className="h-px bg-slate-200 flex-1" /></div>
              <form onSubmit={handleEmailAuth} className="space-y-3.5">
                {isRegister && <label className="block"><span className="text-xs font-semibold text-slate-600">Nama</span><div className="mt-1.5 relative"><UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Nama lengkap" required className="w-full min-h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" /></div></label>}
                <label className="block"><span className="text-xs font-semibold text-slate-600">Email</span><div className="mt-1.5 relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nama@email.com" required className="w-full min-h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" /></div></label>
                <label className="block"><span className="text-xs font-semibold text-slate-600">Password</span><div className="mt-1.5 relative"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'Minimal 6 karakter' : 'Masukkan password'} minLength={6} required className="w-full min-h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" /></div></label>
                {isRegister && <label className="block"><span className="text-xs font-semibold text-slate-600">Konfirmasi Password</span><div className="mt-1.5 relative"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Ulangi password" minLength={6} required className="w-full min-h-11 rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" /></div></label>}
                <button type="submit" disabled={busy} className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">{isRegister ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}{busy ? 'Memproses...' : isRegister ? 'Buat Akun' : 'Login'}</button>
              </form>
              <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs text-slate-500"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span>Akun dan password dikelola langsung oleh Firebase Authentication. Password tidak disimpan oleh aplikasi.</span></div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return <div className="relative">{children}</div>;
}
