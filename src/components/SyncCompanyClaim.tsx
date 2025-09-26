import { useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
// ※ ここより前で firebase.initializeApp 済みのこと（例: src/firebase.ts をアプリ起動時に import）

export default function SyncCompanyClaim() {
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const res = await user.getIdTokenResult(true);
        const company = String((res?.claims as any)?.company || "").trim();
        if (company) localStorage.setItem("company", company);
      } catch (e) {
        console.warn("companyクレーム取得に失敗:", e);
      }
    });
    return () => unsub();
  }, []);
  return null;
}
