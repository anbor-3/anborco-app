// src/features.ts
export type PlanId =
  | "basic" | "advanced" | "pro" | "elite" | "premium" | "unlimited";

export type FeatureKey =
  | "adminManager" | "drivers" | "vehicles"
  | "chat" | "shift" | "dailyReport"
  | "projects" | "files" | "map" | "payment" | "todo";

export type PlanFeatureMap = Record<FeatureKey, boolean>;

export const PLAN_FEATURES: Record<PlanId, PlanFeatureMap> = {
  basic: {
    adminManager: true, drivers: true, vehicles: true,
    chat: false, shift: true, dailyReport: false,
    projects: false, files: false, map: false, payment: false, todo: false,
  },
  advanced: {
    adminManager: true, drivers: true, vehicles: true,
    chat: true, shift: true, dailyReport: true,
    projects: false, files: false, map: false, payment: false, todo: false,
  },
  pro: {
    adminManager: true, drivers: true, vehicles: true,
    chat: true, shift: true, dailyReport: true,
    projects: true, files: true, map: true, payment: false, todo: false,
  },
  elite: {
    adminManager: true, drivers: true, vehicles: true,
    chat: true, shift: true, dailyReport: true,
    projects: true, files: true, map: true, payment: true, todo: true,
  },
  premium: {
    adminManager: true, drivers: true, vehicles: true,
    chat: true, shift: true, dailyReport: true,
    projects: true, files: true, map: true, payment: true, todo: true,
  },
  unlimited: {
    adminManager: true, drivers: true, vehicles: true,
    chat: true, shift: true, dailyReport: true,
    projects: true, files: true, map: true, payment: true, todo: true,
  },
};

export type PricingPlan = {
  id: PlanId;
  name: string;
  eng: string;
  price: number;
  range: string;
  maxUsers: number; // Infinity は Number.POSITIVE_INFINITY を使用
  extra?: string;
};

export const PRICING: PricingPlan[] = [
  { id: "basic",      name: "ベーシック",     eng: "Basic",      price:  9800, range: "～10名",   maxUsers: 10 },
  { id: "advanced",   name: "アドバンス",     eng: "Advanced",   price: 19800, range: "～30名",   maxUsers: 30 },
  { id: "pro",        name: "プロ",           eng: "Pro",        price: 32000, range: "31～50名", maxUsers: 50 },
  { id: "elite",      name: "エリート",       eng: "Elite",      price: 42000, range: "51～70名", maxUsers: 70 },
  { id: "premium",    name: "プレミアム",     eng: "Premium",    price: 55000, range: "71～99名", maxUsers: 99 },
  { id: "unlimited",  name: "アンリミテッド", eng: "Unlimited",  price: 60000, range: "100名以上", maxUsers: Number.POSITIVE_INFINITY, extra: "+1名¥800" },
];
