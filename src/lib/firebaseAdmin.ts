// src/lib/firebaseAdmin.ts
import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * 環境変数の用意（どちらかでOK）
 * - GOOGLE_APPLICATION_CREDENTIALS を使う（推奨。GCP/Cloud Run/Render等）
 * - もしくは FIREBASE_ADMIN_JSON にサービスアカウントJSON文字列を入れる
 */
function getAdminApp(): App {
  const apps = getApps();
  if (apps.length) return apps[0];

  // 1) FIREBASE_ADMIN_JSON の場合（ローカルやVercelで使いやすい）
  const raw = process.env.FIREBASE_ADMIN_JSON;
  if (raw) {
    const json = JSON.parse(raw);
    return initializeApp({
      credential: cert(json),
    });
  }

  // 2) GOOGLE_APPLICATION_CREDENTIALS が設定されていれば SDK が自動読込
  return initializeApp();
}

const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);
