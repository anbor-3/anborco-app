// src/utils/news.ts
export type NewsItem = {
  title: string;
  link: string;
  source: string;
  isoDate: string;
};

type Params = { q?: string; limit?: number; filter?: boolean };

// Cloud Functions の URL（.env で上書き可）
const DEFAULT_URL =
  "https://asia-northeast1-anborco-app.cloudfunctions.net/complianceNews";

const FN_URL =
  (import.meta as any).env?.VITE_NEWS_FN_URL?.trim() || DEFAULT_URL;

/** 法令・業界ニュースを取得 */
export async function fetchComplianceNews(
  params: Params = { filter: true, limit: 20 }
): Promise<NewsItem[]> {
  const url = new URL(FN_URL);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.filter) url.searchParams.set("filter", "1");
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString(), { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { items?: NewsItem[] };
  return json.items ?? [];
}
