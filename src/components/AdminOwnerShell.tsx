import { type ReactNode } from 'react';

interface AdminOwnerShellProps {
  children: ReactNode;
}

export function AdminOwnerShell({ children }: AdminOwnerShellProps) {
  return <>{children}</>;
}
