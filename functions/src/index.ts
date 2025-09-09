// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Parser from "rss-parser";
import cors from "cors";               // ← default import を使用

admin.initializeApp();

// ★必要に応じて自社ドメインへ
const ALLOWED_ORIGINS = [
  /^https:\/\/your-prod\.example\.com$/,
  /^http:\/\/localhost:5173$/,
];

// 変数名は corsMw にして予約名の衝突を回避
const corsMw = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const ok = ALLOWED_ORIGINS.some((rx) => rx.test(origin));
    cb(null, ok);
  },
});

type FeedItem = { title?: string; link?: string; isoDate?: string; pubDate?: string };

const parser = new Parser<{}, FeedItem>({
  headers: { "User-Agent": "ComplianceNewsFetcher/1.0 (+firebase)" },
  timeout: 15000 as any,
});

// 公式フィード（必要に応じて追加）
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

function hitKeyword(text = "", kw = KEYWORDS) {
  const t = text.toLowerCase();
  return kw.some((k) => t.includes(k.toLowerCase()));
}

export const complianceNews = functions
  .region("asia-northeast1")
  .https.onRequest(async (req, res) => {
    corsMw(req, res, async () => {
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

        // link重複除去
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
