import 'server-only';
import Parser from 'rss-parser';

export const runtime = 'nodejs';   // ★ Edgeだとライブラリが動かないケースがある
export const revalidate = 300;     // 5分キャッシュ

type FeedItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  // Atom/RDFなどで使われがちなフィールドの保険
  updated?: string;
  dc?: { date?: string };
};

type OutItem = { title: string; link: string; source: string; isoDate: string };

const SOURCES = [
  { name: '国土交通省（プレス）', url: 'https://www.mlit.go.jp/pressrelease.rdf', kind: 'transport' },
  { name: '経済産業省（ニュースリリース）', url: 'https://www.meti.go.jp/ml_index_release_atom.xml', kind: 'energy' },
];

const KEYWORDS = [
  // 燃料・エネルギー系
  '燃料','ガソリン','軽油','石油','lpガス','lpg','燃料価格','補助','税','課税','炭素','カーボン','排出',
  // 運送・物流・自動車系
  '運送','輸送','物流','トラック','貨物','自動車','道路運送法','安全','点呼','アルコール','改善基準','過労','標準的な運賃'
];

const UA = {
  'user-agent': 'ComplianceDashboard/1.0 (+https://example.com) RSS-Parser',
  'accept': 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
};

/** 文字列からISO文字列へ（失敗時はnull） */
function toIso(d?: string) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(+dt) ? null : dt.toISOString();
}

function hitKeyword(text: string) {
  const t = (text || '').toLowerCase();
  return KEYWORDS.some(k => t.includes(k.toLowerCase()));
}

/** RSS/ATOM/RDFを取得して配列に正規化 */
async function fetchFeedItems(url: string, sourceName: string, parser: Parser<any, FeedItem>): Promise<OutItem[]> {
  const out: OutItem[] = [];

  // まず parseURL を試す（UA付与）
  try {
    const feed = await parser.parseURL(url);
    for (const it of feed.items || []) {
      const title = (it.title || '').trim();
      const link = it.link || '';
      if (!title || !link) continue;
      if (!hitKeyword(title)) continue;

      const iso =
        toIso((it as any).isoDate) ||
        toIso(it.pubDate) ||
        toIso((it as any).updated) ||
        toIso((it.dc && it.dc.date) || undefined) ||
        new Date().toISOString();

      out.push({ title, link, source: sourceName, isoDate: iso });
    }
    return out;
  } catch (e) {
    console.warn('parseURL failed, fallback to fetch+parseString:', url, e);
  }

  // フォールバック：自分でfetch→文字列をparse
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(url, { headers: UA, signal: ac.signal, cache: 'no-store' as RequestCache });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const feed = await parser.parseString(xml);

    for (const it of (feed.items || [])) {
      const title = (it.title || '').trim();
      const link = it.link || '';
      if (!title || !link) continue;
      if (!hitKeyword(title)) continue;

      const iso =
        toIso((it as any).isoDate) ||
        toIso(it.pubDate) ||
        toIso((it as any).updated) ||
        toIso((it.dc && it.dc.date) || undefined) ||
        new Date().toISOString();

      out.push({ title, link, source: sourceName, isoDate: iso });
    }
  } finally {
    clearTimeout(timer);
  }
  return out;
}

export async function GET() {
  // UA/タイムアウトを設定したParser（parseURLにはUAが素通りすることもあるため保険）
  const parser = new Parser<any, FeedItem>({
    timeout: 10000,
    requestOptions: { headers: UA as any },
    customFields: {
      item: [
        ['dc:date', 'dc.date'], // RDF向け
        ['updated', 'updated'], // Atom向け
      ],
    },
  });

  const collected: OutItem[] = [];
  for (const s of SOURCES) {
    try {
      const arr = await fetchFeedItems(s.url, s.name, parser);
      collected.push(...arr);
    } catch (e) {
      console.error('Feed fatal error:', s.url, e);
    }
  }

  // 日付降順で5件に絞る
  collected.sort((a, b) => +new Date(b.isoDate) - +new Date(a.isoDate));
  const top5 = collected.slice(0, 5);

  return new Response(JSON.stringify({ items: top5 }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=300',
    },
    status: 200,
  });
}
