import { type ReactNode, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { isAdmin } from '../lib/admin';

interface AdminOwnerShellProps {
  children: ReactNode;
}

export function AdminOwnerShell({ children }: AdminOwnerShellProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return (
    <>
      {children}
      {isAdmin(user) && (
        <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-3.5 py-2 text-xs font-extrabold text-emerald-700 shadow-lg shadow-slate-300/30 backdrop-blur">
          <ShieldCheck className="w-4 h-4" />
          <span>Admin · Pemilik Web</span>
        </div>
      )}
    </>
  );
}
