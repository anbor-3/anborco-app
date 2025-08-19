import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/** Authorization: Bearer <idToken> を検証し、uid / companyId / role を返す */
export async function requireUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) throw new Error('missing token');
  const decoded = await admin.auth().verifyIdToken(token);

  // 本番は custom claims の companyId/role を設定する想定
  const companyId = (decoded as any).companyId || process.env.DEFAULT_COMPANY_ID!;
  const uid = decoded.uid;
  const role = (decoded as any).role || 'admin';

  if (!companyId) throw new Error('companyId not found');

  return { uid, companyId, role };
}
