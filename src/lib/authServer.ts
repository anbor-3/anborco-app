// src/lib/authServer.ts
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from './firebaseAdmin';

export type UserProfile = {
  role: 'driver' | 'admin' | 'master';
  company: string;
  name?: string;
};

export async function verifyBearer(req: Request) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('Missing Authorization header');
  const decoded = await getAuth().verifyIdToken(token);
  return decoded; // { uid, email, ... }
}

export async function getUserDoc(uid: string): Promise<UserProfile> {
  const snap = await adminDb.doc(`users/${uid}`).get();
  if (!snap.exists) throw new Error('No user profile');
  return snap.data() as UserProfile;
}

export async function requireSameCompanyOrAdmin(
  requester: { uid: string },
  company: string
) {
  const profile = await getUserDoc(requester.uid);
  const ok = profile.company === company && ['admin', 'master'].includes(profile.role);
  if (!ok) throw new Error('Forbidden');
  return profile;
}
