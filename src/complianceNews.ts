import * as functions from 'firebase-functions';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

const FEEDS = [
  // 実運用で必要なRSSに変更してください
  'https://www.mlit.go.jp/road/ir/ir-data/rss.xml',
  'https://www.meti.go.jp/english/rss/index.xml',
];

export const complianceNews = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).send('');
  }

  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    const results = await Promise.allSettled(
      FEEDS.map(async (url) => {
        const r = await fetch(url, { timeout: 15000 });
        const xml = await r.text();
        const j = parser.parse(xml);

        // RSS/Atom の両対応（超ざっくり）
        const channel = j.rss?.channel;
        const rssItems = Array.isArray(channel?.item) ? channel.item : [];
        const atomEntries = Array.isArray(j.feed?.entry) ? j.feed.entry : [];
        const source =
          channel?.title ||
          j.feed?.title?._text || // 一部のAtom実装
          j.feed?.title || 'RSS';

        const items = [
          ...rssItems.map((it: any) => ({
            title: it.title,
            link: it.link?.['@_href'] || it.link,
            source,
            isoDate: it.pubDate || it.dc?.date || new Date().toISOString(),
          })),
          ...atomEntries.map((e: any) => ({
            title: e.title?._text || e.title,
            link: (Array.isArray(e.link) ? e.link[0]?.['@_href'] : e.link?.['@_href']) || e.link,
            source,
            isoDate: e.updated || e.published || new Date().toISOString(),
          })),
        ];
        return items;
      })
    );

    const merged: any[] = [];
    results.forEach((p) => {
      if (p.status === 'fulfilled') merged.push(...p.value);
    });
    merged.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());

    res.status(200).json({ items: merged.slice(0, 50) });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ items: [], error: 'fetch_failed' });
  }
});
