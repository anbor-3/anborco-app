import "server-only";
import Parser from "rss-parser";
import { adminDb } from "@/lib/firebaseAdmin";

// ★ Next.js のルートハンドラは revalidate よりも dynamic 指定の方が効く
export const runtime = "nodejs";            // Edge不可（rss-parser対策）
export const dynamic = "force-dynamic";     // 毎回サーバで実行
// revalidate は pages/route によっては無視されることがあるため cache-control で制御する

type FeedItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  updated?: string;
  dc?: { date?: string };
};
type OutItem = { title: string; link: string; source: string; isoDate: string };

// 公式一次ソース（運送領域に直結）
const SOURCES = [
  { name: "国土交通省（プレス）", url: "https://www.mlit.go.jp/page/rss/press.xml" },
  { name: "国土交通省（新着）",   url: "https://www.mlit.go.jp/page/rss/news.xml" },
  { name: "e-Gov（運送：結果）",  url: "https://public-comment.e-gov.go.jp/rss/pcm_result_0000000042.xml" },
];

// 緊急バックアップ（ゼロ件回避用／公式リンクを手で入れてOK）
const EMERGENCY_SEED: OutItem[] = [
  // 必要に応じて差し替え
  {
    title: "（例）改正貨物自動車運送事業法 特設ページ",
    link: "https://www.mlit.go.jp/jidosha/jidosha_tk6_000071.html",
    source: "www.mlit.go.jp",
    isoDate: "2025-04-01T00:00:00.000Z",
  },
];

const KEYWORDS = [
  "燃料","ガソリン","軽油","石油","lpガス","lpg","燃料価格","補助","税","課税","炭素","カーボン","排出",
  "運送","輸送","物流","トラック","貨物","自動車","道路運送法","安全","点呼","アルコール","改善基準","過労","標準的な運賃","2025年","2025/04"
];

const UA = {
  "user-agent": "ComplianceDashboard/1.0 (+https://example.com) RSS-Parser",
  "accept": "application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
};

function toIso(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(+dt) ? null : dt.toISOString();
}
function hitKeyword(text: string) {
  const t = (text || "").toLowerCase();
  return KEYWORDS.some((k) => t.includes(k.toLowerCase()));
}
function linkId(link: string) {
  return Buffer.from(link).toString("base64url");
}

/** RSS/ATOM/RDF → 正規化（useKeyword=true でタイトルをキーワード絞り込み） */
async function fetchFeedItems(
  url: string,
  sourceName: string,
  parser: Parser<any, FeedItem>,
  useKeyword: boolean
): Promise<OutItem[]> {
  const out: OutItem[] = [];

  // 1) parseURL
  try {
    const feed = await parser.parseURL(url);
    for (const it of feed.items || []) {
      const title = (it.title || "").trim();
      const link = (it.link || "").trim();
      if (!title || !link) continue;
      if (useKeyword && !hitKeyword(title)) continue;

      const iso =
        toIso((it as any).isoDate) ||
        toIso(it.pubDate) ||
        toIso((it as any).updated) ||
        toIso((it.dc && it.dc.date) || undefined) ||
        new Date().toISOString();

      out.push({ title, link, source: sourceName, isoDate: iso! });
    }
    return out;
  } catch (e) {
    console.warn("[parseURL failed] fallback to fetch+parseString:", url, e);
  }

  // 2) フォールバック：fetch→parseString
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: UA,
      signal: ac.signal,
      cache: "no-store" as RequestCache,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const feed = await parser.parseString(xml);

    for (const it of feed.items || []) {
      const title = (it.title || "").trim();
      const link = (it.link || "").trim();
      if (!title || !link) continue;
      if (useKeyword && !hitKeyword(title)) continue;

      const iso =
        toIso((it as any).isoDate) ||
        toIso(it.pubDate) ||
        toIso((it as any).updated) ||
        toIso((it.dc && it.dc.date) || undefined) ||
        new Date().toISOString();

      out.push({ title, link, source: sourceName, isoDate: iso! });
    }
  } finally {
    clearTimeout(timer);
  }
  return out;
}

async function crawlAndUpsertToDb() {
  const parser = new Parser<any, FeedItem>({
    timeout: 10000,
    requestOptions: { headers: UA as any },
    customFields: {
      item: [
        ["dc:date", "dc.date"],
        ["updated", "updated"],
      ],
    },
  });

  let collected: OutItem[] = [];

  // ①キーワード絞り込みで取得
  for (const s of SOURCES) {
    try {
      const arr = await fetchFeedItems(s.url, s.name, parser, true);
      collected.push(...arr);
    } catch (e) {
      console.error("Feed error:", s.url, e);
    }
  }
  // 少なければ ②全件（キーワード無し）
  if (collected.length < 10) {
    for (const s of SOURCES) {
      try {
        const arr = await fetchFeedItems(s.url, s.name, parser, false);
        collected.push(...arr);
      } catch (e) {
        console.error("Fallback feed error:", s.url, e);
      }
    }
  }

  // 重複除去（link 基準）
  const seen = new Set<string>();
  collected = collected.filter((n) => {
    const key = n.link || `t:${n.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 新しい順に
  collected.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());

  // DBへ UPSERT（link をID化して set merge）— DBがNGでも画面は直返しで出すので try/catch
  if (collected.length) {
    try {
      const batch = adminDb.batch();
      for (const it of collected) {
        const id = linkId(it.link);
        const ref = adminDb.collection("news").doc(id);
        batch.set(
          ref,
          { title: it.title, link: it.link, source: it.source, isoDate: it.isoDate, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }
      await batch.commit();
    } catch (e) {
      console.error("[news] upsert failed (ignored for response)", e);
    }
  }

  return collected; // 直返しフォールバック用に返す
}

// DBを介さず即返し（crawlAndUpsertToDb の戻り値を使う）
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit  = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 5)));
  const cursor = url.searchParams.get("cursor");
  const force  = url.searchParams.get("force") === "1";

  // 1) 取得（毎回試行）— 結果は返却にも使う
  let crawled: OutItem[] = [];
  try {
    crawled = await crawlAndUpsertToDb();
  } catch (e) {
    console.error("[news] crawl failed", e);
  }

  // 2) DBから最新を読む（cursor指定があれば続き）
  let items: OutItem[] = [];
  try {
    let q = adminDb.collection("news").orderBy("isoDate", "desc");
    if (cursor) q = q.where("isoDate", "<", cursor).orderBy("isoDate", "desc");
    const snap = await q.limit(limit).get();
    items = snap.docs.map((d) => d.data() as OutItem);
  } catch (e) {
    console.error("[news] read DB failed (falling back to crawled)", e);
  }

  // 3) DBが空のときは crawl の結果から直返し
  if (items.length === 0) {
    if (crawled.length === 0 && EMERGENCY_SEED.length) {
      items = EMERGENCY_SEED.slice(0, limit);
    } else {
      // crawled が多い場合は最新順にソートのうえ limit
      crawled.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
      items = crawled.slice(0, limit);
    }
  }

  const nextCursor = items.length > 0 ? items[items.length - 1].isoDate : null;

  const headers: Record<string,string> = {
    "content-type": "application/json; charset=utf-8",
    // force=1 のときは CDN キャッシュ回避
    "cache-control": force ? "no-store" : "public, s-maxage=300, stale-while-revalidate=300",
  };

  return new Response(JSON.stringify({ items, nextCursor }), { headers, status: 200 });
}
