// プランID
export type PlanId = "basic" | "advanced" | "pro" | "elite" | "premium" | "unlimited";

export type FeatureKey = "chat" | "shift" | "dailyReport" | "vehicle";

export type PlanCaps = {
  id: PlanId;
  name: string;
  price: number;
  maxUsers: number;               // ドライバー上限
  features: Record<FeatureKey, boolean>;
};

export const PLAN_CAPS: Record<PlanId, PlanCaps> = {
  basic: {
    id: "basic",
    name: "ベーシック",
    price: 9800,
    maxUsers: 10,
    features: { chat: true, shift: true, dailyReport: false, vehicle: false },
  },
  advanced: {
    id: "advanced",
    name: "アドバンス",
    price: 19800,
    maxUsers: 30,
    features: { chat: true, shift: true, dailyReport: true, vehicle: false },
  },
  pro: {
    id: "pro",
    name: "プロ",
    price: 32000,
    maxUsers: 50,
    features: { chat: true, shift: true, dailyReport: true, vehicle: true },
  },
  elite: {
    id: "elite",
    name: "エリート",
    price: 42000,
    maxUsers: 70,
    features: { chat: true, shift: true, dailyReport: true, vehicle: true },
  },
  premium: {
    id: "premium",
    name: "プレミアム",
    price: 55000,
    maxUsers: 99,
    features: { chat: true, shift: true, dailyReport: true, vehicle: true },
  },
  unlimited: {
    id: "unlimited",
    name: "アンリミテッド",
    price: 60000,
    maxUsers: Number.POSITIVE_INFINITY, // 人数制限なし（課金は別管理）
    features: { chat: true, shift: true, dailyReport: true, vehicle: true },
  },
};

// ユーティリティ
export const canUse = (caps: PlanCaps, f: FeatureKey) => !!caps.features[f];
export const withinLimit = (caps: PlanCaps, currentDrivers: number) =>
  currentDrivers < caps.maxUsers;
