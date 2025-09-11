// src/utils/news.ts
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

export type NewsItem = {
  title: string;
  link: string;
  source: string;
  isoDate: string;
};

type Params = { q?: string; limit?: number; filter?: boolean };

// デフォルトは本番の Cloud Functions URL（必要なら .env の VITE_NEWS_FN_URL で上書き）
const DEFAULT_URL =
  "https://asia-northeast1-anborco-app.cloudfunctions.net/complianceNews";

const FN_URL =
  (import.meta as any).env?.VITE_NEWS_FN_URL?.trim?.() || DEFAULT_URL;

// ログイン状態の決定を待つ（未ログインでも null が返る）
function waitUser(): Promise<User | null> {
  const auth = getAuth();
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });
}

/** 法令ニュース取得（Auth 必須・ID トークンを付与） */
export async function fetchComplianceNews(
  params: Params = { filter: true, limit: 20 }
): Promise<NewsItem[]> {
  const url = new URL(FN_URL);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.filter) url.searchParams.set("filter", "1");
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const user = await waitUser();
  const idToken = user ? await user.getIdToken() : null;

  const headers: Record<string, string> = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const res = await fetch(url.toString(), {
    mode: "cors",
    credentials: "omit",
    headers,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = (await res.json()) as { items?: NewsItem[] };
  return json.items ?? [];
}
