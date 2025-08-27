// src/lib/firebaseAdmin.ts
import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * 管理SDK初期化:
 * 1) FIREBASE_ADMIN_JSON にサービスアカウント JSON を丸ごと入れる方式
 * 2) FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY の3分割方式（※PRIVATE_KEYは \n 置換）
 * 3) どれも無ければ ADC（GOOGLE_APPLICATION_CREDENTIALS）にフォールバック
 */
function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  // 1) JSON まるごと
  const raw = process.env.FIREBASE_ADMIN_JSON;
  if (raw) {
    const json = JSON.parse(raw);
    return initializeApp({ credential: cert(json) });
  }

  // 2) 3分割（Vercel で使いやすい）
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  // 3) ADC
  return initializeApp();
}

export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);

/** Authorization: Bearer <ID_TOKEN> を検証 */
export async function verifyIdToken(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }
  const idToken = authHeader.slice("Bearer ".length);
  return await getAuth(adminApp).verifyIdToken(idToken);
}
