// src/firebaseClient.ts ーーー全文
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 必須環境変数のチェック（Viteは VITE_ プレフィックスが必要）
function requireEnv(name: string): string {
  const v = import.meta.env[name as keyof ImportMetaEnv] as unknown as string | undefined;
  if (!v || String(v).trim() === "") {
    const msg =
      `Missing env: ${name}\n` +
      `• Vite では "VITE_" プレフィックスが必須です\n` +
      `• プロジェクト直下に .env.local を作成し、${name}=... を設定してください\n` +
      `• その後、開発サーバー/デプロイを再起動してください`;
    throw new Error(msg);
  }
  return v;
}

const firebaseConfig = {
  apiKey: requireEnv("VITE_FB_API_KEY"),
  authDomain: requireEnv("VITE_FB_AUTH_DOMAIN"),
  projectId: requireEnv("VITE_FB_PROJECT_ID"),
  appId: requireEnv("VITE_FB_APP_ID"),
  storageBucket: requireEnv("VITE_FB_STORAGE_BUCKET"),
  // 任意の追加キーがあればここに追記してOK
  // messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  // measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID,
  // databaseURL: import.meta.env.VITE_FB_DATABASE_URL,
};

// HMRやSSR対策：多重初期化を防止
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 共有インスタンス
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// （必要なら default export も付けられます）
// export default app;
