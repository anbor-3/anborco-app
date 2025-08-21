import "server-only";
import Parser from "rss-parser";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";   // Edge不可（rss-parser対策）
export const revalidate = 300;     // 5分キャッシュ

type FeedItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  updated?: string;
  dc?: { date?: string };
};
type OutItem = { title: string; link: string; source: string; isoDate: string };

// 公式ソース
const SOURCES = [
  { name: "国土交通省（プレス）", url: "https://www.mlit.go.jp/pressrelease.rdf" },
  { name: "国土交通省（道路情報）", url: "https://www.mlit.go.jp/road/ir/ir-data/rss.xml" },
  { name: "経済産業省（ニュース）", url: "https://www.meti.go.jp/ml_index_release_atom.xml" },
];

// 検索キーワード（最初はこれで絞り込み、件数少なければ全件も拾う）
const KEYWORDS = [
  "燃料","ガソリン","軽油","石油","lpガス","lpg","燃料価格","補助","税","課税","炭素","カーボン","排出",
  "運送","輸送","物流","トラック","貨物","自動車","道路運送法","安全","点呼","アルコール","改善基準","過労","標準的な運賃"
];

const UA = {
  "user-agent": "ComplianceDashboard/1.0 (+https://example.com) RSS-Parser",
  "accept":
    "application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
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

/** link から安定ID生成（FirestoreドキュメントIDに使う） */
function linkId(link: string) {
  return Buffer.from(link).toString("base64url"); // 衝突ほぼ無し
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
    console.warn("parseURL failed, fallback to fetch+parseString:", url, e);
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
  // UA/タイムアウト設定
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

  // ①キーワード絞り込みで取得
  let collected: OutItem[] = [];
  for (const s of SOURCES) {
    try {
      const arr = await fetchFeedItems(s.url, s.name, parser, true);
      collected.push(...arr);
    } catch (e) {
      console.error("Feed error:", s.url, e);
    }
  }

  // 少なければ ②全件（キーワード無し）でもう一度
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

  // DBへ UPSERT（link をID化して set merge）
  const batch = adminDb.batch();
  for (const it of collected) {
    const id = linkId(it.link);
    const ref = adminDb.collection("news").doc(id);
    batch.set(
      ref,
      {
        title: it.title,
        link: it.link,
        source: it.source,
        isoDate: it.isoDate,            // ISO文字列で保存（クエリしやすい）
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 5))); // デフォ5
  const cursor = url.searchParams.get("cursor"); // 例: 2024-05-01T00:00:00.000Z より古いもの

  // 1) 取得してDBに upsert（失敗しても無視して続行）
  try {
    await crawlAndUpsertToDb();
  } catch (e) {
    console.error("[news] crawl failed", e);
  }

  // 2) DBから「最新→過去」ページングで読む
  let q = adminDb.collection("news").orderBy("isoDate", "desc");
  if (cursor) {
    // cursor より "古い" ものを続きとして取得
    q = q.where("isoDate", "<", cursor).orderBy("isoDate", "desc");
  }
  const snap = await q.limit(limit).get();
  const items = snap.docs.map((d) => d.data() as OutItem);

  // 3) nextCursor を返す（次ページの起点）
  const nextCursor = items.length > 0 ? items[items.length - 1].isoDate : null;

  return new Response(JSON.stringify({ items, nextCursor }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=300",
    },
    status: 200,
  });
}
