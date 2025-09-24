// server.mjs (ESM) — dev-only API for Vite
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

/* === 既存: 法令ニュース集約に使用 === */
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";

/* === 追加: DB & Firebase Admin === */
import { Pool } from "pg";
import admin from "firebase-admin";
import Stripe from "stripe";

dotenv.config({ path: "./server/.env.local" });
/** 予備：ルートに .env があればそちらも読む（任意） */
dotenv.config();

// ===== Stripe 初期化（テスト鍵 sk_test_... を .env に）=====
const { STRIPE_SECRET_KEY, PUBLIC_WEB_BASE_URL } = process.env;
const stripe = new Stripe(STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-06-20" });

// 価格ID（.env から読む）
const PRICES = {
  monthly: {
    basic: process.env.PRICE_BASIC,
    advanced: process.env.PRICE_ADVANCED,
    pro: process.env.PRICE_PRO,
    elite: process.env.PRICE_ELITE,
    premium: process.env.PRICE_PREMIUM,
  },
  // Unlimited は「基本料」と「追加ユーザー（月額・段階課金）」を別IDで管理
  unlimited: {
    base: process.env.PRICE_UNL_BASE,   // 数量=1
    extra: process.env.PRICE_UNL_EXTRA, // 数量=総人数（0-100は¥0, 101+は¥800/人の段階価格）
  },
  // 導入費（任意）
  setup: {
    none: null,
    basic: process.env.PRICE_SETUP_BASIC,
    standard: process.env.PRICE_SETUP_STANDARD,
    premium: process.env.PRICE_SETUP_PREMIUM,
    unlimited: process.env.PRICE_SETUP_UNLIMITED,
  },
};

const app = express();
app.use(cors({
  origin: ["https://app.anbor.co.jp"],
  credentials: true,
}));
app.use(express.json());

/* ====================== Firebase Admin 初期化 ====================== */
try {
  admin.app();
} catch {
  // Application Default Credentials（推奨）or サービスアカウントJSON（環境変数 GOOGLE_APPLICATION_CREDENTIALS）
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/* ====================== Neon PostgreSQL 接続 ====================== */
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) console.warn("⚠️ DATABASE_URL が未設定です（Neon 接続に必要）");

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon は基本 SSL 必須
});

/* ====================== 認証ミドルウェア ====================== */
const SKIP_AUTH = process.env.SKIP_AUTH === "true"; // ローカル開発用（本番で true にしない）

async function verifyFirebaseToken(req, res, next) {
  if (SKIP_AUTH && process.env.NODE_ENV !== "production") {
    req.user = { uid: "dev-skip" };
    return next();
  }
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // { uid, email, ... }
    return next();
  } catch (e) {
    console.error("[Auth] verifyIdToken error:", e);
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ====================== 既存: 通知API（メモリ） ====================== */
// In-memory notifications (replace with DB later)
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
app.get("/api/notifications", (_req, res) => {
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

/* ====================== 既存: 公式RSS集約API ====================== */
const FEEDS = [
  "https://www.mlit.go.jp/page/rss/press.xml", // 国交省 プレス
  "https://www.mlit.go.jp/page/rss/news.xml",  // 国交省 新着
  "https://public-comment.e-gov.go.jp/rss/pcm_result_0000000042.xml", // e-Gov 結果公示
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
let newsCache = { at: 0, items: [] };
const TTL_MS = 1000 * 60 * 5;

// GET /api/compliance-news ー 最新5件返す
app.get("/api/compliance-news", async (_req, res) => {
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

        const channelItems = xml?.rss?.channel?.item || [];
        const atomItems = xml?.feed?.entry || [];

        const items = (channelItems.length ? channelItems : atomItems).map((it) => ({
          title: (it.title?.["#text"] || it.title || "").toString().trim(),
          link: (it.link?.href || it.link || it.guid?.["#text"] || it.guid || "").toString().trim(),
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

/* ====================== 追加: Day1 Evidence/Locations API ====================== */

// POST /api/evidence  … 点呼・アルコール・乗務などの証跡保存
app.post("/api/evidence", verifyFirebaseToken, async (req, res) => {
  try {
    const { company, driverId, kind, payload, occurredAt } = req.body || {};
    if (!company || !driverId || !kind || !occurredAt) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const q = `
      insert into evidence (company, driver_id, kind, payload, occurred_at)
      values ($1,$2,$3, coalesce($4::jsonb, '{}'::jsonb), $5)
      returning id, created_at
    `;
    const { rows } = await pool.query(q, [company, driverId, kind, payload ?? {}, occurredAt]);
    res.json({ ok: true, id: rows[0].id, createdAt: rows[0].created_at });
  } catch (e) {
    console.error("POST /api/evidence", e);
    res.status(500).json({ error: "server_error" });
  }
});

// GET /api/evidence  … 期間/ドライバー/種別で取得
app.get("/api/evidence", verifyFirebaseToken, async (req, res) => {
  try {
    const { company, from, to, driverId, kind } = req.query;
    if (!company) return res.status(400).json({ error: "company required" });

    const params = [company];
    const where = ["company = $1"];
    if (from) { params.push(from); where.push(`occurred_at >= $${params.length}`); }
    if (to)   { params.push(to);   where.push(`occurred_at <  $${params.length}`); }
    if (driverId) { params.push(driverId); where.push(`driver_id = $${params.length}`); }
    if (kind)     { params.push(kind);     where.push(`kind = $${params.length}`); }

    const q = `select * from evidence where ${where.join(" and ")} order by occurred_at desc limit 1000`;
    const { rows } = await pool.query(q, params);
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error("GET /api/evidence", e);
    res.status(500).json({ error: "server_error" });
  }
});

// POST /api/locations  … 位置履歴を追加（5分間隔想定）
app.post("/api/locations", verifyFirebaseToken, async (req, res) => {
  try {
    const { company, driverId, lat, lng, accuracy, recordedAt } = req.body || {};
    if (!company || !driverId || !lat || !lng) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const q = `
      insert into locations (company, driver_id, lat, lng, accuracy, recorded_at)
      values ($1,$2,$3,$4,$5, coalesce($6, now()))
      returning id, recorded_at
    `;
    const { rows } = await pool.query(q, [company, driverId, lat, lng, accuracy ?? null, recordedAt ?? null]);
    res.json({ ok: true, id: rows[0].id, recordedAt: rows[0].recorded_at });
  } catch (e) {
    console.error("POST /api/locations", e);
    res.status(500).json({ error: "server_error" });
  }
});

/* ===== Stripe: Checkout（動的・導入費は任意） ==================
   POST /api/checkout/create
   Body: {
     companyId?: string, // 任意（メタデータ用）
     planId: "basic"|"advanced"|"pro"|"elite"|"premium"|"unlimited",
     seats?: number,     // unlimited の総人数（未指定は100扱い）
     setup?: "none"|"basic"|"standard"|"premium"|"unlimited"  // 既定 none
   }
================================================================ */
app.post("/api/checkout/create", async (req, res) => {
  try {
    const { companyId, planId, seats, setup = "none" } = req.body || {};
    if (!planId) return res.status(400).json({ error: "planId required" });

    const line_items = [];

    if (planId === "unlimited") {
      const base = PRICES.unlimited.base;
      const extra = PRICES.unlimited.extra;
      if (!base || !extra) return res.status(400).json({ error: "unlimited price ids missing" });
      const totalSeats = Number.isFinite(seats) ? Math.max(1, Math.floor(seats)) : 100; // 既定100
      line_items.push({ price: base, quantity: 1 });
      // 段階価格：数量=総人数（0-100は自動¥0、101+は¥800/人）
      line_items.push({ price: extra, quantity: totalSeats });
    } else {
      const priceId = PRICES.monthly[planId];
      if (!priceId) return res.status(400).json({ error: "invalid planId" });
      line_items.push({ price: priceId, quantity: 1 });
    }

    if (setup !== "none") {
      const setupPrice = PRICES.setup[setup];
      if (!setupPrice) return res.status(400).json({ error: "invalid setup" });
      line_items.push({ price: setupPrice, quantity: 1 });
    }

    const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items,
  success_url: `${PUBLIC_WEB_BASE_URL}/billing-result.html?status=success&company=${encodeURIComponent(companyId || "")}`,
cancel_url:  `${PUBLIC_WEB_BASE_URL}/billing-result.html?status=cancel`,
  allow_promotion_codes: true,
  metadata: { companyId: companyId || "", planId, seats: String(seats ?? "") },
});

    return res.json({ url: session.url });
  } catch (e) {
    console.error("POST /api/checkout/create", e);
    res.status(500).json({ error: "server_error", detail: e?.message });
  }
});


/* ===== Stripe: Hosted Quote（請求書で回収） ====================
   POST /api/quotes/create
   Body: { companyId?, planId, seats?, setup?, customer?: { name?, email? } }
================================================================ */
app.post("/api/quotes/create", async (req, res) => {
  try {
    const { companyId, planId, seats, setup = "none", customer = {} } = req.body || {};
    if (!planId) return res.status(400).json({ error: "planId required" });

    // ① line_items を組み立て（今のままでOK）
    const line_items = [];
    if (planId === "unlimited") {
      const totalSeats = Number.isFinite(seats) ? Math.max(1, Math.floor(seats)) : 100;
      line_items.push({ price: PRICES.unlimited.base,  quantity: 1 });
      line_items.push({ price: PRICES.unlimited.extra, quantity: totalSeats });
    } else {
      line_items.push({ price: PRICES.monthly[planId], quantity: 1 });
    }
    if (setup !== "none") line_items.push({ price: PRICES.setup[setup], quantity: 1 });

    // ② 顧客を作成（今のままでOK）
    const cust = await stripe.customers.create({
      name:  customer.name  || companyId || "Customer",
      email: customer.email || undefined,
      metadata: { companyId: companyId || "" },
    });

    // ③ ★ここがポイント：collection_method と days_until_due は subscription_data ではなく
    //    それぞれ「トップレベル」と「invoice_settings」に置く！
   const quote = await stripe.quotes.create({
  customer: cust.id,
  line_items,
  collection_method: "send_invoice",
  invoice_settings: { days_until_due: 7 },
});

const finalized = await stripe.quotes.finalizeQuote(quote.id);
const url = finalized.url
  || (finalized?.livemode === false && finalized?.id
      ? `https://dashboard.stripe.com/test/quotes/${finalized.id}`
      : null);
if (!url) return res.status(500).json({ error: "no_public_url" });
return res.json({ url });
  } catch (e) {
    console.error("POST /api/quotes/create", e);
    res.status(500).json({ error: "server_error", detail: e?.message });
  }
});

app.get("/api/debug/price-check", async (_req, res) => {
  const ids = {
    basic: PRICES.monthly.basic,
    advanced: PRICES.monthly.advanced,
    pro: PRICES.monthly.pro,
    elite: PRICES.monthly.elite,
    premium: PRICES.monthly.premium,
    unl_base: PRICES.unlimited.base,
    unl_extra: PRICES.unlimited.extra,
    setup_basic: PRICES.setup.basic,
    setup_standard: PRICES.setup.standard,
    setup_premium: PRICES.setup.premium,
    setup_unlimited: PRICES.setup.unlimited,
  };
  const out = {};
  for (const [k, id] of Object.entries(ids)) {
    if (!id) { out[k] = { ok:false, error:"missing" }; continue; }
    try {
      const price = await stripe.prices.retrieve(id);
      out[k] = {
        ok:true,
        currency: price.currency,
        recurring: !!price.recurring,
        interval: price.recurring?.interval || null,
        unit_amount: price.unit_amount,
      };
    } catch (e) {
      out[k] = { ok:false, error:e?.message };
    }
  }
  res.json(out);
});

// --- Stripeの鍵が有効かチェック（製品を1件リスト） ---
app.get("/api/debug/stripe-key-check", async (_req, res) => {
  try {
    const p = await stripe.products.list({ limit: 1 });
    res.json({ ok: true, products_count: p.data.length });
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: e?.message,
      code: e?.code,           // 例: 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'
      type: e?.type,           // StripeError の種別
      status: e?.statusCode,   // HTTP ステータス
      requestId: e?.requestId, // ある場合
      raw: e?.raw?.message     // 低レベルの詳細
    });
  }
});

/* ====================== ヘルスチェック ====================== */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ====================== サーバ起動 ====================== */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

// 🔐 管理者Auth作成（会社固定 & 既定Authのセッションに影響させない）
app.post("/api/admins/provision", verifyFirebaseToken, async (req, res) => {
  try {
    const { company, loginId, password } = req.body || {};
    if (!company || !loginId || !password) {
      return res.status(400).json({ error: "company/loginId/password required" });
    }

    // ✅ 会社クレームは必須・完全一致を強制
    if (!req.user?.company || req.user.company !== company) {
      return res.status(403).json({ error: "forbidden: company mismatch" });
    }

    // 会社ごとに一意なメール（会社スラグ＋loginId）
    const slug = String(company).replace(/[^a-z0-9]+/gi, "").toLowerCase() || "c";
    const email = `${slug}.${loginId}@anborco.jp`;

    // 既存メールは409（衝突）で返す
    try {
      await admin.auth().getUserByEmail(email);
      return res.status(409).json({ error: "email_already_exists" });
    } catch {
      // not found → 作成へ
    }

    try {
      const user = await admin.auth().createUser({
        email,
        password,
        emailVerified: false,
        disabled: false,
      });

      // 会社クレームを付与（同一会社スコープ共有用）
      await admin.auth().setCustomUserClaims(user.uid, { company });

      return res.json({ uid: user.uid, email });
    } catch (e) {
      // ✅ 競合レース（createUser側）も409に正規化
      const code = e?.errorInfo?.code || e?.code || "";
      if (code === "auth/email-already-exists") {
        return res.status(409).json({ error: "email_already_exists" });
      }
      console.error("createUser error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  } catch (e) {
    console.error("POST /api/admins/provision", e);
    return res.status(500).json({ error: "server_error" });
  }
});
// 🔐 ドライバーAuth作成（会社固定 & 既定Authのセッションに影響させない）
app.post("/api/drivers/provision", verifyFirebaseToken, async (req, res) => {
  try {
    const { company, loginId, password } = req.body || {};
    if (!company || !loginId || !password) {
      return res.status(400).json({ error: "company/loginId/password required" });
    }

    // ✅ トークンの company と完全一致（社内のみ作成可）
    if (!req.user?.company || req.user.company !== company) {
      return res.status(403).json({ error: "forbidden: company mismatch" });
    }

    // 会社ごとに一意なメール（admin と衝突しないよう loginId が driverXXXX なので十分ですが、念のため会社スラグも付与）
    const slug = String(company).replace(/[^a-z0-9]+/gi, "").toLowerCase() || "c";
    const email = `${slug}.${loginId}@anborco.jp`;

    // 既存メールは409（衝突）で返す
    try {
      await admin.auth().getUserByEmail(email);
      return res.status(409).json({ error: "email_already_exists" });
    } catch {
      // not found → 作成へ
    }

    try {
      const user = await admin.auth().createUser({
        email,
        password,
        emailVerified: false,
        disabled: false,
      });

      // 会社クレーム + 役割=driver を付与（クライアント側で company スコープ共有に使用）
      await admin.auth().setCustomUserClaims(user.uid, { company, role: "driver" });

      return res.json({ uid: user.uid, email });
    } catch (e) {
      const code = e?.errorInfo?.code || e?.code || "";
      if (code === "auth/email-already-exists") {
        return res.status(409).json({ error: "email_already_exists" });
      }
      console.error("createUser error:", e);
      return res.status(500).json({ error: "server_error" });
    }
  } catch (e) {
    console.error("POST /api/drivers/provision", e);
    return res.status(500).json({ error: "server_error" });
  }
});

/* ====================== デバッグ: 環境変数チェック ====================== */
app.get("/api/debug/env-check", (_req, res) => {
  res.json({
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    PUBLIC_WEB_BASE_URL: process.env.PUBLIC_WEB_BASE_URL || null,
    PRICE_KEYS: {
      basic: !!process.env.PRICE_BASIC,
      advanced: !!process.env.PRICE_ADVANCED,
      pro: !!process.env.PRICE_PRO,
      elite: !!process.env.PRICE_ELITE,
      premium: !!process.env.PRICE_PREMIUM,
      unl_base: !!process.env.PRICE_UNL_BASE,     // 追加
      unl_extra: !!process.env.PRICE_UNL_EXTRA,   // 追加
      setup_basic: !!process.env.PRICE_SETUP_BASIC,
      setup_standard: !!process.env.PRICE_SETUP_STANDARD,
      setup_premium: !!process.env.PRICE_SETUP_PREMIUM,
      setup_unlimited: !!process.env.PRICE_SETUP_UNLIMITED,
    },
  });
});
