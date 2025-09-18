// src/AdminPlanChange.tsx
import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { Package, CheckCircle, Minus } from "lucide-react";
import { PLAN_FEATURES, type PlanId } from "./features";
import { useFeatures } from "./useCompanyPlan";

/** ========= 共通 ========= */
const API_BASE =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_API_BASE_URL)
    ? String((process as any).env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "")
    : "";
const api = (p: string) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

const PRICING: { id: PlanId; jp: string; en: string; price: number }[] = [
  { id: "basic",     jp: "ベーシック",     en: "Basic",     price:  9800 },
  { id: "advanced",  jp: "アドバンス",     en: "Advanced",  price: 19800 },
  { id: "pro",       jp: "プロ",           en: "Pro",       price: 32000 },
  { id: "elite",     jp: "エリート",       en: "Elite",     price: 42000 },
  { id: "premium",   jp: "プレミアム",     en: "Premium",   price: 55000 },
  { id: "unlimited", jp: "アンリミテッド", en: "Unlimited", price: 60000 },
];

/** 高級感のある薄いトーン（上部だけ淡く色付け） */
const CARD_THEME: Record<PlanId, {
  header: string;     // 上部トーン
  divider: string;    // 機能の上の線
  accent: string;     // 見出し/強調
  ring: string;       // hover ring
}> = {
  basic:     { header: "from-amber-50 to-amber-100",   divider: "border-amber-300",   accent: "text-amber-700",   ring: "ring-amber-300" },
  advanced:  { header: "from-emerald-50 to-emerald-100", divider: "border-emerald-300", accent: "text-emerald-700", ring: "ring-emerald-300" },
  pro:       { header: "from-sky-50 to-sky-100",       divider: "border-sky-300",     accent: "text-sky-700",     ring: "ring-sky-300" },
  elite:     { header: "from-violet-50 to-violet-100", divider: "border-violet-300",  accent: "text-violet-700",  ring: "ring-violet-300" },
  premium:   { header: "from-rose-50 to-rose-100",     divider: "border-rose-300",    accent: "text-rose-700",    ring: "ring-rose-300" },
  unlimited: { header: "from-zinc-50 to-zinc-100",     divider: "border-zinc-300",    accent: "text-zinc-700",    ring: "ring-zinc-300" },
 };

/** 表示順とラベル（左右に均等割り） */
const FEATURE_LABELS: { key: keyof typeof PLAN_FEATURES["basic"]; label: string }[] = [
  { key: "adminManager", label: "管理者管理" },
  { key: "drivers",      label: "ドライバー管理" },
  { key: "vehicles",     label: "車両管理" },
  { key: "chat",         label: "チャット" },
  { key: "shift",        label: "シフト登録" },
  { key: "dailyReport",  label: "日報管理" },
  { key: "projects",     label: "案件一覧" },
  { key: "files",        label: "ファイル管理" },
  { key: "map",          label: "位置情報マップ" },
  { key: "payment",      label: "支払集計" },
  { key: "todo",         label: "法改正対応ToDo" },
];

const ROWS: PlanId[][] = [
  ["basic", "advanced", "pro"],
  ["elite", "premium", "unlimited"],
];

const formatYen = (n: number) => `¥${n.toLocaleString()}`;

/** 次月1日のISO */
const nextMonthFirstISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y, m + 1, 1, 0, 0, 0, 0);
  return first.toISOString();
};
/** 当月1日のISO */
const thisMonthFirstISO = () => {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return first.toISOString();
};

export default function AdminPlanChange() {
  const adminUser = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}");
  const company = adminUser?.company || "";

  const { plan: currentPlanId } = useFeatures(company);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  useEffect(() => {
    // 価格はPRICINGから取得（localStorageやAPIに価格がなければ）
    const p = PRICING.find(p => p.id === currentPlanId)?.price ?? 0;
    setCurrentPrice(p);
  }, [currentPlanId]);

  /** 変更ロジック：アップは当月適用、ダウンは翌月適用（freee風） */
  const applyPlanChange = async (to: PlanId) => {
    const target = PRICING.find(p => p.id === to)!;
    const isUpgrade = target.price > currentPrice;
    const targetISO = isUpgrade ? thisMonthFirstISO() : nextMonthFirstISO();
    const endpoint = isUpgrade ? "/api/billing/upgrade" : "/api/billing/downgrade";

    // 確認モーダル（文言もfreee寄せ）
    const ok = window.confirm(
      isUpgrade
        ? `「${target.jp}（${formatYen(target.price)}）」にアップグレードします。\n本日が属する月から適用されます。よろしいですか？`
        : `「${target.jp}（${formatYen(target.price)}）」にダウングレードします。\n次月から適用されます（今月は現プランのまま）。よろしいですか？`
    );
    if (!ok) return;

    // API呼び出し（失敗してもローカルは更新）
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      await fetch(api(endpoint), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
        body: JSON.stringify({ company, toPlanId: to, effectiveFrom: targetISO }),
      });
    } catch {}

    // localStorage: customerMaster を更新
    try {
      const list = JSON.parse(localStorage.getItem("customerMaster") || "[]");
      const idx = Array.isArray(list) ? list.findIndex((x: any) => x.company === company) : -1;
      if (idx >= 0) {
        const cur = list[idx] || {};
        const limitsMax = Number.isFinite(getMaxUsersByPlan(to)) ? getMaxUsersByPlan(to) : null;
        if (isUpgrade) {
          // 即時適用
          list[idx] = {
            ...cur,
            selectedPlans: [to],
            plan: PRICING.find(p => p.id === to)?.jp,
            features: PLAN_FEATURES[to],
            limits: { ...(cur.limits || {}), maxUsers: limitsMax },
            billing: {
              ...(cur.billing || {}),
              currentPlanId: to,
              currentPrice: target.price,
              lastChangedAt: new Date().toISOString(),
              effectiveFrom: thisMonthFirstISO(),
              // ダウンの予約は消す
              nextPlanId: undefined,
              nextPrice: undefined,
              nextEffectiveFrom: undefined,
            },
          };
        } else {
          // 次月から適用の予約
          list[idx] = {
            ...cur,
            billing: {
              ...(cur.billing || {}),
              nextPlanId: to,
              nextPrice: target.price,
              nextEffectiveFrom: nextMonthFirstISO(),
              lastChangedAt: new Date().toISOString(),
            },
          };
        }
        localStorage.setItem("customerMaster", JSON.stringify(list));
      }
    } catch {}

    // 通知（管理者用）
    pushAdminNotification(
      isUpgrade
        ? `プランを「${target.jp}」（${formatYen(target.price)}）にアップグレードしました（当月から適用）。`
        : `プランを「${target.jp}」（${formatYen(target.price)}）に変更予約しました（次月から適用）。`
    );

    // 完了アラート
    alert(
      isUpgrade
        ? `✅ アップグレード完了：${target.jp}\n月額 ${formatYen(target.price)}（当月から適用）`
        : `✅ 変更を予約：${target.jp}\n月額 ${formatYen(target.price)}（次月から適用）`
    );

    // 画面価格の基準も更新（アップのみ即反映）
    if (isUpgrade) setCurrentPrice(target.price);
  };

  const getMaxUsersByPlan = (id: PlanId) => {
    switch (id) {
      case "basic": return 10;
      case "advanced": return 30;
      case "pro": return 50;
      case "elite": return 70;
      case "premium": return 99;
      case "unlimited": return Number.POSITIVE_INFINITY;
    }
  };

  /** ページ見出し（左にアイコン / 右に英字） */
  const Header = () => (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Package className="text-emerald-600" size={20} />
        <h1 className="text-xl md:text-2xl font-bold tracking-wide text-white">プラン変更</h1>
      </div>
      <span className="text-sm ml-2 text-white">— Plan Change —</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl text-gray-900">
      <Header />

      {/* 注意文言 */}
      <p className="text-sm text-gray-600 mb-4">
        アップグレードは当月から、ダウングレードは次月から適用されます。
      </p>

      {/* 2段構成：上段（Basic〜Pro）、下段（Elite〜Unlimited） */}
      <div className="space-y-6">
        {ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {row.map((planId) => (
              <PlanCard
                key={planId}
                planId={planId}
                currentPlanId={currentPlanId}
                onChange={() => applyPlanChange(planId)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 備考 */}
      <div className="mt-6 text-xs text-gray-500">
        価格は税込。機能は予告なく変更される場合があります。
      </div>
    </div>
  );
}

/** ========== 部品：プランカード ========== */
function PlanCard({
  planId,
  currentPlanId,
  onChange,
}: {
  planId: PlanId;
  currentPlanId: PlanId;
  onChange: () => void;
}) {
  const pricing = PRICING.find((p) => p.id === planId)!;
  const theme = CARD_THEME[planId];
  const isCurrent = currentPlanId === planId;

  // 機能を左右にほぼ均等分割
  const pairs = useMemo(() => {
    const f = PLAN_FEATURES[planId];
    const items = FEATURE_LABELS.map(({ key, label }) => ({ label, enabled: f[key] }));
    const mid = Math.ceil(items.length / 2);
    return { left: items.slice(0, mid), right: items.slice(mid) };
  }, [planId]);

  return (
    <div
      className={[
        "h-full rounded-2xl border bg-gradient-to-b from-white to-gray-50",
        "shadow-[0_2px_12px_rgba(0,0,0,0.05)]",
        "hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]",
        "transition ring-0 hover:ring-2 focus-within:ring-2",
        theme.ring,
      ].join(" ")}
    >
      {/* 上部：淡い色トーン＋タイトル */}
      <div className={`rounded-t-2xl bg-gradient-to-b ${theme.header} p-4 border-b ${theme.divider}`}>
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
           <span className={`text-base font-semibold ${theme.accent}`}>{pricing.jp}</span>
          </div>
          <span className="text-xs tracking-wide text-gray-700">{pricing.en}</span>
        </div>

        <div className="mt-2 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-extrabold text-gray-900">{formatYen(pricing.price)}</div>
            <div className="text-xs text-gray-600 pb-1">/ 月（税込）</div>
          </div>
          {isCurrent && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              現在のプラン
            </span>
          )}
        </div>
      </div>

      {/* 機能一覧（上に線） */}
      <div className={`border-t ${theme.divider} p-4`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 min-h-[220px]">
          <FeatureColumn items={pairs.left} />
          <FeatureColumn items={pairs.right} />
        </div>

        {/* 下部ボタン（底に揃える） */}
        <div className="pt-4">
          <button
            onClick={onChange}
            disabled={isCurrent}
            className={[
              "h-10 w-full rounded-lg font-semibold transition focus-visible:outline-none",
   isCurrent
     ? "bg-gray-200 text-gray-600 cursor-not-allowed"
     : "bg-gray-900 text-white hover:bg-black focus-visible:ring-2 focus-visible:ring-gray-900",
 ].join(" ")}
          >
            {isCurrent ? "選択中" : "このプランに変更"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** ========== 部品：機能カラム（緑チェックは左） ========== */
function FeatureColumn({
  items,
}: {
  items: { label: string; enabled: boolean }[];
}) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2">
          {it.enabled ? (
            <CheckCircle size={16} className="mt-0.5 text-emerald-600 shrink-0" />
          ) : (
            <Minus size={16} className="mt-0.5 text-gray-400 shrink-0" />
          )}
          <span className={it.enabled ? "text-gray-800" : "text-gray-500"}>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ========== 小物 ========== */
function pushAdminNotification(message: string) {
  try {
    const list = JSON.parse(localStorage.getItem("adminNotifications") || "[]");
    const updated = [
      ...list,
      { id: `${Date.now()}-${Math.random()}`, message, timestamp: new Date().toLocaleString("ja-JP"), read: false },
    ];
    localStorage.setItem("adminNotifications", JSON.stringify(updated));
  } catch {}
}
