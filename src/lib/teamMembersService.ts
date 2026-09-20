import {
  collection,
  collectionGroup,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  setDoc,
  Unsubscribe,
  where,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTeam } from './teamService';
import { DivisionTeam } from '../types';

export interface TeamMember {
  uid: string;
  name: string;
  email: string;
  joinedAt?: unknown;
  lastSeenAt?: unknown;
}

const COLLECTION = 'teamMembers';

function memberRef(teamCode: string, uid: string) {
  return doc(db, COLLECTION, teamCode.trim().toUpperCase(), 'members', uid);
}

export async function registerTeamMember(teamCode: string, uid: string, name: string, email: string): Promise<void> {
  if (!teamCode || !uid) return;
  const ref = memberRef(teamCode, uid);
  await setDoc(ref, {
    uid,
    name: name.trim() || email.trim() || 'Pengguna',
    email: email.trim(),
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }, { merge: true });
}

export async function updateTeamMemberPresence(teamCode: string, uid: string, name: string, email: string): Promise<void> {
  if (!teamCode || !uid) return;
  await setDoc(memberRef(teamCode, uid), {
    uid,
    name: name.trim() || email.trim() || 'Pengguna',
    email: email.trim(),
    lastSeenAt: serverTimestamp(),
  }, { merge: true });
}

/** Remove the current authenticated user's membership from a team. */
export async function leaveTeam(teamCode: string, uid: string): Promise<void> {
  if (!teamCode || !uid) throw new Error('Data akun atau tim tidak valid.');
  await deleteDoc(memberRef(teamCode, uid));
}

export function subscribeToTeamMembers(
  teamCode: string,
  callback: (members: TeamMember[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!teamCode) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, COLLECTION, teamCode.trim().toUpperCase(), 'members'),
    (snap) => {
      const members = snap.docs
        .map((item) => item.data() as TeamMember)
        .filter((member) => member.uid)
        .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'id'));
      callback(members);
    },
    (error) => {
      console.error('[Firestore] subscribeToTeamMembers error:', error);
      onError?.(error);
    },
  );
}

/**
 * Persists an account's joined team into users/{uid} for reliable multi-device sync.
 */
export async function syncUserTeamToFirebase(
  uid: string,
  teamCode: string,
  isActive: boolean = false,
  name: string = '',
  email: string = '',
): Promise<void> {
  if (!uid || !teamCode) return;
  const cleanCode = teamCode.trim().toUpperCase();
  try {
    const userRef = doc(db, 'users', uid);
    const updateData: Record<string, unknown> = {
      uid,
      joinedTeamCodes: arrayUnion(cleanCode),
      lastUpdated: new Date().toISOString(),
    };
    if (email) updateData.email = email;
    if (name) updateData.displayName = name;
    if (isActive) updateData.activeTeamCode = cleanCode;
    await setDoc(userRef, updateData, { merge: true });

    // Also register in teamMembers collection
    await registerTeamMember(cleanCode, uid, name, email);
  } catch (err) {
    console.warn('[Firestore] Gagal menyimpan relasi tim akun ke users:', err);
  }
}

/**
 * Removes a team from users/{uid} and teamMembers/{teamCode}.
 */
export async function removeUserTeamFromFirebase(uid: string, teamCode: string): Promise<void> {
  if (!uid || !teamCode) return;
  const cleanCode = teamCode.trim().toUpperCase();
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      joinedTeamCodes: arrayRemove(cleanCode),
      lastUpdated: new Date().toISOString(),
    }, { merge: true });
    await leaveTeam(cleanCode, uid);
  } catch (err) {
    console.warn('[Firestore] Gagal menghapus relasi tim akun dari users:', err);
  }
}

/**
 * Rebuild the account's joined-team cache from Firebase.
 * Uses users/{uid} as primary fast source with collectionGroup as secondary discovery.
 */
export async function syncJoinedTeamsFromFirebase(uid: string): Promise<DivisionTeam[]> {
  if (!uid) return [];
  const foundCodes = new Set<string>();

  // 1. Read users/{uid} document directly (fast, index-free, guaranteed per-user)
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (Array.isArray(data?.joinedTeamCodes)) {
        data.joinedTeamCodes.forEach((code: unknown) => {
          if (typeof code === 'string' && code.trim()) {
            foundCodes.add(code.trim().toUpperCase());
          }
        });
      }
      if (typeof data?.activeTeamCode === 'string' && data.activeTeamCode.trim()) {
        foundCodes.add(data.activeTeamCode.trim().toUpperCase());
      }
    }
  } catch (err) {
    console.warn('[Firestore] Membaca users/{uid}:', err);
  }

  // 2. Also try collectionGroup for backward-compatibility
  try {
    const membershipSnap = await getDocs(
      query(collectionGroup(db, 'members'), where('uid', '==', uid)),
    );

    membershipSnap.docs.forEach((item) => {
      const parentTeam = item.ref.parent.parent?.id?.trim().toUpperCase();
      if (parentTeam) {
        foundCodes.add(parentTeam);
      }
    });
  } catch (cgErr) {
    if (foundCodes.size === 0) {
      console.warn('[Firestore] collectionGroup query members:', cgErr);
    }
  }

  if (foundCodes.size === 0) {
    return [];
  }

  const teamCodes = Array.from(foundCodes);
  const teams = (await Promise.all(teamCodes.map((code) => getTeam(code))))
    .filter((team): team is DivisionTeam => Boolean(team?.teamCode));

  return teams;
}
