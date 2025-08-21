// ✅ import は一番上にまとめてください
import { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";

/** ✅ 本番向け API 基点（環境変数があれば採用） */
const API_BASE_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_API_BASE_URL)
    ? String((process as any).env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "")
    : "";
const api = (path: string) => `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const debounce = <T extends (...args: any[]) => any>(fn: T, delay = 500) => {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), delay);
  };
};

// ✅ 関数定義は壊れてはいけません（ここが重要！！）
const genRandom = (len = 6): string => Math.random().toString(36).slice(-len);

/** ========= プラン＆上限 ========= */
type PlanId = "basic"|"advanced"|"pro"|"elite"|"premium"|"unlimited";
type FeatureKey = "chat"|"shift"|"dailyReport"|"vehicle";
type Plan = { id: PlanId; name: string; price: number; maxUsers: number; features: Record<FeatureKey, boolean> };

const pricingPlans: Plan[] = [
  { id:"basic",      name:"ベーシック",     price:  9800, maxUsers: 10, features:{chat:true,shift:true,dailyReport:false,vehicle:false}},
  { id:"advanced",   name:"アドバンス",     price: 19800, maxUsers: 30, features:{chat:true,shift:true,dailyReport:true, vehicle:false}},
  { id:"pro",        name:"プロ",           price: 32000, maxUsers: 50, features:{chat:true,shift:true,dailyReport:true, vehicle:true }},
  { id:"elite",      name:"エリート",       price: 42000, maxUsers: 70, features:{chat:true,shift:true,dailyReport:true, vehicle:true }},
  { id:"premium",    name:"プレミアム",     price: 55000, maxUsers: 99, features:{chat:true,shift:true,dailyReport:true, vehicle:true }},
  { id:"unlimited",  name:"アンリミテッド", price: 60000, maxUsers: Number.POSITIVE_INFINITY, features:{chat:true,shift:true,dailyReport:true, vehicle:true }},
];

type CompanyCaps = { maxUsers: number | null }; // null = 無制限
type CompanyStats = { adminCount: number; driverCount: number; total: number };

/** 上限の取得（API優先 / localStorage フォールバック） */
const loadCompanyCaps = async (company: string): Promise<CompanyCaps> => {
  try {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    const res = await fetch(api(`/api/company/config?company=${encodeURIComponent(company)}`), {
      headers: { Authorization: `Bearer ${idToken || ""}`, Accept: "application/json" },
      credentials: "include",
    });
    if (res.ok) {
      const json = await res.json(); // { limits: { maxUsers: number|null } }
      const raw = json?.limits?.maxUsers;
      return { maxUsers: typeof raw === "number" ? raw : null };
    }
  } catch {}
  try {
    const list = JSON.parse(localStorage.getItem("customerMaster") || "[]");
    const item = Array.isArray(list) ? list.find((x: any) => x.company === company) : null;
    const raw = item?.limits?.maxUsers;
    return { maxUsers: typeof raw === "number" ? raw : null };
  } catch {
    return { maxUsers: null };
  }
};

/** 会社の管理者/ドライバー人数（API優先 / localStorage フォールバック） */
const fetchCompanyStats = async (company: string): Promise<CompanyStats> => {
  try {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    const res = await fetch(api(`/api/company/stats?company=${encodeURIComponent(company)}`), {
      headers: { Authorization: `Bearer ${idToken||""}`, Accept: "application/json" },
      credentials: "include",
    });
    if (res.ok) {
      const json = await res.json(); // { adminCount, driverCount, userCount }
      return {
        adminCount: Number(json?.adminCount || 0),
        driverCount: Number(json?.driverCount || 0),
        total: Number(json?.userCount ?? (Number(json?.adminCount||0)+Number(json?.driverCount||0))),
      };
    }
  } catch {}
  const admins  = JSON.parse(localStorage.getItem("adminMaster")  || "[]").filter((a:any)=>a.company===company).length;
  const drivers = JSON.parse(localStorage.getItem("driverMaster") || "[]").filter((d:any)=>d.company===company).length;
  return { adminCount: admins, driverCount: drivers, total: admins+drivers };
};

/** 次に上がるべきプラン（必要人数を満たす最小プラン） */
const findPlanByMaxUsers = (needed: number): Plan => {
  return pricingPlans.find(p => needed <= p.maxUsers) || pricingPlans[pricingPlans.length-1];
};

// ✅ Firestoreからドライバー一覧を取得する関数（あとで使います）
export const fetchDrivers = async (company: string): Promise<Driver[]> => {
  try {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("未ログイン");

    const res = await fetch(api(`/api/drivers?company=${encodeURIComponent(company)}`), {
      headers: { Authorization: `Bearer ${idToken}` },
      credentials: "include",
    });
    if (!res.ok) throw new Error("Fetch failed");
    const drivers = await res.json();
    return drivers;
  } catch (error) {
    console.error("❌ ドライバー取得失敗:", error);
    return [];
  }
};

// ✅ Neonに保存する共通関数（Fileは送らない）
const persist = async (company: string, drivers: Driver[]) => {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    alert("未ログインです。再ログインしてください。");
    throw new Error("no token");
  }
  const sanitized = drivers.map(({ attachments, licenseFiles, ...rest }) => rest);
  try {
    const res = await fetch(api("/api/drivers/save"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      credentials: "include",
      body: JSON.stringify({ company, drivers: sanitized }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  } catch (e) {
    console.error("❌ 保存に失敗:", e);
    alert("保存に失敗しました。ネットワークをご確認ください。");
    throw e;
  }
};

interface Notification { id: string; message: string; timestamp: string; read: boolean; }
export interface Driver {
  id: string; name: string; contractType: "社員"|"委託"; company: string; phone: string; address: string;
  mail?: string; birthday: string; invoiceNo?: string;
  licenseFiles: File[]; licenseExpiry: string; attachments: File[]; hidden: boolean;
  status: "予定なし"|"稼働前"|"稼働中"|"休憩中"|"稼働終了";
  isWorking: boolean; resting: boolean; shiftStart?: string; shiftEnd?: string; statusUpdatedAt?: string;
  uid: string; loginId: string; password: string; [key: string]: any;
}

const AdminDriverManager = () => {
  const persistDebounced = debounce((company: string, drivers: Driver[]) => { persist(company, drivers); }, 600);

  const admin = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}");
  const company = admin.company || "";

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [caps, setCaps] = useState<CompanyCaps>({ maxUsers: null });
  const [stats, setStats] = useState<CompanyStats>({ adminCount: 0, driverCount: 0, total: 0 });

  // 合算人数で判定（無制限でないときのみ）
  const finiteMax = typeof caps.maxUsers === "number" && Number.isFinite(caps.maxUsers);
  const combinedNow = stats.adminCount + drivers.length; // 管理者 + ドライバー
  const [loaded, setLoaded] = useState(false);

  // 初期ロード
  useEffect(() => {
    const load = async () => {
      const fetched = await fetchDrivers(company);
      setDrivers(fetched);

      const storedCustom = localStorage.getItem("driverCustomFields");
      if (storedCustom) setCustomFields(JSON.parse(storedCustom));

      const c = await loadCompanyCaps(company);
      setCaps(c);

      const s = await fetchCompanyStats(company);
      setStats({ ...s, driverCount: fetched.length, total: s.adminCount + fetched.length });
      setLoaded(true);
    };
    load();
  }, []);

  // ドライバー配列が変わるたびに合算を更新
  useEffect(() => {
    setStats(prev => ({ ...prev, driverCount: drivers.length, total: prev.adminCount + drivers.length }));
  }, [drivers]);

  /** ====== freee 風：アップグレード提案モーダル（承認不要で即適用） ====== */
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeTo, setUpgradeTo] = useState<Plan | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string>("");

  // ★ 会社のプランを即時アップグレードして保存（API → localStorage）
  const applyPlanUpgradeNow = async (toPlan: Plan) => {
     // 当月1日 00:00:00 を ISO に
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const firstISO = firstOfMonth.toISOString();
    // API
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      await fetch(api("/api/billing/upgrade"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken||""}` },
        credentials: "include",
        body: JSON.stringify({
          company,
          toPlanId: toPlan.id,
          effectiveFrom: firstISO, // 当月1日
          apply: "immediate",
        }),
      });
    } catch {
      // API失敗でも続行（ローカル反映）
    }

    // localStorage (customerMaster) を更新
    try {
      const list = JSON.parse(localStorage.getItem("customerMaster") || "[]");
      const idx = Array.isArray(list) ? list.findIndex((x: any) => x.company === company) : -1;
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          selectedPlans: [toPlan.id],
          plan: toPlan.name,
          limits: { ...(list[idx].limits||{}), maxUsers: Number.isFinite(toPlan.maxUsers) ? toPlan.maxUsers : null },
          features: { ...toPlan.features },
          billing: {
            ...(list[idx].billing||{}),
            currentPlanId: toPlan.id,
            currentPrice: toPlan.price,
            lastChangedAt: new Date().toISOString(),
            effectiveFrom: firstISO, // 当月から適用で統一
          },
        };
        localStorage.setItem("customerMaster", JSON.stringify(list));
      }
    } catch {}

    // 画面の上限状態を即時反映
    setCaps({ maxUsers: Number.isFinite(toPlan.maxUsers) ? toPlan.maxUsers : null });

    // ★ 管理者へ通知を残す（画面右上の通知一覧に出ます）
  addNotification(`プランを「${toPlan.name}」（月額 ¥${toPlan.price.toLocaleString()}）にアップグレードしました。今月分から適用されます。`);

    // 通知（承認不要の確定メッセージ）
    alert(`✅ プランを「${toPlan.name}」にアップグレードしました。\n月額 ¥${toPlan.price.toLocaleString()}（当月から適用）`);
  };

  const openUpgradeFlow = (neededTotal: number) => {
    const plan = findPlanByMaxUsers(neededTotal);
    setUpgradeTo(plan);
    setUpgradeMessage(
      `現在の登録人数（管理者+ドライバー）では上限を超えます。\n` +
      `プランを「${plan.name}」(月額 ¥${plan.price.toLocaleString()}) にアップグレードすると続行できます。\n` +
      `※ アップグレードは本日が属する月から適用されます。`
    );
    setUpgradeOpen(true);
  };

  // ★ アップグレード確定 → 即適用 → そのまま追加処理も続行
  const handleConfirmUpgradeAndAdd = async () => {
    if (!upgradeTo) return;
    await applyPlanUpgradeNow(upgradeTo);
    setUpgradeOpen(false);
    await addDriverRow(true); // 上限チェックをスキップして続行
  };

  /** ====== 通知・ステータス更新は既存どおり ====== */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const addNotification = (message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const timestamp = new Date().toLocaleString("ja-JP");
    const newNotification: Notification = { id, message, timestamp, read: false };
    setNotifications(prev => {
      const updated = [...prev, newNotification];
      localStorage.setItem("adminNotifications", JSON.stringify(updated));
      return updated;
    });
  };

  const updateDriverStatus = () => {
    setDrivers((prev) => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
      const formattedTime = now.toLocaleTimeString("ja-JP");
      return prev.map((d) => {
        const hasShift = d.shiftStart && d.shiftEnd;
        const shiftStart = d.shiftStart!;
        const shiftEnd   = d.shiftEnd!;
        const isWorking  = d.isWorking;
        const isResting  = d.resting;

        if (!hasShift) return { ...d, status:"予定なし", statusUpdatedAt: formattedTime };
        if (!isWorking && currentTime >= shiftStart && currentTime < shiftEnd) addNotification(`【警告】${d.name} さんが勤務開始していません（${shiftStart}〜）`);
        if (isWorking  && currentTime >= shiftEnd)                           addNotification(`【警告】${d.name} さんが勤務終了していません（〜${shiftEnd}）`);
        if (!isWorking && currentTime <  shiftStart) return { ...d, status:"稼働前",  statusUpdatedAt: formattedTime };
        if (isWorking  && isResting)                return { ...d, status:"休憩中",  statusUpdatedAt: formattedTime };
        if (isWorking  && currentTime >= shiftStart && currentTime < shiftEnd) return { ...d, status:"稼働中",  statusUpdatedAt: formattedTime };
        if (isWorking  && currentTime >= shiftEnd) return { ...d, status:"稼働終了", statusUpdatedAt: formattedTime };
        return { ...d, status:"予定なし", statusUpdatedAt: formattedTime };
      });
    });
  };
  useEffect(() => {
    updateDriverStatus();
    const timer = setInterval(updateDriverStatus, 30000);
    return () => clearInterval(timer);
  }, []);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);

  const handleEdit = (index: number) => { setEditingIndex(index); setExpandedRowIndex(index); };
  const handleSave = () => { setEditingIndex(null); setExpandedRowIndex(null); };

  const handleDelete = async (index: number) => {
    if (!window.confirm("本当にこのドライバーを削除しますか？")) return;
    const updated = [...drivers]; updated.splice(index, 1); setDrivers(updated);
    await persist(company, updated);
  };

  const handleChange = (index: number, field: keyof Driver, value: any) => {
    const updated = [...drivers]; (updated[index] as any)[field] = value; setDrivers(updated);
    persistDebounced(company, updated);
  };

  // ★ 追加処理を共通化（skipCheck=true で上限チェックを飛ばす）
  const addDriverRow = async (skipCheck = false) => {
    const neededTotal = stats.adminCount + drivers.length + 1;
    if (!skipCheck && finiteMax && neededTotal > (caps.maxUsers as number)) {
      openUpgradeFlow(neededTotal);
      return;
    }

    const adminCompany = company;
    const newLoginId = `driver${String(drivers.length + 1).padStart(4, "0")}`;
    const newPassword = genRandom(8);

    const updated = [
      ...drivers,
      {
        id: `driver${String(drivers.length + 1).padStart(4, "0")}`,
        uid: `uid${Date.now()}`,
        loginId: newLoginId,
        password: newPassword,
        name: "",
        contractType: "社員",
        invoiceNo: "",
        company: adminCompany,
        phone: "",
        address: "",
        mail: "",
        birthday: "",
        licenseFiles: [],
        licenseExpiry: "",
        attachments: [],
        hidden: false,
        status: "予定なし",
        isWorking: false,
        resting: false,
        shiftStart: "09:00",
        shiftEnd: "18:00",
      } as Driver,
    ];

    setDrivers(updated);
    await persist(company, updated);

    setEditingIndex(drivers.length);
    setExpandedRowIndex(drivers.length);
    alert(`✅ ドライバーが追加されました\nログインID: ${newLoginId}\nパスワード: ${newPassword}`);
  };

  const handleAddRow = async () => addDriverRow(false);

  const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const newFiles = Array.from(files);
    const updated = [...drivers];
    const current = { ...updated[index] };
    const existingFiles = current.attachments || [];
    const filteredNewFiles = newFiles.filter(newFile =>
      !existingFiles.some(existing => existing.name === newFile.name && existing.size === newFile.size)
    );
    if (existingFiles.length + filteredNewFiles.length > 10) { alert("最大10ファイルまで添付できます。"); return; }
    current.attachments = [...existingFiles, ...filteredNewFiles]; updated[index] = current as Driver;
    setDrivers(updated); await persist(company, updated); e.target.value = "";
  };

  const handleFileDelete = async (rowIndex: number, fileIndex: number) => {
    const updatedFiles = [...(drivers[rowIndex].attachments || [])]; updatedFiles.splice(fileIndex, 1);
    const updated = [...drivers]; updated[rowIndex] = { ...updated[rowIndex], attachments: updatedFiles };
    setDrivers(updated); await persist(company, updated as Driver[]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "予定なし": return "bg-gray-400 text-white";
      case "稼働前":   return "bg-yellow-400 text-black";
      case "稼働中":   return "bg-orange-400 text-white";
      case "休憩中":   return "bg-blue-400 text-white";
      case "稼働終了": return "bg-green-500 text-white";
      default:         return "bg-gray-200";
    }
  };
  const getTypeBadge = (ct?: string) => {
    const base = "inline-block px-3 py-1 rounded-full font-semibold text-sm ";
    switch (ct) {
      case "社員": return { class: base + "text-white bg-green-600",  label: "社員" };
      case "委託": return { class: base + "text-white bg-purple-600", label: "委託" };
      default:     return { class: base + "text-gray-700 bg-gray-300", label: "未設定" };
    }
  };

  return (
    <div className="p-4 w-full overflow-auto bg-white">
      <div className="flex items-center text-2xl font-bold mb-4">
        <span className="mr-2">🚚</span>
        <span>ドライバー管理 <span className="text-sm text-gray-500 ml-2">-Driver Manager-</span></span>
      </div>

      <div className="flex items-center gap-4 mb-2">
        <button
   className="px-4 py-1 rounded text-white bg-blue-600 hover:bg-blue-700"
   onClick={handleAddRow} disabled={!loaded} title={!loaded ? "読み込み中…" : (finiteMax ? `上限 ${caps.maxUsers} 名（管理者+ドライバー合算）` : "無制限")}>
   title={finiteMax ? `上限 ${caps.maxUsers} 名（管理者+ドライバー合算）` : "無制限"}
 
          ドライバー追加
        </button>
        <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded" onClick={updateDriverStatus}>
          ステータス更新
        </button>
        {editingIndex !== null && (
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded" onClick={handleSave}>
            保存
          </button>
        )}
        <span className="text-sm text-gray-600 ml-auto">
          管理者 {stats.adminCount} 名 / ドライバー {drivers.length} 名
          {finiteMax ? `　合計 ${combinedNow} 名 / 上限 ${caps.maxUsers} 名` : `　合計 ${combinedNow} 名（上限なし）`}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border border-gray-300 shadow table-auto whitespace-nowrap">
          <thead className="bg-gray-800 text-white font-bold">
            <tr>
              <th className="border px-2 py-1">ステータス</th>
              <th className="border px-2 py-1">操作</th>
              <th className="border px-2 py-1">ID</th>
              <th className="border px-2 py-1">氏名</th>
              <th className="border px-2 py-1">契約種別</th>
              <th className="border px-2 py-1">インボイス番号</th>
              <th className="border px-2 py-1">所属会社</th>
              <th className="border px-2 py-1">電話番号</th>
              <th className="border px-2 py-1">ログインID</th>
              <th className="border px-2 py-1">パスワード</th>
              <th className="border px-2 py-1">住所</th>
              <th className="border px-2 py-1">メール</th>
              <th className="border px-2 py-1">生年月日</th>
              {customFields.map((field, i) => (<th key={`h-${i}`} className="border px-2 py-1">{field}</th>))}
              <th className="border px-2 py-1">ファイル添付</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, idx) => (
              <tr key={idx} className="odd:bg-white even:bg-gray-100">
                <td className="border px-2 py-1 break-all">
                  <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(d.status)}`}>{d.status}</div>
                  <div className="text-[10px] text-gray-600 mt-1">最終更新: {d.statusUpdatedAt || "未取得"}</div>
                </td>
                <td className="border px-2 py-1 break-all">
                  <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded mr-2" onClick={() => { setEditingIndex(idx); setExpandedRowIndex(idx); }}>編集</button>
                  <button className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded" onClick={() => {
                    if (!window.confirm("本当にこのドライバーを削除しますか？")) return;
                    const updated = [...drivers]; updated.splice(idx, 1); setDrivers(updated); persist(company, updated);
                  }}>削除</button>
                </td>
                <td className="border px-2 py-1 break-all">{d.id}</td>
                <td className="border px-2 py-1 break-all">{editingIndex===idx ? (<input className="w-full text-sm" value={d.name} onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).name=e.target.value; setDrivers(u); persistDebounced(company,u); }} />) : d.name}</td>
                <td className="border px-2 py-1 break-all">
                  {editingIndex===idx ? (
                    <select className="w-full text-sm" value={d.contractType}
                      onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).contractType=e.target.value; setDrivers(u); persistDebounced(company,u); }}>
                      <option value="社員">社員</option><option value="委託">委託</option>
                    </select>
                  ) : <span className={`inline-block px-3 py-1 rounded-full font-semibold text-sm ${d.contractType==="社員"?"text-white bg-green-600":"text-white bg-purple-600"}`}>{d.contractType}</span>}
                </td>
                <td className="border px-2 py-1 break-all">
                  {editingIndex===idx ? (
                    <input className="w-full text-sm disabled:bg-gray-100" value={d.invoiceNo || ""} onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).invoiceNo=e.target.value; setDrivers(u); persistDebounced(company,u); }} placeholder="T1234-…" disabled={d.contractType!=="委託"} />
                  ) : d.contractType==="委託" ? d.invoiceNo || "-" : "-"}
                </td>
                <td className="border px-2 py-1 break-all">{editingIndex===idx ? (<input className="w-full text-sm" value={d.company} onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).company=e.target.value; setDrivers(u); persistDebounced(company,u); }} />) : d.company}</td>
                <td className="border px-2 py-1 break-all">{editingIndex===idx ? (<input className="w-full text-sm" value={d.phone} onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).phone=e.target.value; setDrivers(u); persistDebounced(company,u); }} />) : d.phone}</td>
                <td className="border px-2 py-1 break-all">{d.loginId}</td>
                <td className="border px-2 py-1 break-all">{d.password}</td>
                <td className="border px-2 py-1 break-all">{editingIndex===idx ? (<input className="w-full text-sm" value={d.address} onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).address=e.target.value; setDrivers(u); persistDebounced(company,u); }} />) : d.address}</td>
                <td className="border px-2 py-1 break-all">{editingIndex===idx ? (<input type="email" className="w-full text-sm" value={d.mail||""} onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).mail=e.target.value; setDrivers(u); persistDebounced(company,u); }} placeholder="sample@example.com" />) : d.mail}</td>
                <td className="border px-2 py-1 break-all">{editingIndex===idx ? (<input type="date" className="w-full text-sm" value={d.birthday} onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).birthday=e.target.value; setDrivers(u); persistDebounced(company,u); }} />) : d.birthday}</td>
                {/* 省略: カスタム項目 + 添付UIは前回版と同様 */}
                <td className="border px-2 py-1 text-center">
                  <button className="bg-blue-500 text-white px-2 py-1 rounded text-sm" onClick={()=>setExpandedRowIndex(expandedRowIndex===idx?null:idx)}>詳細</button>
                  {expandedRowIndex===idx && (
                    <div className="mt-2">
                      {editingIndex===idx && (<input type="file" multiple onChange={(e)=>handleFileUpload(idx, e)} className="mb-1 text-xs" />)}
                      {/* 添付一覧も前回版のまま */}
                      <ul className="text-left text-xs mt-1">
  {(d.attachments || []).map((file, fileIndex) => (
    <li key={fileIndex} className="flex items-center justify-between mb-1">
      <a
        href={URL.createObjectURL(file)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline break-all w-40"
      >
        {file.name}
      </a>
      {editingIndex === idx && (
        <button
          className="text-red-600 ml-2"
          onClick={() => handleFileDelete(idx, fileIndex)}
        >
          削除
        </button>
      )}
    </li>
  ))}
</ul>

                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== freee 風：アップグレード提案モーダル（承認不要） ===== */}
      {upgradeOpen && upgradeTo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[520px] p-5">
            <h3 className="text-lg font-bold mb-2">プラン上限に達しました</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-700 mb-4">{upgradeMessage}</p>
            <div className="rounded-md border p-3 mb-4 bg-gray-50">
              <div className="text-sm">アップグレード先</div>
              <div className="font-semibold text-lg">{upgradeTo.name}</div>
              <div className="text-sm text-gray-600">月額 ¥{upgradeTo.price.toLocaleString()}（税込）</div>
              <div className="text-xs text-gray-500 mt-1">※ 当月から適用・承認不要で即時反映</div>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="px-4 py-1 rounded border" onClick={()=>setUpgradeOpen(false)}>キャンセル</button>
              <button className="px-4 py-1 rounded bg-blue-600 text-white" onClick={handleConfirmUpgradeAndAdd}>
                今すぐアップグレードして続行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDriverManager;
