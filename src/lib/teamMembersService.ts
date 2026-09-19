import {
  collection,
  collectionGroup,
  doc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  setDoc,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTeam } from './teamService';\nimport { DivisionTeam } from '../types';

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
 * Rebuild the account's joined-team cache from Firebase.
 * The cache is device-local, while these membership documents are the
 * account-level source of truth shared across devices.
 */
export async function syncJoinedTeamsFromFirebase(uid: string): Promise<DivisionTeam[]> {
  if (!uid) return [];
  const membershipSnap = await getDocs(
    query(collectionGroup(db, 'members'), where('uid', '==', uid)),
  );

  const teamCodes = Array.from(new Set(
    membershipSnap.docs
      .map((item) => item.ref.parent.parent?.id?.trim().toUpperCase() || '')
      .filter(Boolean),
  ));

  const teams = (await Promise.all(teamCodes.map((code) => getTeam(code))))
    .filter((team): team is DivisionTeam => Boolean(team?.teamCode));

  return teams;
}
