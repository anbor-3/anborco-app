import React, { useEffect, useState } from "react";
import NewCustomerModal, { Customer } from "../pages/NewCustomerModal";
import { createCustomerWithAuth } from "../utils/createCustomerWithAuth";
import Select from "react-select";

const pricingPlans = [
  { id: "basic", name: "ベーシック", price: 9800, maxUsers: 10 },
  { id: "advanced", name: "アドバンス", price: 19800, maxUsers: 30 },
  { id: "pro", name: "プロ", price: 32000, maxUsers: 50 },
  { id: "elite", name: "エリート", price: 42000, maxUsers: 70 },
  { id: "premium", name: "プレミアム", price: 55000, maxUsers: 99 },
  { id: "unlimited", name: "アンリミテッド", price: 60000, maxUsers: Infinity }
];

/* -------------------- 共通 -------------------- */
const storageKey = "customerMaster";

const getBadgeClass = (plan: string) => {
  const base = "inline-block px-2 py-1 text-xs font-bold rounded w-24 text-center";
  switch (plan) {
    case "ベーシック":
      return `${base} bg-amber-600 text-white`;
    case "アドバンス":
      return `${base} bg-green-600 text-white`;
    case "プロ":
      return `${base} bg-blue-600 text-white`;
    case "エリート":
      return `${base} bg-purple-600 text-white`;
    case "プレミアム":
      return `${base} bg-pink-600 text-white`;
    case "アンリミテッド":
      return `${base} bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black shadow-lg`;
    default:
      return `${base} bg-gray-600 text-white`;
  }
};

/* -------------------- 本体 -------------------- */
export default function CustomerTable() {
  /* state -------------------------------------------------------- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ① まず型定義
  type CustomerDraft = Omit<Customer, "id"> & {
  selectedPlans: string[];
};

  // ② 次に emptyDraft を定義
  const emptyDraft: CustomerDraft = {
  company: "",
  address: "",
  representative: "",
  contactPerson: "",
  contactPhone: "",
  plan: "ベーシック", // 旧
  selectedPlans: [],  // ✅ 追加
  startDate: "",
  endDate: "",
  corporateNo: "",
  invoiceNo: "",
  paymentSite: "",
  paymentMethod: "",
  email: "",
  uid: "",
  upw: "",
  note: ""
};

  // ③ 最後に draft を useState に渡す
  const [draft, setDraft] = useState<CustomerDraft>(emptyDraft);

  /* util --------------------------------------------------------- */
  const save = (list: Customer[]) => {
    setCustomers(list);
    localStorage.setItem(storageKey, JSON.stringify(list));
  };
const getCurrentUserCount = (companyName: string) => {
  const driverData = JSON.parse(localStorage.getItem("driverMaster") || "[]");
  const adminData = JSON.parse(localStorage.getItem("adminMaster") || "[]");

  const driverCount = driverData.filter((d: any) => d.company === companyName).length;
  const adminCount = adminData.filter((a: any) => a.company === companyName).length;

  return driverCount + adminCount; // ✅ 合計人数
};
  /* JSX ---------------------------------------------------------- */
  return (
    <div className="p-4 overflow-x-auto font-sans">
      <h2 className="text-2xl font-extrabold mb-6 text-gray-700 tracking-wide">
        契約顧客一覧
      </h2>

      {/* ----- 新規登録ボタン & モーダル ----- */}
      <button
        className="mb-3 px-4 py-1.5 bg-green-600 text-white rounded shadow"
        onClick={() => setShowModal(true)}
      >
        新規登録
      </button>
      
      <NewCustomerModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSave={(rec) => {
    const currentUsers = getCurrentUserCount(rec.company);

    let maxAllowed = 0;
    rec.selectedPlans.forEach(planId => {
      const plan = pricingPlans.find(p => p.id === planId);
      if (plan && plan.maxUsers > maxAllowed) {
        maxAllowed = plan.maxUsers;
      }
    });

    if (currentUsers > maxAllowed) {
      alert(`⚠ 現在の利用人数(${currentUsers}名)は、契約プランの上限(${maxAllowed}名)を超えています。\nアップグレードをご検討ください。`);
      return;
    }

    // ✅ ランダムIDとパスワードを生成
    const uid = `cust${Date.now()}`;
    const upw = Math.random().toString(36).slice(-8);

    const withAuth = {
      ...rec,
      id: Date.now().toString(),
      uid,
      upw,
    };

    // ✅ 保存
    save([...customers, withAuth]);

    // ✅ 発行情報を表示
    alert(
      `✅ 顧客アカウントを作成しました\n` +
      `ログインID: ${uid}\n` +
      `パスワード: ${upw}`
    );

    setShowModal(false);
  }}
  pricingPlans={pricingPlans}
/>

      {/* ----- 一覧テーブル（表示列は 8 項目） ----- */}
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
    value={draft.company}
    onChange={(e) =>
      setDraft({ ...draft, company: e.target.value })
    }
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
    {c.selectedPlans?.map(planId => {
      const plan = pricingPlans.find(p => p.id === planId);
      return (
        <span key={planId} className={getBadgeClass(plan?.name || "")}>
          {plan?.name}
        </span>
      );
    })}
  </div>
</td>
<td className="border px-3 py-1">{getCurrentUserCount(c.company)}人</td>

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
  "会社名", "住所", "代表者名", "担当者", "TEL", "契約プラン", "開始日", "満了日",
  "法人番号", "インボイス番号", "支払サイト", "支払方法", "Email", "発番 ID", "発番 PW"
].map((label, i) => {
  const keys = [
    "company", "address", "representative", "contactPerson", "contactPhone", "plan",
    "startDate", "endDate", "corporateNo", "invoiceNo",
    "paymentSite", "paymentMethod", "email", "uid", "upw"
  ];
              const key = keys[i] as keyof CustomerDraft;
              return (
  <label key={key} className="flex flex-col">
    <span className="font-bold">{label}</span>
    {key === "plan" ? (
  <Select
    isMulti
    className="text-sm"
    options={pricingPlans.map(plan => ({
      value: plan.id,
      label: plan.name
    }))}
    value={(draft.selectedPlans || []).map(id => ({
  value: id,
  label: pricingPlans.find(p => p.id === id)?.name || ""
}))}
    onChange={(selected) => {
      const values = selected.map((item) => item.value);
      setDraft({ ...draft, selectedPlans: values });
    }}
  />

    ) : key === "startDate" || key === "endDate" ? (
      // 日付は date input
      <input
        type="date"
        className="border rounded px-1"
        value={draft[key] || ""}
        onChange={e => setDraft({ ...draft, [key]: e.target.value })}
      />
    ) : (
      // その他は通常のテキスト input
      <input
        className="border rounded px-1"
        value={draft[key] || ""}
        onChange={e => setDraft({ ...draft, [key]: e.target.value })}
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
                <a href={draft.note} target="_blank" className="text-blue-600 underline mt-1">
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
              onClick={() => {
                setEditingId(null);
                setDraft(emptyDraft);
              }}
            >
              キャンセル
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <p><strong>法人番号：</strong>{c.corporateNo}</p>
            <p><strong>インボイス番号：</strong>{c.invoiceNo}</p>
            <p><strong>支払サイト：</strong>{c.paymentSite}</p>
            <p><strong>支払方法：</strong>{c.paymentMethod}</p>
            <p><strong>Email：</strong>{c.email}</p>
            <p><strong>発番 ID：</strong>{c.uid}</p>
            <p><strong>発番 PW：</strong>{c.upw}</p>
          </div>

          <p className="mt-1 text-sm">
            <strong>契約書 PDF：</strong>
            <a
              href={c.note}
              target="_blank"
              className="text-blue-600 underline ml-1"
            >
              表示
            </a>
          </p>

          {/* 編集／削除ボタン */}
          <div className="mt-3 flex gap-3">
            {/* ← ここに②の編集ボタンを置く */}
            <button
  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
             bg-blue-600 text-white shadow"
  onClick={() => {
  setEditingId(c.id);
  setDraft({
    ...c,
    selectedPlans: c.selectedPlans || [] // ✅ null安全
  });
}}
>
  編集
</button>
            <button
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                         bg-red-600 text-white shadow"
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
