// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Parser from "rss-parser";
import cors from "cors";

admin.initializeApp();

/** 許可ドメイン（CORS） */
const ALLOWED_ORIGINS = [
  /^https:\/\/app\.anbor\.co\.jp$/,
  /^https:\/\/anborco-app\.web\.app$/,
  /^https:\/\/anborco-app\.firebaseapp\.com$/,
  /^http:\/\/localhost:5173$/,
];

const corsMw = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl 等は Origin なし
    const ok = ALLOWED_ORIGINS.some((rx) => rx.test(origin));
    cb(null, ok);
  },
});

/** Firebase Auth の ID トークン検証 */
async function verifyFirebaseAuth(req: functions.Request) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/i);
  if (!m) return null;
  try {
    return await admin.auth().verifyIdToken(m[1], true);
  } catch {
    return null;
  }
}

type FeedItem = { title?: string; link?: string; isoDate?: string; pubDate?: string };

const parser = new Parser<{}, FeedItem>({
  headers: { "User-Agent": "ComplianceNewsFetcher/1.0 (+firebase)" },
  timeout: 15000 as any,
});

const FEEDS = [
  "https://www.mlit.go.jp/pressrelease.rdf",
  "https://www.mlit.go.jp/road/ir/ir-data/rss.xml",
  "https://www.meti.go.jp/english/rss/index.xml",
  "https://www.mhlw.go.jp/index.rdf",
];

const KEYWORDS = [
  "運送","物流","トラック","貨物","道路運送法","改善基準","標準的な運賃",
  "点呼","アルコール","飲酒","労働時間","過労","監査","行政処分",
  "燃料","軽油","ガソリン","税","補助","カーボン","排出",
];

const hitKeyword = (text = "", kw = KEYWORDS) =>
  kw.some((k) => text.toLowerCase().includes(k.toLowerCase()));

export const complianceNews = functions
  .region("asia-northeast1")
  .https.onRequest(async (req, res) => {
    corsMw(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "GET") return res.status(405).end();

      // ★認証必須（未ログインは 401）
      const user = await verifyFirebaseAuth(req);
      if (!user) return res.status(401).json({ error: "unauthenticated" });

      const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 20)));
      const keywords = String(req.query.q || "").trim();
      const useFilter = keywords.length > 0 || req.query.filter === "1";
      const extraKW = keywords ? keywords.split(/[,\s]+/).filter(Boolean) : [];
      const kwAll = extraKW.length ? [...KEYWORDS, ...extraKW] : KEYWORDS;

      try {
        const results = await Promise.allSettled(
          FEEDS.map(async (url) => {
            const feed = await parser.parseURL(url);
            const site = (feed as any)?.title || "RSS";
            return (feed.items || [])
              .map((it) => ({
                title: it.title?.trim() || "",
                link: it.link?.trim() || "",
                source: site,
                isoDate: it.isoDate || it.pubDate || new Date().toISOString(),
              }))
              .filter((n) => n.title && n.link);
          })
        );

        let items = results
          .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
          .flatMap((r) => r.value);

        // 重複除去
        const seen = new Set<string>();
        items = items.filter((n) => (seen.has(n.link) ? false : (seen.add(n.link), true)));

        if (useFilter) items = items.filter((n) => hitKeyword(n.title, kwAll));
        items.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());

        res.set("Cache-Control", "public, max-age=300, s-maxage=600");
        res.status(200).json({ items: items.slice(0, limit) });
      } catch (e) {
        console.error("[complianceNews] failed", e);
        res.status(500).json({ items: [], error: "fetch_failed" });
      }
    });
  });
