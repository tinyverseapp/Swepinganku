import { User } from 'firebase/auth';

/** The single owner account of Swepinganku. */
export const ADMIN_EMAIL = 'm.hafidzuddin.s@gmail.com';

export type UserRole = 'admin' | 'user';

/**
 * The owner role is tied to the authenticated Firebase account email.
 * Keep this helper as the single source of truth for UI/admin features.
 */
export function getUserRole(user: User | null): UserRole {
  const email = user?.email?.trim().toLowerCase();
  return email === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
}

export function isAdmin(user: User | null): boolean {
  return getUserRole(user) === 'admin';
}
