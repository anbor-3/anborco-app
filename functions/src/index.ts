// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Parser from "rss-parser";
import * as corsLib from "cors";

admin.initializeApp();

// ★必要な自分のドメインに置き換えてください
const ALLOWED_ORIGINS = [
  /^https:\/\/your-prod\.example\.com$/,
  /^http:\/\/localhost:5173$/,            // 開発用
];

const cors = corsLib({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const ok = ALLOWED_ORIGINS.some((rx) => rx.test(origin));
    cb(null, ok);
  },
});

type FeedItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
};

const parser = new Parser<{}, FeedItem>({
  headers: { "User-Agent": "ComplianceNewsFetcher/1.0 (+firebase)" },
  timeout: 15000 as any,
});

// 公式・転載OKのRSSを中心に（必要に応じて追加）
const FEEDS = [
  // 国土交通省：プレスリリース（RDF）
  "https://www.mlit.go.jp/pressrelease.rdf",
  // 国土交通省：道路関連
  "https://www.mlit.go.jp/road/ir/ir-data/rss.xml",
  // 経産省（英語だが安定）
  "https://www.meti.go.jp/english/rss/index.xml",
  // 厚生労働省（RSS提供あり・労務/安全文脈で役立つ）
  "https://www.mhlw.go.jp/index.rdf",
];

// 絞り込みに使うキーワード（運送・法改正・アルコール等）
const KEYWORDS = [
  "運送", "物流", "トラック", "貨物", "道路運送法", "改善基準", "標準的な運賃",
  "点呼", "アルコール", "飲酒", "労働時間", "過労", "監査", "行政処分",
  "燃料", "軽油", "ガソリン", "税", "補助", "カーボン", "排出",
];

function hitKeyword(text = "", kw = KEYWORDS) {
  const t = text.toLowerCase();
  return kw.some((k) => t.includes(k.toLowerCase()));
}

export const complianceNews = functions
  .region("asia-northeast1")
  .https.onRequest(async (req, res) => {
    cors(req, res, async () => {
      const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 20)));
      const keywords = String(req.query.q || "").trim();
      const useFilter = keywords.length > 0 || req.query.filter === "1";

      // 任意の追加フィルタ（?q=アルコール など）
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

        // merge
        let items = results
          .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
          .flatMap((r) => r.value);

        // 重複除去（link基準）
        const seen = new Set<string>();
        items = items.filter((n) => {
          if (seen.has(n.link)) return false;
          seen.add(n.link);
          return true;
        });

        // キーワードで絞り込み（?filter=1 もしくは ?q=指定時）
        if (useFilter) {
          items = items.filter((n) => hitKeyword(n.title, kwAll));
        }

        // ソート
        items.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());

        // 返却件数の絞り込み
        const top = items.slice(0, limit);

        // キャッシュ推奨ヘッダ（CDN/ブラウザ）
        res.set("Cache-Control", "public, max-age=300, s-maxage=600");
        res.status(200).json({ items: top });
      } catch (e) {
        console.error("[complianceNews] failed", e);
        res.status(500).json({ items: [], error: "fetch_failed" });
      }
    });
  });
