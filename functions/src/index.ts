import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as corsLib from "cors";
import Parser from "rss-parser";

admin.initializeApp();
const cors = corsLib({ origin: true });
const parser = new Parser({
  headers: { "User-Agent": "ComplianceNewsFetcher/1.0 (+firebase)" },
  timeout: 15000 as any, // 型回避（古い型定義だと無いことがある）
});

const FEEDS = [
  "https://www.mlit.go.jp/road/ir/ir-data/rss.xml",
  "https://www.meti.go.jp/english/rss/index.xml",
  // 必要に応じて追加
];

export const complianceNews = functions
  .region("asia-northeast1")
  .https.onRequest(async (req, res) => {
    cors(req, res, async () => {
      try {
        const results = await Promise.allSettled(
          FEEDS.map(async (url) => {
            const feed = await parser.parseURL(url);
            const site = feed?.title || "RSS";
            return (feed.items || []).map((it) => ({
              title: it.title || "",
              link: it.link || "",
              source: site,
              isoDate: it.isoDate || it.pubDate || new Date().toISOString(),
            }));
          })
        );
        const items = results
          .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
          .flatMap((r) => r.value)
          .filter((n) => n.title && n.link);

        items.sort(
          (a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime()
        );

        // キャッシュ推奨ヘッダ（CDN/ブラウザ）
        res.set("Cache-Control", "public, max-age=300, s-maxage=600");
        res.status(200).json({ items });
      } catch (e) {
        console.error("[complianceNews] failed", e);
        res.status(500).json({ items: [], error: "fetch_failed" });
      }
    });
  });
