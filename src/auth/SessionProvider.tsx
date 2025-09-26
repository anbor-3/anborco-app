// src/auth/SessionProvider.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// API 基点（あなたの既存関数でOK）
const RAW_BASE =
  (process.env.NEXT_PUBLIC_API_BASE as string) ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  "";
const API_BASE = RAW_BASE.replace(/\/$/, "");
const api = (p: string) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

type Session = {
  ready: boolean;           // ← これが true になるまで画面は描画しない
  uid?: string;
  loginId?: string;
  displayName?: string;
  company?: string;
  role?: string;
};

const SessionContext = createContext<Session>({ ready: false });
export const useSession = () => useContext(SessionContext);

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ ready: false });

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSession({ ready: true }); // 未ログインだが描画は許可（ログイン画面など）
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch(api("/api/me"), {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        // DBに未登録などの場合は、最低限のユーザー名だけ入れておく
        setSession({ ready: true, uid: user.uid, displayName: user.email ?? "unknown" });
        return;
      }
      const me = await res.json();
      setSession({
        ready: true,
        uid: me.uid,
        loginId: me.loginId,
        displayName: me.displayName,
        company: me.company,
        role: me.role,
      });
    });
    return () => unsub();
  }, []);

  return (
    <SessionContext.Provider value={session}>
      {session.ready ? children : null /* ← 初期化完了まで描画しない */}
    </SessionContext.Provider>
  );
}
