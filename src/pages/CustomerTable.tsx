import React, { useEffect, useState } from "react";
import NewCustomerModal, { Customer } from "../pages/NewCustomerModal";
import { createCustomerWithAuth } from "../utils/createCustomerWithAuth";
import Select from "react-select";

/** ✅ 本番向け API 基点：NEXT_PUBLIC_API_BASE_URL があれば使う */
const API_BASE_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_API_BASE_URL)
    ? String((process as any).env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "")
    : "";
const api = (path: string) => `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** ✅ プラン定義（機能フラグ付き） */
type PlanId = "basic" | "advanced" | "pro" | "elite" | "premium" | "unlimited";
type FeatureKey = "chat" | "shift" | "dailyReport" | "vehicle";
type Plan = {
  id: PlanId; name: string; price: number; maxUsers: number;
  features: Record<FeatureKey, boolean>;
};

const pricingPlans: Plan[] = [
  { id: "basic",      name: "ベーシック",     price:  9800, maxUsers: 10, features: { chat:true, shift:true, dailyReport:false, vehicle:false } },
  { id: "advanced",   name: "アドバンス",     price: 19800, maxUsers: 30, features: { chat:true, shift:true, dailyReport:true,  vehicle:false } },
  { id: "pro",        name: "プロ",           price: 32000, maxUsers: 50, features: { chat:true, shift:true, dailyReport:true,  vehicle:true  } },
  { id: "elite",      name: "エリート",       price: 42000, maxUsers: 70, features: { chat:true, shift:true, dailyReport:true,  vehicle:true  } },
  { id: "premium",    name: "プレミアム",     price: 55000, maxUsers: 99, features: { chat:true, shift:true, dailyReport:true,  vehicle:true  } },
  { id: "unlimited",  name: "アンリミテッド", price: 60000, maxUsers: Number.POSITIVE_INFINITY, features: { chat:true, shift:true, dailyReport:true,  vehicle:true } },
];

/* -------------------- 共通 -------------------- */
const storageKey = "customerMaster";

// Customer に plan 拡張を足す（保存・表示用）
type CustomerExt = Customer & {
  selectedPlans?: string[];
  limits?: { maxUsers: number | null }; // null＝無制限
  features?: Record<FeatureKey, boolean>;
};

const getBadgeClass = (plan: string) => {
  const base = "inline-block px-2 py-1 text-xs font-bold rounded w-24 text-center";
  switch (plan) {
    case "ベーシック":     return `${base} bg-amber-600 text-white`;
    case "アドバンス":     return `${base} bg-green-600 text-white`;
    case "プロ":           return `${base} bg-blue-600 text-white`;
    case "エリート":       return `${base} bg-purple-600 text-white`;
    case "プレミアム":     return `${base} bg-pink-600 text-white`;
    case "アンリミテッド": return `${base} bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black shadow-lg`;
    default:               return `${base} bg-gray-600 text-white`;
  }
};

/** 本番：APIから人数を取得（失敗時はlocalStorageへフォールバック） */
const fetchUserCount = async (companyName: string) => {
  try {
    const res = await fetch(api(`/api/company/stats?company=${encodeURIComponent(companyName)}`), {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const json = await res.json(); // { userCount: number }
      if (typeof json?.userCount === "number") return json.userCount;
    }
  } catch {}
  const driverData = JSON.parse(localStorage.getItem("driverMaster") || "[]");
  const adminData  = JSON.parse(localStorage.getItem("adminMaster")  || "[]");
  const driverCount = driverData.filter((d: any) => d.company === companyName).length;
  const adminCount  = adminData .filter((a: any) => a.company === companyName).length;
  return driverCount + adminCount;
};

/* -------------------- 本体 -------------------- */
export default function CustomerTable() {
  /* state -------------------------------------------------------- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerExt[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // 人数は非同期でまとめて取得して state に保持
  const [userCounts, setUserCounts] = useState<Record<string, number>>({}); // key=company

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        [...new Set(customers.map(c => c.company))].map(async (company) => {
          const n = await fetchUserCount(company);
          return [company, n] as const;
        })
      );
      setUserCounts(Object.fromEntries(entries));
    })();
  }, [customers]);

  // ① まず型定義
  type CustomerDraft = Omit<Customer, "id"> & { selectedPlans: string[] };

  // ② emptyDraft
  const emptyDraft: CustomerDraft = {
    company: "", address: "", representative: "", contactPerson: "", contactPhone: "",
    plan: "ベーシック", selectedPlans: [],
    startDate: "", endDate: "", corporateNo: "", invoiceNo: "",
    paymentSite: "", paymentMethod: "", email: "", uid: "", upw: "", note: ""
  };

  // ③ useState
  const [draft, setDraft] = useState<CustomerDraft>(emptyDraft);

  /* util --------------------------------------------------------- */
  const save = (list: CustomerExt[]) => {
    setCustomers(list);
    localStorage.setItem(storageKey, JSON.stringify(list));
  };

  /* JSX ---------------------------------------------------------- */
  return (
    <div className="p-4 overflow-x-auto font-sans">
      <h2 className="text-2xl font-extrabold mb-6 text-gray-700 tracking-wide">契約顧客一覧</h2>

      {/* 新規登録 */}
      <button className="mb-3 px-4 py-1.5 bg-green-600 text-white rounded shadow" onClick={() => setShowModal(true)}>
        新規登録
      </button>

      <NewCustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={async (rec) => {
          // 1) 現在人数
          const currentUsers = await fetchUserCount(rec.company);

          // 2) 上限・機能の合成
          let maxAllowed = 0;
          let unionFeatures: Record<FeatureKey, boolean> = { chat:false, shift:false, dailyReport:false, vehicle:false };
          for (const planId of (rec.selectedPlans || [])) {
            const p = pricingPlans.find(pl => pl.id === planId);
            if (!p) continue;
            if (p.maxUsers > maxAllowed) maxAllowed = p.maxUsers;
            unionFeatures = {
              chat:        unionFeatures.chat        || p.features.chat,
              shift:       unionFeatures.shift       || p.features.shift,
              dailyReport: unionFeatures.dailyReport || p.features.dailyReport,
              vehicle:     unionFeatures.vehicle     || p.features.vehicle,
            };
          }
          if (maxAllowed === 0) {
            const basic = pricingPlans[0];
            maxAllowed = basic.maxUsers;
            unionFeatures = { ...basic.features };
          }

          // 3) 上限超過の注意（登録は続行・実際の制限はドライバー追加時にハードチェック）
          if (Number.isFinite(maxAllowed) && currentUsers > maxAllowed) {
            alert(`⚠ 現在の利用人数(${currentUsers}名)は、契約プランの上限(${maxAllowed}名)を超えています。\nプラン変更をご検討ください。`);
          }

          // 4) 認証発番 → 保存データ作成
          const auth = await createCustomerWithAuth(rec.company, rec.contactPerson);
          const maxForSave: number | null = Number.isFinite(maxAllowed) ? maxAllowed : null; // null=無制限
          const withAuth: CustomerExt = {
            id: Date.now().toString(),
            uid: auth.email,
            upw: auth.password,
            ...rec,
            plan: rec.selectedPlans?.[0] ? (pricingPlans.find(p => p.id === rec.selectedPlans[0])?.name || "") : "",
            selectedPlans: rec.selectedPlans || [],
            limits: { maxUsers: maxForSave },
            features: unionFeatures,
          };

          // 5) まずローカルに保存（即反映）
          save([...customers, withAuth]);

          // 6) 本番APIへ保存（失敗してもUIは維持）
          try {
            await fetch(api("/api/customers"), {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(withAuth),
            });
          } catch (e) {
            console.warn("サーバ保存に失敗（ローカルには保存済み）:", e);
          }

          alert(`✅ 顧客アカウントを作成しました\nログインID: ${withAuth.uid}\nパスワード: ${withAuth.upw}`);
          setShowModal(false);
        }}
        pricingPlans={pricingPlans}
      />

      {/* 一覧テーブル */}
      <table className="min-w-full table-auto border-collapse border border-gray-300 bg-white shadow-md text-sm rounded-lg overflow-hidden">
        <thead className="bg-gradient-to-r from-green-200 to-green-100 text-gray-900">
          <tr className="text-center font-semibold">
            <th className="border px-3 py-2">会社名</th>
            <th className="border px-3 py-2">住所</th>
            <th className="border px-3 py-2">担当者</th>
            <th className="border px-3 py-2">TEL</th>
            <th className="border px-3 py-2">契約プラン</th>
            <th className="border px-3 py-2">ユーザー数</th>
            <th className="border px-3 py-2">開始日</th>
            <th className="border px-3 py-2">満了日</th>
            <th className="border px-3 py-2">詳細</th>
          </tr>
        </thead>

        <tbody>
          {customers.map((c) => (
            <React.Fragment key={c.id}>
              {/* -------- 一覧行 -------- */}
              <tr className="text-center hover:bg-gray-50">
                <td className="border px-3 py-1">
                  {editingId === c.id ? (
                    <input
                      value={(draft as any).company}
                      onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                      className="border px-2 py-1 w-full text-sm"
                    />
                  ) : (
                    c.company
                  )}
                </td>
                <td className="border px-3 py-1">{c.address}</td>
                <td className="border px-3 py-1">{c.contactPerson}</td>
                <td className="border px-3 py-1">{c.contactPhone}</td>
                <td className="border px-3 py-1">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {c.selectedPlans?.map((planId) => {
                      const plan = pricingPlans.find(p => p.id === planId);
                      return (
                        <span key={planId} className={getBadgeClass(plan?.name || "")}>
                          {plan?.name}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="border px-3 py-1">
                  {userCounts[c.company] ?? "—"}人
                </td>
                <td className="border px-3 py-1">{c.startDate}</td>
                <td className="border px-3 py-1">{c.endDate}</td>
                <td className="border px-3 py-1">
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="text-blue-600 hover:underline"
                  >
                    {expanded === c.id ? "閉じる" : "詳細"}
                  </button>
                </td>
              </tr>

              {/* -------- 詳細展開行 -------- */}
              {expanded === c.id && (
                <tr>
                  <td colSpan={9} className="bg-gray-50 border px-4 py-3">

                    {/* 編集モード */}
                    {editingId === c.id ? (
                      <>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {[
                            "会社名","住所","代表者名","担当者","TEL","契約プラン","開始日","満了日",
                            "法人番号","インボイス番号","支払サイト","支払方法","Email","発番 ID","発番 PW"
                          ].map((label, i) => {
                            const keys = [
                              "company","address","representative","contactPerson","contactPhone","plan",
                              "startDate","endDate","corporateNo","invoiceNo",
                              "paymentSite","paymentMethod","email","uid","upw"
                            ];
                            const key = keys[i] as keyof CustomerDraft;
                            return (
                              <label key={key} className="flex flex-col">
                                <span className="font-bold">{label}</span>
                                {key === "plan" ? (
                                  <Select
                                    isMulti
                                    className="text-sm"
                                    options={pricingPlans.map(plan => ({ value: plan.id, label: plan.name }))}
                                    value={(draft.selectedPlans || []).map(id => ({
                                      value: id, label: pricingPlans.find(p => p.id === id)?.name || ""
                                    }))}
                                    onChange={(selected) => {
                                      const arr = Array.isArray(selected) ? selected : [];
                                      const values = arr.map((item: any) => item.value);
                                      setDraft({ ...draft, selectedPlans: values });
                                    }}
                                  />
                                ) : (key === "startDate" || key === "endDate") ? (
                                  <input
                                    type="date"
                                    className="border rounded px-1"
                                    value={(draft as any)[key] || ""}
                                    onChange={e => setDraft({ ...draft, [key]: e.target.value } as any)}
                                  />
                                ) : (
                                  <input
                                    className="border rounded px-1"
                                    value={(draft as any)[key] || ""}
                                    onChange={e => setDraft({ ...draft, [key]: e.target.value } as any)}
                                  />
                                )}
                              </label>
                            );
                          })}

                          {/* PDF添付 */}
                          <label className="flex flex-col col-span-2">
                            <span className="font-bold">契約書 PDF</span>
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const url = URL.createObjectURL(file);
                                setDraft({ ...draft, note: url });
                              }}
                            />
                            {draft.note && (
                              <a href={draft.note} target="_blank" className="text-blue-600 underline mt-1" rel="noreferrer">
                                現在のPDFを表示
                              </a>
                            )}
                          </label>
                        </div>

                        {/* 保存・キャンセル */}
                        <div className="mt-3 flex gap-3">
                          <button
                            className="px-4 py-1 bg-green-600 text-white rounded"
                            onClick={() => {
                              const newList = customers.map(x =>
                                x.id === c.id ? { ...x, ...draft, selectedPlans: draft.selectedPlans } : x
                              );
                              save(newList);
                              setEditingId(null);
                            }}
                          >
                            保存
                          </button>
                          <button
                            className="px-4 py-1 bg-gray-400 text-white rounded"
                            onClick={() => { setEditingId(null); setDraft(emptyDraft); }}
                          >
                            キャンセル
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          <p><strong>法人番号：</strong>{(c as any).corporateNo}</p>
                          <p><strong>インボイス番号：</strong>{(c as any).invoiceNo}</p>
                          <p><strong>支払サイト：</strong>{(c as any).paymentSite}</p>
                          <p><strong>支払方法：</strong>{(c as any).paymentMethod}</p>
                          <p><strong>Email：</strong>{(c as any).email}</p>
                          <p><strong>発番 ID：</strong>{(c as any).uid}</p>
                          <p><strong>発番 PW：</strong>{(c as any).upw}</p>
                        </div>

                        <p className="mt-1 text-sm">
                          <strong>契約書 PDF：</strong>
                          {(c as any).note && (
                            <a href={(c as any).note} target="_blank" className="text-blue-600 underline ml-1" rel="noopener noreferrer">
                              表示
                            </a>
                          )}
                        </p>

                        {/* 編集／削除ボタン */}
                        <div className="mt-3 flex gap-3">
                          <button
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white shadow"
                            onClick={() => {
                              setEditingId(c.id);
                              setDraft({ ...(c as any), selectedPlans: (c as any).selectedPlans || [] });
                            }}
                          >
                            編集
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-600 text-white shadow"
                            onClick={() => {
                              if (confirm("本当に削除しますか？")) {
                                save(customers.filter((x) => x.id !== c.id));
                              }
                            }}
                          >
                            削除
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
