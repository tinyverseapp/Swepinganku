import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

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
