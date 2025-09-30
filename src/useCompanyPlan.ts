// src/useCompanyPlan.ts
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { PLAN_FEATURES, type PlanId } from "./features";
import { apiURL } from "@/lib/apiBase";

// プラン名→ID の簡易マップ（localStorage の name しか無い場合の救済）
const NAME_TO_ID: Record<string, PlanId> = {
  "ベーシック": "basic",
  "アドバンス": "advanced",
  "プロ": "pro",
  "エリート": "elite",
  "プレミアム": "premium",
  "アンリミテッド": "unlimited",
};

type HookState = {
  plan: PlanId;
  features: (typeof PLAN_FEATURES)[PlanId];
  maxUsers: number | null; // null = 無制限
};

export function useFeatures(company: string): HookState {
  const [state, setState] = useState<HookState>({
    plan: "basic",
    features: PLAN_FEATURES.basic,
    maxUsers: null,
  });

  useEffect(() => {
    if (!company) return;
    (async () => {
      // 1) API優先
      try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch(apiURL(`/api/company/config?company=${encodeURIComponent(company)}`), {
          credentials: "include",
          headers: { Authorization: `Bearer ${idToken || ""}`, Accept: "application/json" },
        });
        if (res.ok) {
          const json = await res.json(); // { planId?: PlanId, limits?: {maxUsers}, features? }
          const planId: PlanId =
            json?.planId ||
            NAME_TO_ID[json?.planName as string] ||
            // localStorage へフォールバック
            getPlanFromLocal(company);

          setState({
            plan: planId,
            features: json?.features ?? PLAN_FEATURES[planId],
            maxUsers: numOrNull(json?.limits?.maxUsers),
          });
          return;
        }
      } catch {
        // 続行してローカルを見る
      }

      // 2) localStorage フォールバック
      const planId = getPlanFromLocal(company);
      const maxUsers = getMaxFromLocal(company);
      setState({
        plan: planId,
        features: PLAN_FEATURES[planId],
        maxUsers,
      });
    })();
  }, [company]);

  return state;
}

/* ---------- helpers ---------- */
function numOrNull(v: any): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

function getPlanFromLocal(company: string): PlanId {
  try {
    const list = JSON.parse(localStorage.getItem("customerMaster") || "[]");
    const row = Array.isArray(list) ? list.find((x: any) => x.company === company) : null;
    if (!row) return "basic";
    // 優先度: billing.currentPlanId → selectedPlans[0] → plan(日本語名)
    const id: PlanId | undefined =
      row?.billing?.currentPlanId ||
      row?.selectedPlans?.[0] ||
      NAME_TO_ID[row?.plan as string];
    return (id as PlanId) || "basic";
  } catch {
    return "basic";
  }
}

function getMaxFromLocal(company: string): number | null {
  try {
    const list = JSON.parse(localStorage.getItem("customerMaster") || "[]");
    const row = Array.isArray(list) ? list.find((x: any) => x.company === company) : null;
    const raw = row?.limits?.maxUsers;
    return typeof raw === "number" ? raw : null;
  } catch {
    return null;
  }
}
