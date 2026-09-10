import { FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { LogIn, LogOut, Mail, LockKeyhole, ShieldCheck, Stethoscope } from 'lucide-react';
import { auth } from '../lib/firebase';

interface AuthGateProps {
  children: ReactNode;
}

function getAuthErrorMessage(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password salah.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan.';
    case 'auth/popup-closed-by-user':
      return 'Jendela login Google ditutup sebelum selesai.';
    case 'auth/popup-blocked':
      return 'Popup Google diblokir browser. Izinkan popup lalu coba lagi.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login. Silakan coba beberapa saat lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi internet bermasalah. Periksa koneksi lalu coba lagi.';
    default:
      return 'Login gagal. Periksa data login dan konfigurasi Firebase.';
  }
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    setPersistence(auth, browserLocalPersistence).catch(() => {
      // Firebase can still use its default persistence if this fails.
    });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(getAuthErrorMessage((err as { code?: string })?.code));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setBusy(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(getAuthErrorMessage((err as { code?: string })?.code));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      setError('Gagal keluar dari akun. Silakan coba lagi.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg animate-pulse">
            <Stethoscope className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium">Memeriksa sesi login...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-8">
        <section className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="px-6 sm:px-8 pt-8 pb-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                <Stethoscope className="w-7 h-7" />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold text-slate-900">Sweepinganku</h1>
              <p className="mt-1.5 text-sm text-slate-500">Silakan login untuk mengakses data sweeping.</p>
            </div>

            <div className="px-6 sm:px-8 pb-8">
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={busy}
                className="w-full min-h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center text-xs font-bold">G</span>
                {busy ? 'Memproses...' : 'Masuk dengan Google'}
              </button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">atau email</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Email</span>
                  <div className="mt-1.5 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="nama@email.com"
                      required
                      className="w-full min-h-11 rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Password</span>
                  <div className="mt-1.5 relative">
                    <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="Masukkan password"
                      required
                      className="w-full min-h-11 rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <LogIn className="w-4 h-4" />
                  {busy ? 'Memproses...' : 'Login'}
                </button>
              </form>

              <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Login dikelola langsung oleh Firebase Authentication. Password tidak disimpan oleh aplikasi.</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="relative">
      {children}
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-2 py-1.5 shadow-lg max-w-[calc(100vw-1.5rem)]">
        <div className="hidden sm:block min-w-0 px-1">
          <div className="text-[10px] uppercase tracking-wide font-bold text-slate-400">Login</div>
          <div className="text-xs font-semibold text-slate-700 truncate max-w-44">{user.email || user.displayName || 'Akun Google'}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Keluar"
          className="min-h-9 px-2.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Keluar
        </button>
      </div>
    </div>
  );
}
