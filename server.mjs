// server.mjs (ESM) — dev-only API for Vite
import express from "express";
import cors from "cors";

/* === 追加: 公式RSS集約に必要 === */
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

const app = express();
app.use(cors());
app.use(express.json());

/* ====================== ここから既存通知API ====================== */
// In-memory notifications (replace with DB in real app)
let items = [
  {
    id: "1",
    type: "report",
    category: "日報",
    message: "山田太郎さんの日報未提出",
    target: null,
    createdAt: new Date().toISOString(),
    read: false,
  },
];

// GET /api/notifications
app.get("/api/notifications", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(items);
});

// POST /api/notifications/:id/read
app.post("/api/notifications/:id/read", (req, res) => {
  const i = items.findIndex((n) => n.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  items[i].read = true;
  res.json({ ok: true });
});

// DELETE /api/notifications/:id
app.delete("/api/notifications/:id", (req, res) => {
  const before = items.length;
  items = items.filter((n) => n.id !== req.params.id);
  if (items.length === before) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});
/* ====================== 既存通知APIここまで ====================== */

/* ====================== 追加: 公式RSS集約API ====================== */
// 転載OKな一次情報（国交省＋e-Govパブコメ結果RSS など）
const FEEDS = [
  "https://www.mlit.go.jp/page/rss/press.xml", // 国交省 プレス
  "https://www.mlit.go.jp/page/rss/news.xml",  // 国交省 新着
  "https://public-comment.e-gov.go.jp/rss/pcm_result_0000000042.xml", // e-Gov 結果公示(運送領域)
];

// XMLパーサ
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

// 単純メモリキャッシュ（5分）
let newsCache = { at: 0, items: [] };
const TTL_MS = 1000 * 60 * 5;

// GET /api/compliance-news ー 最新5件返す
app.get("/api/compliance-news", async (req, res) => {
  try {
    const now = Date.now();
    if (newsCache.items.length && now - newsCache.at < TTL_MS) {
      return res.json({ items: newsCache.items.slice(0, 5), cached: true });
    }

    const results = await Promise.allSettled(
      FEEDS.map(async (url) => {
        const r = await fetch(url, { headers: { "User-Agent": "anborco-compliance/1.0" } });
        if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
        const text = await r.text();
        const xml = parser.parse(text);

        // RSS or Atom に対応
        const channelItems = xml?.rss?.channel?.item || [];
        const atomItems = xml?.feed?.entry || [];

        const items = (channelItems.length ? channelItems : atomItems).map((it) => ({
          title: (it.title?.["#text"] || it.title || "").toString().trim(),
          link:
            (it.link?.href || it.link || it.guid?.["#text"] || it.guid || "").toString().trim(),
          source: new URL(url).hostname,
          isoDate: new Date(
            it.pubDate || it.updated || it.published || it["dc:date"] || Date.now()
          ).toISOString(),
        }));

        return items;
      })
    );

    const merged = results.flatMap((p) => (p.status === "fulfilled" ? p.value : []));
    merged.sort((a, b) => new Date(b.isoDate) - new Date(a.isoDate));

    newsCache = { at: now, items: merged };
    res.set("Cache-Control", "no-store");
    return res.json({ items: merged.slice(0, 5), cached: false });
  } catch (e) {
    console.error("[/api/compliance-news] error", e);
    if (newsCache.items.length) {
      return res.json({ items: newsCache.items.slice(0, 5), cached: true });
    }
    return res.status(500).json({ items: [], error: "failed to fetch news" });
  }
});
/* ====================== 追加ここまで ====================== */

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
