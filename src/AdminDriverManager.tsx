"use client";
// ✅ import は一番上にまとめてください
import { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";

/** ✅ 本番向け API 基点（Next.js / Vite 双方対応 & 末尾スラッシュ除去） */
const RAW_BASE: string =
  // Next.js
  (((typeof process !== "undefined" ? (process as any) : undefined)?.env?.NEXT_PUBLIC_API_BASE) as string) ||
  // Vite
  (((typeof import.meta !== "undefined" ? (import.meta as any) : undefined)?.env?.VITE_API_BASE_URL) as string) ||
  "";
const API_BASE_URL = RAW_BASE.replace(/\/$/, "");
const api = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

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

interface Notification { id: string; message: string; timestamp: string; read: boolean; }
export interface Driver {
  id: string; name: string; contractType: "社員"|"委託"; company: string; phone: string; address: string;
  mail?: string; birthday: string; invoiceNo?: string;
  licenseFiles: File[]; licenseExpiry: string; attachments: File[]; hidden: boolean;
  status: "予定なし"|"稼働前"|"稼働中"|"休憩中"|"稼働終了";
  isWorking: boolean; resting: boolean; shiftStart?: string; shiftEnd?: string; statusUpdatedAt?: string;
  uid: string; loginId: string; password: string; [key: string]: any;
}

const isProd =
  (typeof process !== "undefined" && process.env?.NODE_ENV === "production") ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE === "production");

const loadDriversLocal = (company: string): Driver[] => {
  try {
    const all = JSON.parse(localStorage.getItem("driverMaster") || "[]");
    return Array.isArray(all) ? all.filter((x: any) => x.company === company) : [];
  } catch { return []; }
};

const saveDriversLocal = (company: string, drivers: Driver[]) => {
  try {
    const all = JSON.parse(localStorage.getItem("driverMaster") || "[]");
    const others = Array.isArray(all) ? all.filter((x: any) => x.company !== company) : [];
    localStorage.setItem("driverMaster", JSON.stringify([...others, ...drivers]));
  } catch {}
};

/* ======== 本番仕様：ドライバー用 Firebase Auth 発行 API 呼び出し ======== */
const provisionDriverAuth = async (company: string, loginId: string, password: string) => {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch(api("/api/drivers/provision"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${idToken || ""}`,
      "x-dev-company": company,          // ★追加しておくと安心
    },
    credentials: "include",
    body: JSON.stringify({ company, loginId, password }),
  });
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<{ uid: string; email: string }>;
};

export const fetchDrivers = async (company: string): Promise<Driver[]> => {
  try {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("未ログイン");

    const res = await fetch(api(`/api/drivers?company=${encodeURIComponent(company)}`), {
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
        "x-dev-company": company,          // ★追加（開発時の保険）
      },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const drivers = await res.json();
    // 取得成功時：本番でもローカルにキャッシュ（再訪/オフライン対策）
    saveDriversLocal(company, drivers);
    return drivers;
  } catch (error) {
    console.error("❌ ドライバー取得失敗:", error);
    // 失敗時は常にローカルへフォールバック（開発/本番問わず）
    const local = loadDriversLocal(company);
    return Array.isArray(local) ? local : [];
  }
};

const persist = async (company: string, drivers: Driver[], opts?: { silent?: boolean }) => {
  const silent = !!opts?.silent;

  // 先に sanitize（以後どの経路でも参照できる）
  const sanitized = drivers.map(({ attachments, licenseFiles, password, ...rest }) => rest);

  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();

  if (!idToken) {
    if (silent) {
      // 未ログインでも静かにローカルへ保存
      saveDriversLocal(company, sanitized as unknown as Driver[]);
      return;
    }
    alert("未ログインです。再ログインしてください。");
    throw new Error("no token");
  }

  try {
    const res = await fetch(api("/api/drivers/save"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        "x-dev-company": company,          // ★追加（開発時の保険）
      },
      credentials: "include",
      body: JSON.stringify({ company, drivers: sanitized }),
    });

    if (!res.ok) {
      // 失敗時も必ずローカルへキャッシュ（本番でも）
      saveDriversLocal(company, sanitized as unknown as Driver[]);
      if (silent) return; // サイレント要求ならここで終了
      throw new Error(`Save failed: ${res.status}`);
    }
    // 成功時もローカルにキャッシュしておく（オフライン復帰に強くする）
    saveDriversLocal(company, sanitized as unknown as Driver[]);
  } catch (e) {
    console.error("❌ 保存に失敗:", e);
    if (!silent) alert("保存に失敗しました。ネットワークをご確認ください。");
    // 本番でもフォールバック保存
    saveDriversLocal(company, sanitized as unknown as Driver[]);
    throw e;
  }
};

const AdminDriverManager = () => {
  const persistDebounced = debounce((company: string, drivers: Driver[]) => {
    persist(company, drivers, { silent: true });
  }, 600);

  const company = (typeof window !== "undefined" ? localStorage.getItem("company") : "") || "";

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [caps, setCaps] = useState<CompanyCaps>({ maxUsers: null });
  const [stats, setStats] = useState<CompanyStats>({ adminCount: 0, driverCount: 0, total: 0 });

  // 合算人数で判定（無制限でないときのみ）
  const finiteMax = typeof caps.maxUsers === "number" && Number.isFinite(caps.maxUsers);
  const combinedNow = stats.adminCount + drivers.length; // 管理者 + ドライバー
  const [loaded, setLoaded] = useState(false);

  // 🔽 追加：差し込み位置のモード
  type InsertMode = 'top' | 'bottom' | 'afterSelected' | 'byLoginId';
  const [insertMode, setInsertMode] = useState<InsertMode>('bottom');

  const reloadFromServer = async () => {
    if (!company) return; // ★ company 未確定なら何もしない
    const fetched = await fetchDrivers(company);
    setDrivers(fetched);
    setStats(prev => ({ ...prev, driverCount: fetched.length, total: prev.adminCount + fetched.length }));
  };

  useEffect(() => {
    let mounted = true; // ★ アンマウント後 setState 防止
    const load = async () => {
      if (!company) return;

      const fetched = await fetchDrivers(company);
      if (!mounted) return;
      setDrivers(fetched);

      const storedCustom = localStorage.getItem("driverCustomFields");
      if (!mounted) return;
      if (storedCustom) setCustomFields(JSON.parse(storedCustom));

      const c = await loadCompanyCaps(company);
      if (!mounted) return;
      setCaps(c);

      const s = await fetchCompanyStats(company);
      if (!mounted) return;
      setStats({ ...s, driverCount: fetched.length, total: s.adminCount + fetched.length });

      if (!mounted) return;
      setLoaded(true);
    };
    load();
    return () => { mounted = false; };
  }, [company]);

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

    // ★ 管理者へ通知を残す
    addNotification(`プランを「${toPlan.name}」（月額 ¥${toPlan.price.toLocaleString()}）にアップグレードしました。今月分から適用されます。`);

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
    await reloadFromServer(); // ← サーバ版で確定
  };

  const handleChange = (index: number, field: keyof Driver, value: any) => {
    const updated = [...drivers]; (updated[index] as any)[field] = value; setDrivers(updated);
    persistDebounced(company, updated);
  };

  // ★ 追加処理（Firebaseで発行 → uid 取得 → 行追加）— 差し込み位置対応の本番仕様
  const addDriverRow = async (skipCheck = false) => {
    // 直前にサーバの最新を取得して重複を避ける
    const latest = await fetchDrivers(company);
    const latestLoginIds = new Set(latest.map((x: Driver) => x.loginId));
    const neededTotal = stats.adminCount + latest.length + 1;

    if (!skipCheck && finiteMax && neededTotal > (caps.maxUsers as number)) {
      openUpgradeFlow(neededTotal);
      return;
    }

    // まずはシード（最新件数から driver0001… 連番）
    let seq = latest.length + 1;
    let loginId = `driver${String(seq).padStart(4, "0")}`;
    while (latestLoginIds.has(loginId)) {
      seq += 1;
      loginId = `driver${String(seq).padStart(4, "0")}`;
    }

    // Firebase発行（失敗してもドラフト行を作る）
    let uid = "";
    let password = genRandom(8); // 画面表示だけ。サーバには送らない
    let provisioned = false;
    try {
      // 409（衝突）には連番を進めて最大5回まで再試行
      let attempts = 0;
      while (attempts < 5) {
        try {
          const { uid: createdUid } = await provisionDriverAuth(company, loginId, password);
          uid = createdUid;
          provisioned = true;
          break;
        } catch (e: any) {
          if (e?.status === 409) {
            seq += 1;
            loginId = `driver${String(seq).padStart(4, "0")}`;
            attempts++;
            continue;
          }
          throw e; // その他のエラー→下の catch へ
        }
      }
    } catch {
      // オフライン/未ログイン/API不通など：ドラフト UID を払い出して続行
      uid = `local-${Date.now()}-${genRandom(4)}`;
      provisioned = false;
    }

    const newDriver: Driver = {
      id: `driver${String(seq).padStart(4, "0")}`,
      uid,
      loginId,
      password, // 画面表示のみ（persist では送られない）
      name: "",
      contractType: "社員",
      invoiceNo: "",
      company,
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
      provisionPending: !provisioned,
    };

    // === 差し込み位置モードを反映 ===
    const base = [...drivers];
    let updated: Driver[] = [];
    let newRowIndex = 0;

    if (insertMode === 'byLoginId') {
      updated = [...base, newDriver].sort((a, b) => a.loginId.localeCompare(b.loginId, 'ja'));
      newRowIndex = updated.findIndex((d) => d.uid === uid);
    } else {
      // デフォルトは末尾
      let insertAt = base.length;
      if (insertMode === 'top') insertAt = 0;
      else if (insertMode === 'afterSelected' && expandedRowIndex !== null) {
        insertAt = Math.min(expandedRowIndex + 1, base.length);
      }
      updated = [...base];
      updated.splice(insertAt, 0, newDriver);
      newRowIndex = insertAt;
    }

    setDrivers(updated);

    // 追加直後はサイレント保存（失敗時はローカルへ自動フォールバック）
    try {
      await persist(company, updated, { silent: true });
      await reloadFromServer();
    } catch {
      // 失敗しても UI はそのまま。ローカルに残す
    }

    // 即編集 & 詳細展開
    setEditingIndex(newRowIndex);
    setExpandedRowIndex(newRowIndex);

    // ★ ワンタイム表示 & クリップボードコピー
    try {
      await navigator.clipboard.writeText(`ログインID: ${loginId}\n初期PW: ${password}`);
    } catch {}
    alert(
      `✅ ドライバーを追加しました\n` +
      `ログインID: ${loginId}\n` +
      `初期パスワード: ${password}\n\n` +
      `${provisioned ? "" : "⚠️ 認証アカウントが未発行の可能性があります。/api/drivers/provision を確認してください。\n"}` +
      `※このパスワードは今回のみ表示され、サーバには保存されません。`
    );

    addNotification(`ドライバーを追加しました（ログインID: ${loginId} / 初期PW: ${password}）`);
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
    await reloadFromServer();
  };

  const handleFileDelete = async (rowIndex: number, fileIndex: number) => {
    const updatedFiles = [...(drivers[rowIndex].attachments || [])]; updatedFiles.splice(fileIndex, 1);
    const updated = [...drivers]; updated[rowIndex] = { ...updated[rowIndex], attachments: updatedFiles };
    setDrivers(updated); await persist(company, updated as Driver[]);
    await reloadFromServer();
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

  // クリップボードコピー（ID/PW）
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch { alert("コピーに失敗しました"); }
  };

  return (
    <div className="p-4 w-full overflow-auto bg-white">
      <div className="flex items-center text-black font-bold mb-4">
        <span className="mr-2">🚚</span>
        <span>ドライバー管理 <span className="text-sm text-gray-500 ml-2">-Driver Manager-</span></span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button
          type="button"
          className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 text-sm"
          onClick={handleAddRow}
          disabled={!loaded}
          title={!loaded ? "読み込み中…" : (finiteMax ? `上限 ${caps.maxUsers} 名（管理者+ドライバー合算）` : "無制限")}
        >
          ドライバー追加
        </button>

        {/* 🔽 追加：差し込み位置セレクト */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">差し込み位置</label>
          <select
            className="border rounded px-2 py-1 text-sm bg-white text-gray-900
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={insertMode}
            onChange={(e) => setInsertMode(e.target.value as InsertMode)}
            title="新規行をどこに差し込むか選べます"
          >
            <option value="bottom">末尾</option>
            <option value="top">先頭</option>
            <option value="afterSelected">選択行の下</option>
            <option value="byLoginId">ログインID昇順</option>
          </select>
        </div>

        <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm" onClick={updateDriverStatus}>
          ステータス更新
        </button>
        {editingIndex !== null && (
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm" onClick={handleSave}>
            保存
          </button>
        )}

        <span className="text-sm text-gray-600 ml-auto">
          管理者 {stats.adminCount} 名 / ドライバー {drivers.length} 名
          {finiteMax ? `　合計 ${combinedNow} 名 / 上限 ${caps.maxUsers} 名` : `　合計 ${combinedNow} 名（上限なし）`}
        </span>
      </div>

      {/* PC/タブレット：テーブル */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-t">
          <span>横にスクロールできます</span>
          <span>件数: {drivers.length}</span>
        </div>
        <div className="w-full overflow-x-auto border border-t-0 border-gray-200 rounded-b">
          <table className="w-full table-auto whitespace-nowrap bg-white text-slate-900">
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
            <tbody className="text-slate-900">
              {drivers.map((d, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-gray-100">
                  <td className="border px-2 py-1 break-all">
                    <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(d.status)}`}>{d.status}</div>
                    <div className="text-[10px] text-gray-600 mt-1">最終更新: {d.statusUpdatedAt || "未取得"}</div>
                  </td>

                  <td className="border px-2 py-1 break-all">
                    <button
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded mr-2"
                      onClick={() => { setEditingIndex(idx); setExpandedRowIndex(idx); }}
                    >
                      編集
                    </button>
                    <button
                      className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                      onClick={async () => {
                        if (!window.confirm("本当にこのドライバーを削除しますか？")) return;
                        const updated = [...drivers];
                        updated.splice(idx, 1);
                        setDrivers(updated);
                        await persist(company, updated);
                        await reloadFromServer();
                      }}
                    >
                      削除
                    </button>
                  </td>

                  <td className="border px-2 py-1 break-all">
                    {d.id}
                    {(d as any).provisionPending && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
                        未発行
                      </span>
                    )}
                  </td>

                  {/* 氏名 */}
                  <td className="border px-2 py-1 break-all">
                    {editingIndex===idx ? (
                      <input
                        autoFocus
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1
                          bg-white text-gray-900 placeholder-gray-500
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例）佐藤 太郎"
                        value={d.name}
                        onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).name=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                      />
                    ) : d.name}
                  </td>

                  {/* 契約種別 */}
                  <td className="border px-2 py-1 break-all">
                    {editingIndex===idx ? (
                      <select
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1
                          bg-white text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={d.contractType}
                        onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).contractType=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                      >
                        <option value="社員">社員</option>
                        <option value="委託">委託</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-3 py-1 rounded-full font-semibold text-sm ${d.contractType==="社員"?"text-white bg-green-600":"text-white bg-purple-600"}`}>
                        {d.contractType}
                      </span>
                    )}
                  </td>

                  {/* インボイス番号（委託のみ編集可） */}
                  <td className="border px-2 py-1 break-all">
                    {editingIndex===idx ? (
                      <input
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1
                          bg-white text-gray-900 placeholder-gray-500
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                          disabled:bg-gray-100"
                        value={d.invoiceNo || ""}
                        onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).invoiceNo=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                        placeholder="T1234-…"
                        disabled={d.contractType!=="委託"}
                      />
                    ) : d.contractType==="委託" ? (d.invoiceNo || "-") : "-"}
                  </td>

                  {/* 所属会社 */}
                  <td className="border px-2 py-1 break-all">
                    {editingIndex===idx ? (
                      <input
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1
                          bg-white text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={d.company}
                        onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).company=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                      />
                    ) : d.company}
                  </td>

                  {/* 電話番号 */}
                  <td className="border px-2 py-1 break-all">
                    {editingIndex===idx ? (
                      <input
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1
                          bg-white text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={d.phone}
                        onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).phone=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                      />
                    ) : d.phone}
                  </td>

                  {/* ログインID／PW（表示+コピー） */}
                  <td className="border px-2 py-1 break-all">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{d.loginId}</span>
                      <button
                        type="button"
                        className="text-xs underline text-indigo-700"
                        onClick={() => copyText(d.loginId)}
                      >
                        コピー
                      </button>
                    </div>
                  </td>
                  <td className="border px-2 py-1 break-all">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{d.password}</span>
                      <button
                        type="button"
                        className="text-xs underline text-indigo-700"
                        onClick={() => copyText(d.password)}
                      >
                        コピー
                      </button>
                    </div>
                  </td>

                  {/* 住所 */}
                  <td className="border px-2 py-1 break-all">
                    {editingIndex===idx ? (
                      <input
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1
                          bg-white text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={d.address}
                        onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).address=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                      />
                    ) : d.address}
                  </td>

                  {/* メール */}
                  <td className="border px-2 py-1 break-all">
                    {editingIndex===idx ? (
                      <input
                        type="email"
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1
                          bg-white text-gray-900 placeholder-gray-500
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={d.mail||""}
                        onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).mail=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                        placeholder="sample@example.com"
                      />
                    ) : d.mail}
                  </td>

                  {/* 生年月日 */}
                  <td className="border px-2 py-1 break-all">
                    {editingIndex===idx ? (
                      <input
                        type="date"
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1
                          bg-white text-gray-900
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={d.birthday}
                        onChange={(e)=>{ const u=[...drivers]; (u[idx] as any).birthday=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                      />
                    ) : d.birthday}
                  </td>

                  {/* カスタム列 */}
                  {customFields.map((field, i) => (
                    <td key={`c-${idx}-${i}`} className="border px-2 py-1 break-all">
                      {editingIndex===idx ? (
                        <input
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1
                            bg-white text-gray-900 placeholder-gray-500
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={(d as any)[field] || ""}
                          onChange={(e)=>{ const u=[...drivers]; (u[idx] as any)[field]=e.target.value; setDrivers(u); persistDebounced(company,u); }}
                        />
                      ) : ((d as any)[field] || "")}
                    </td>
                  ))}

                  {/* 添付 */}
                  <td className="border px-2 py-1 text-center">
                    <button
                      className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                      onClick={()=>setExpandedRowIndex(expandedRowIndex===idx?null:idx)}
                    >
                      詳細
                    </button>
                    {expandedRowIndex===idx && (
                      <div className="mt-2">
                        {editingIndex===idx && (
                          <input type="file" multiple onChange={(e)=>handleFileUpload(idx, e)} className="mb-1 text-xs" />
                        )}
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
      </div>

      {/* スマホ：カード一覧 */}
      <div className="md:hidden space-y-3">
        {drivers.map((d, idx) => {
          const tb = getTypeBadge(d.contractType);
          return (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(d.status)}`}>{d.status}</div>
                <div className="text-[10px] text-gray-500">最終更新: {d.statusUpdatedAt || "未取得"}</div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="font-semibold text-gray-900">{d.name || "（氏名未設定）"}</div>
                <span className={tb.class}>{tb.label}</span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-1 text-sm">
                <div className="text-gray-500">ID: <span className="text-gray-900">{d.id}</span></div>
                <div className="text-gray-500">会社: <span className="text-gray-900">{d.company}</span></div>
                <div className="text-gray-500">電話: <span className="text-gray-900">{d.phone}</span></div>
                <div className="text-gray-500 flex flex-wrap items-center gap-2">
                  <span>ログインID:</span>
                  <span className="font-mono text-gray-900">{d.loginId}</span>
                  <button className="text-xs underline text-indigo-700" onClick={()=>copyText(d.loginId)}>コピー</button>
                </div>
                <div className="text-gray-500 flex flex-wrap items-center gap-2">
                  <span>初期PW:</span>
                  <span className="font-mono text-gray-900">{d.password}</span>
                  <button className="text-xs underline text-indigo-700" onClick={()=>copyText(d.password)}>コピー</button>
                </div>
                {d.mail && <div className="text-gray-500">メール: <span className="text-gray-900 break-all">{d.mail}</span></div>}
                {d.address && <div className="text-gray-500">住所: <span className="text-gray-900 break-all">{d.address}</span></div>}
                {d.birthday && <div className="text-gray-500">生年月日: <span className="text-gray-900">{d.birthday}</span></div>}
                {/* カスタム項目 */}
                {customFields.map((field, i) => (
                  <div key={`m-${idx}-${i}`} className="text-gray-500">
                    {field}: <span className="text-gray-900 break-all">{(d as any)[field] || ""}</span>
                  </div>
                ))}
              </div>

              {/* 編集系（シンプル） */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                  onClick={() => { setEditingIndex(idx); setExpandedRowIndex(idx); }}
                >
                  編集
                </button>
                <button
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                  onClick={() => handleDelete(idx)}
                >
                  削除
                </button>
                {editingIndex === idx && (
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                    onClick={handleSave}
                  >
                    保存
                  </button>
                )}
              </div>

              {/* 編集フォーム（必要最低限） */}
              {editingIndex === idx && (
                <div className="mt-3 space-y-2">
                  <input
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    placeholder="氏名"
                    value={d.name}
                    onChange={(e)=>handleChange(idx, "name", e.target.value)}
                  />
                  <select
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    value={d.contractType}
                    onChange={(e)=>handleChange(idx, "contractType", e.target.value)}
                  >
                    <option value="社員">社員</option>
                    <option value="委託">委託</option>
                  </select>
                  <input
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    placeholder="電話番号"
                    value={d.phone}
                    onChange={(e)=>handleChange(idx, "phone", e.target.value)}
                  />
                  <input
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    placeholder="住所"
                    value={d.address}
                    onChange={(e)=>handleChange(idx, "address", e.target.value)}
                  />
                  <input
                    type="email"
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    placeholder="sample@example.com"
                    value={d.mail || ""}
                    onChange={(e)=>handleChange(idx, "mail", e.target.value)}
                  />
                  <input
                    type="date"
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    value={d.birthday}
                    onChange={(e)=>handleChange(idx, "birthday", e.target.value)}
                  />
                  {/* ファイル添付（簡易） */}
                  <div className="pt-1">
                    <input type="file" multiple onChange={(e)=>handleFileUpload(idx, e)} className="text-xs" />
                    <ul className="text-left text-xs mt-1">
                      {(d.attachments || []).map((file, fileIndex) => (
                        <li key={fileIndex} className="flex items-center justify-between mb-1">
                          <span className="break-all w-44">{file.name}</span>
                          <button className="text-red-600 ml-2" onClick={() => handleFileDelete(idx, fileIndex)}>削除</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== freee 風：アップグレード提案モーダル（承認不要） ===== */}
      {upgradeOpen && upgradeTo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[92%] max-w-[520px] p-5">
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
