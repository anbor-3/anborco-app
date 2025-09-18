"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.complianceNews = void 0;
// functions/src/index.ts
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const rss_parser_1 = __importDefault(require("rss-parser"));
const cors_1 = __importDefault(require("cors"));
admin.initializeApp();
/** 本番で呼び出す想定の許可ドメイン */
const ALLOWED_ORIGINS = [
    /^https:\/\/app\.anbor\.co\.jp$/, // 将来のカスタムドメイン
    /^https:\/\/anborco-app\.web\.app$/, // いま表示している本番 Hosting
    /^https:\/\/anborco-app\.firebaseapp\.com$/, // 旧URL（念のため）
    /^http:\/\/localhost:5173$/, // 開発用
];
const corsMw = (0, cors_1.default)({
    origin(origin, cb) {
        if (!origin)
            return cb(null, true); // curl等
        const ok = ALLOWED_ORIGINS.some((rx) => rx.test(origin));
        cb(null, ok);
    },
});
const parser = new rss_parser_1.default({
    headers: { "User-Agent": "ComplianceNewsFetcher/1.0 (+firebase)" },
    timeout: 15000,
});
const FEEDS = [
    "https://www.mlit.go.jp/pressrelease.rdf",
    "https://www.mlit.go.jp/road/ir/ir-data/rss.xml",
    "https://www.meti.go.jp/english/rss/index.xml",
    "https://www.mhlw.go.jp/index.rdf",
];
const KEYWORDS = [
    "運送", "物流", "トラック", "貨物", "道路運送法", "改善基準", "標準的な運賃",
    "点呼", "アルコール", "飲酒", "労働時間", "過労", "監査", "行政処分",
    "燃料", "軽油", "ガソリン", "税", "補助", "カーボン", "排出",
];
const hitKeyword = (text = "", kw = KEYWORDS) => kw.some((k) => text.toLowerCase().includes(k.toLowerCase()));
exports.complianceNews = functions
    .region("asia-northeast1")
    .https.onRequest(async (req, res) => {
    corsMw(req, res, async () => {
        const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 20)));
        const keywords = String(req.query.q || "").trim();
        const useFilter = keywords.length > 0 || req.query.filter === "1";
        const extraKW = keywords ? keywords.split(/[,\s]+/).filter(Boolean) : [];
        const kwAll = extraKW.length ? [...KEYWORDS, ...extraKW] : KEYWORDS;
        try {
            const results = await Promise.allSettled(FEEDS.map(async (url) => {
                const feed = await parser.parseURL(url);
                const site = feed?.title || "RSS";
                return (feed.items || [])
                    .map((it) => ({
                    title: it.title?.trim() || "",
                    link: it.link?.trim() || "",
                    source: site,
                    isoDate: it.isoDate || it.pubDate || new Date().toISOString(),
                }))
                    .filter((n) => n.title && n.link);
            }));
            let items = results
                .filter((r) => r.status === "fulfilled")
                .flatMap((r) => r.value);
            // link重複除去
            const seen = new Set();
            items = items.filter((n) => (seen.has(n.link) ? false : (seen.add(n.link), true)));
            if (useFilter)
                items = items.filter((n) => hitKeyword(n.title, kwAll));
            items.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
            res.set("Cache-Control", "public, max-age=300, s-maxage=600");
            res.status(200).json({ items: items.slice(0, limit) });
        }
        catch (e) {
            console.error("[complianceNews] failed", e);
            res.status(500).json({ items: [], error: "fetch_failed" });
        }
    });
});
