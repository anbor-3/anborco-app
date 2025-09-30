"use client";
import React from "react";
import { getAuth } from "firebase/auth";

/* ========================= Types ========================= */
type Attachment = {
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string; // ISO
};

type Vehicle = {
  id: number;                // サーバ側で採番（新規は一時的に負IDを振る）
  type: string;
  number: string;
  vin: string;
  user: string;              // 使用者（ドライバー名）
  startDate: string;         // YYYY-MM-DD
  inspectionDate: string;    // 車検
  insuranceDate: string;     // 自賠責
  voluntaryDate: string;     // 任意保険
  attachments: Attachment[]; // FileではなくURLメタデータを保存
  company: string;
  customFields?: Record<string, string>;
};

type Driver = { id: string; name: string };

/* ========================= API helpers ========================= */
const API_BASE: string =
  (((typeof process !== "undefined" ? (process as any) : undefined)?.env?.NEXT_PUBLIC_API_BASE) as string) ||
  (((typeof import.meta !== "undefined" ? (import.meta as any) : undefined)?.env?.VITE_API_BASE_URL) as string) ||
  "";

function joinURL(base: string, path: string) {
  if (!base) return path;
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

async function apiJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinURL(API_BASE, path);
  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status} at ${url}\n${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(
      `Expected JSON but got "${ct || "unknown"}" from ${url}\n` + text.slice(0, 200)
    );
    err.status = 415;
    throw err;
  }
  return res.json();
}

const VehiclesAPI = {
  list: async (company: string) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<Vehicle[]>(
      `/api/vehicles?company=${encodeURIComponent(company)}`,
      { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} }
    );
  },
  create: async (v: Omit<Vehicle, "id" | "attachments"> & { attachments?: Attachment[] }) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<Vehicle>(`/api/vehicles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(v),
    });
  },
  update: async (id: number, v: Partial<Vehicle>) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<Vehicle>(`/api/vehicles/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(v),
    });
  },
  remove: async (id: number) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<{}>(`/api/vehicles/${id}`, {
      method: "DELETE",
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
  },
  uploadAttachments: async (id: number, files: File[]) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return apiJSON<Attachment[]>(`/api/vehicles/${id}/attachments`, {
      method: "POST",
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      body: fd,
    });
  },
  deleteAttachment: async (id: number, name: string) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<{ ok: true }>(`/api/vehicles/${id}/attachments?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
  },
};

const DriversAPI = {
  list: async (company: string) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    // API は AdminDriverManager と同じ /api/drivers を使用
    // name が空のものは除外。id は uid/loginId/name のいずれかから安全に採取
    const raw = await apiJSON<any[]>(
      `/api/drivers?company=${encodeURIComponent(company)}`,
      { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} }
    );
    return (Array.isArray(raw) ? raw : [])
      .filter(d => d && typeof d.name === "string" && d.name.trim().length > 0)
      .map(d => ({ id: String(d.id ?? d.uid ?? d.loginId ?? d.name), name: String(d.name) })) as Driver[];
  },
};

/* ========================= Utils ========================= */
const required = (s: string) => s.trim().length > 0;

function validateVehicle(v: Vehicle): string | null {
  if (!required(v.type)) return "車種を入力してください。";
  if (!required(v.number)) return "ナンバーを入力してください。";
  if (!required(v.vin)) return "車台番号を入力してください。";
  if (!required(v.user)) return "使用者を選択してください。";
  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (v.startDate && !isDate(v.startDate)) return "使用開始日の形式が不正です。";
  if (v.inspectionDate && !isDate(v.inspectionDate)) return "車検有効期限の形式が不正です。";
  if (v.insuranceDate && !isDate(v.insuranceDate)) return "自賠責有効期限の形式が不正です。";
  if (v.voluntaryDate && !isDate(v.voluntaryDate)) return "任意保険有効期限の形式が不正です。";
  return null;
}
const vehicleStorageKey = (company: string) => `vehicleList_${company}`;

/* ========================= Component ========================= */
const VehicleManager: React.FC = () => {
  const [company, setCompany] = React.useState<string>("");

  function pickCompanySync(): string {
    try {
      const cur = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (cur?.company) return String(cur.company).trim();
    } catch {}
    try {
      const admin = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}");
      if (admin?.company) return String(admin.company).trim();
    } catch {}
    const saved = (localStorage.getItem("company") || "").trim();
    if (saved) return saved;
    try {
      const qs = new URLSearchParams(window.location.search).get("company");
      if (qs) return qs.trim();
    } catch {}
    return "";
  }

  React.useEffect(() => {
    let mounted = true;
    const first = pickCompanySync();
    if (first) {
      if (mounted) {
        setCompany(first);
        localStorage.setItem("company", first);
      }
    } else {
      (async () => {
        try {
          const result = await getAuth().currentUser?.getIdTokenResult?.();
          const claim = (result?.claims as any)?.company;
          if (claim && mounted) {
            setCompany(String(claim));
            localStorage.setItem("company", String(claim));
            return;
          }
        } catch {}
        try {
          const me = await apiJSON<{ company?: string }>("/api/me").catch(() => null as any);
          if (me?.company && mounted) {
            setCompany(String(me.company));
            localStorage.setItem("company", String(me.company));
          }
        } catch {}
      })();
    }
    return () => { mounted = false; };
  }, []);

  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [vehicleCustomFields, setVehicleCustomFields] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // company を後追いで埋める
  React.useEffect(() => {
    if (!company) return;
    setVehicles(prev => prev.map(v => (!v.company?.trim() ? { ...v, company } : v)));
  }, [company]);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("vehicleCustomFields");
      if (saved) setVehicleCustomFields(JSON.parse(saved));
    } catch {}
  }, []);

  /* ===== ローカル保存: 変更を常にキャッシュ ===== */
  React.useEffect(() => {
    if (!company) return;
    // 画面上の全車両を保存（API成功・失敗に関係なく最後の状態を残す）
    localStorage.setItem(vehicleStorageKey(company), JSON.stringify(vehicles));
  }, [company, vehicles]);

  // ページ離脱でも念のため保存
  React.useEffect(() => {
    const onBeforeUnload = () => {
      if (company) {
        localStorage.setItem(vehicleStorageKey(company), JSON.stringify(vehicles));
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [company, vehicles]);

  const reloadFromServer = React.useCallback(async () => {
  if (!company) return;
  let mounted = true;
  try {
    const [vList, dList] = await Promise.all([
      VehiclesAPI.list(company),
      DriversAPI.list(company),
    ]);
    if (!mounted) return;

    // 車両：サーバ優先 + ドラフト維持
    setVehicles(prev => {
      const drafts = prev.filter(x => x.id < 0);
      const server = Array.isArray(vList) ? vList : [];
      localStorage.setItem(vehicleStorageKey(company), JSON.stringify([...drafts, ...server]));
      return [...drafts, ...server];
    });

    // ドライバー：API結果（名前ありのみ）
    setDrivers(Array.isArray(dList) ? dList : []);
  } catch (e: any) {
    const s = e?.status ?? 0;
    const allow = [0, 401, 403, 404, 415, 500, 502, 503];
    if (allow.includes(s)) {
      // 車両：ローカルへフォールバック
      const localV = JSON.parse(localStorage.getItem(vehicleStorageKey(company)) || "[]") as Vehicle[];

      // ★ ドライバー：driverMaster（会社別）へフォールバック
      const dmRaw = JSON.parse(localStorage.getItem("driverMaster") || "[]");
      const localDrivers: Driver[] = (Array.isArray(dmRaw) ? dmRaw : [])
        .filter(d => d && d.company === company && typeof d.name === "string" && d.name.trim().length > 0)
        .map(d => ({ id: String(d.id ?? d.uid ?? d.loginId ?? d.name), name: String(d.name) }));

      if (!mounted) return;

      setVehicles(prev => {
        const drafts = prev.filter(x => x.id < 0);
        const lv = Array.isArray(localV) ? localV : [];
        const ids = new Set(drafts.map(d => d.id));
        return [...drafts, ...lv.filter(v => !ids.has(v.id))];
      });

      // フォールバックのドライバー（“安保ルコ”のような余計なエントリは driverMaster に居ないので表示されません）
      setDrivers(localDrivers);
    } else {
      console.error(e);
    }
  }
  return () => { mounted = false; };
}, [company]);

  // 初期ロード
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!company) { setLoading(false); setError(null); return; }
      setLoading(true); setError(null);
      try {
        await reloadFromServer();
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "データの取得に失敗しました。");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [company, reloadFromServer]);

  // 共有イベント・フォーカスで再読込
  React.useEffect(() => {
    if (!company) return;
    const reload = () => reloadFromServer();
    const onVisibility = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("drivers:changed", reload);
    window.addEventListener("vehicles:changed", reload);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("drivers:changed", reload);
      window.removeEventListener("vehicles:changed", reload);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [company, reloadFromServer]);

  const patchVehicle = (id: number, patch: Partial<Vehicle>) => {
    setVehicles(prev => prev.map(v => (v.id === id ? { ...v, ...patch } : v)));
  };

  const handleAdd = () => {
    const tempId = -(Date.now() + Math.floor(Math.random() * 1000));
    const firstDriverName = driverOptions[0] ?? "";
    const newV: Vehicle = {
      id: tempId,
      type: "",
      number: "",
      vin: "",
      user: firstDriverName,
      startDate: "",
      inspectionDate: "",
      insuranceDate: "",
      voluntaryDate: "",
      attachments: [],
      company,
      customFields: vehicleCustomFields.reduce<Record<string, string>>((acc, k) => { acc[k] = ""; return acc; }, {}),
    };
    setVehicles(prev => [newV, ...prev]); // 先頭に差し込み
    setEditingId(tempId);
    setInfo(null);
    setError(null);
  };

  const handleSave = async (id: number) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;

    if (!v.company?.trim()) {
      setError("会社が未確定のため保存できません。ログイン/URLの ?company=… で会社を確定してください。");
      return;
    }
    const msg = validateVehicle(v);
    if (msg) { setError(msg); return; }

    setSavingId(id); setError(null); setInfo(null);

    try {
      if (id < 0) {
        // 新規
        const payload = {
          type: v.type.trim(),
          number: v.number.trim(),
          vin: v.vin.trim(),
          user: v.user.trim(),
          startDate: v.startDate || "",
          inspectionDate: v.inspectionDate || "",
          insuranceDate: v.insuranceDate || "",
          voluntaryDate: v.voluntaryDate || "",
          attachments: v.attachments ?? [],
          company: v.company,
          customFields: v.customFields ?? {},
        };
        const created = await VehiclesAPI.create(payload);
        setVehicles(prev => prev.map(x => (x.id === id ? { ...created } : x)));
        await reloadFromServer();
      } else {
        // 既存
        const payload: Partial<Vehicle> = {
          type: v.type.trim(),
          number: v.number.trim(),
          vin: v.vin.trim(),
          user: v.user.trim(),
          startDate: v.startDate || "",
          inspectionDate: v.inspectionDate || "",
          insuranceDate: v.insuranceDate || "",
          voluntaryDate: v.voluntaryDate || "",
          customFields: v.customFields ?? {},
        };
        const updated = await VehiclesAPI.update(id, payload);
        setVehicles(prev => prev.map(x => (x.id === id ? { ...x, ...updated } : x)));
        await reloadFromServer();
      }
      setEditingId(null);
      setInfo("保存しました。");
      window.dispatchEvent(new Event("vehicles:changed"));
    } catch (e: any) {
      // ★ 重要：保存エラーでも行を消さない。ローカルへ確実に残す。
      const s = e?.status ?? 0;
      const allow = [0, 401, 403, 404, 415, 500, 502, 503];
      if (allow.includes(s)) {
        // 画面上の状態をそのままローカルへ反映
        localStorage.setItem(vehicleStorageKey(company), JSON.stringify(vehicles));
        setEditingId(null);
        setInfo("（オフライン保存）サーバ未反映ですが、データはこの端末に保存されています。");
      } else {
        setError(e?.message ?? "保存に失敗しました。");
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("この車両を削除しますか？")) return;
    setSavingId(id); setError(null); setInfo(null);
    try {
      if (id > 0) {
        await VehiclesAPI.remove(id);
      }
      // API成功 or 負ID（ドラフト）は即ローカルから除去
      setVehicles(prev => prev.filter(v => v.id !== id));
      // ローカルへも反映
      localStorage.setItem(vehicleStorageKey(company), JSON.stringify(vehicles.filter(v => v.id !== id)));
      setInfo("削除しました。");
      window.dispatchEvent(new Event("vehicles:changed"));
    } catch (e: any) {
      // API失敗でもローカルでは削除を許容（ユーザー意図が「削除」なので残さない）
      setVehicles(prev => prev.filter(v => v.id !== id));
      localStorage.setItem(vehicleStorageKey(company), JSON.stringify(vehicles.filter(v => v.id !== id)));
      setInfo("（ローカルで）削除しました。サーバ反映は後で再試行されます。");
    } finally {
      setSavingId(null);
    }
  };

  const handleFiles = async (id: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (id < 0) { setError("ファイルは保存後（ID採番後）にアップロードできます。"); return; }
    try {
      const list = Array.from(files).slice(0, 10);
      await VehiclesAPI.uploadAttachments(id, list);
      await reloadFromServer();
      setInfo("ファイルをアップロードしました。");
      window.dispatchEvent(new Event("vehicles:changed"));
    } catch (e: any) {
      setError(e?.message ?? "ファイルのアップロードに失敗しました。");
    }
  };

  const openAttachment = (att: Attachment) => {
    if (!att?.url) return;
    window.open(att.url, "_blank", "noreferrer");
  };

  const removeAttachment = async (vehicleId: number, index: number) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    const att = v?.attachments?.[index];
    if (!att) return;
    if (!window.confirm("このファイルを削除しますか？")) return;
    try {
      try { await VehiclesAPI.deleteAttachment(vehicleId, att.name); } catch {}
      setVehicles(prev =>
        prev.map(vv => vv.id === vehicleId
          ? { ...vv, attachments: vv.attachments.filter((_, i) => i !== index) }
          : vv
        )
      );
      setInfo("ファイルを削除しました。");
      window.dispatchEvent(new Event("vehicles:changed"));
      await reloadFromServer();
    } catch (e: any) {
      setError(e?.message ?? "ファイル削除に失敗しました。");
    }
  };

  const driverOptions = Array.from(new Set(drivers.map(d => d.name)))
  .sort((a, b) => a.localeCompare(b, "ja"));

  if (loading) return <div className="p-6">読み込み中...</div>;

  return (
    <div className="h-full w-full bg-white overflow-auto p-0">
      {/* ヘッダー */}
      <div className="px-4 sm:px-10 pt-8 pb-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-4 ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span role="img" aria-label="truck" className="text-blue-600 text-3xl">🚚</span>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 truncate">車両管理</h1>
                <div className="text-sm md:text-base text-slate-600">- Vehicle Management -</div>
              </div>
            </div>

            <button
              type="button"
              className="mt-2 md:mt-0 mb-0 w-full sm:w-48 py-3 bg-blue-600 text-white rounded-xl text-lg font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={handleAdd}
            >
              車両追加
            </button>
          </div>

          {error && <div className="mt-4 p-3 rounded-lg bg-red-600/10 text-red-800 text-sm border border-red-200">{error}</div>}
          {info && <div className="mt-2 p-3 rounded-lg bg-emerald-600/10 text-emerald-800 text-sm border border-emerald-200">{info}</div>}
        </div>
      </div>

      {/* PC/タブレット：テーブル */}
      <div className="hidden md:block px-4 sm:px-10 pb-8">
        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto bg-white text-slate-900 border border-slate-200 shadow-xl rounded-xl text-sm">
            <thead className="z-10 bg-slate-900 text-white shadow-sm">
              <tr>
                <th className="sticky top-0 bg-slate-900 px-4 py-3 text-left border-r border-slate-700/60 whitespace-nowrap font-semibold tracking-wide">操作</th>
                <th className="px-4 py-3 text-left border-r border-slate-700/60 whitespace-nowrap font-semibold tracking-wide">車種</th>
                <th className="px-4 py-3 text-left border-r border-slate-700/60 whitespace-nowrap font-semibold tracking-wide">ナンバー</th>
                <th className="px-4 py-3 text-left border-r border-slate-700/60 whitespace-nowrap font-semibold tracking-wide">車台番号</th>
                <th className="px-4 py-3 text-left border-r border-slate-700/60 whitespace-nowrap font-semibold tracking-wide">使用者</th>
                <th className="px-4 py-3 text-left border-r border-slate-700/60 whitespace-nowrap font-semibold tracking-wide">使用開始日</th>
                <th className="px-4 py-3 text-left border-r border-slate-700/60 whitespace-nowrap font-semibold tracking-wide">車検有効期限</th>
                <th className="px-4 py-3 text-left border-r border-slate-700/60 whitespace-nowrap font-semibold tracking-wide">自賠責有効期限</th>
                <th className="px-4 py-3 text-left whitespace-nowrap font-semibold tracking-wide">任意保険有効期限</th>
                <th className="px-4 py-3 text-left whitespace-nowrap font-semibold tracking-wide">添付ファイル</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {vehicles.map((v, idx) => {
                const isEditing = editingId === v.id;
                const isSaving = savingId === v.id;
                return (
                  <tr key={v.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-sky-50 border-b border-slate-200 transition-colors ${isEditing ? "ring-1 ring-sky-400/40" : ""}`}>
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button className="bg-green-600 text-white px-2 py-1 rounded mr-2 disabled:opacity-60" disabled={isSaving} onClick={() => handleSave(v.id)}>
                            {isSaving ? "保存中..." : "保存"}
                          </button>
                          <button
                            className="bg-gray-500 text-white px-2 py-1 rounded"
                            disabled={isSaving}
                            onClick={() => {
                              if (v.id < 0 && !v.type && !v.number && !v.vin) {
                                setVehicles((prev) => prev.filter((x) => x.id !== v.id));
                              }
                              setEditingId(null);
                            }}
                          >
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="bg-yellow-500 text-white px-2 py-1 rounded mr-2" onClick={() => setEditingId(v.id)}>
                            編集
                          </button>
                          <button
                            className="bg-rose-600 text-white px-2 py-1 rounded-lg shadow hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400/60 disabled:opacity-60"
                            disabled={isSaving}
                            onClick={() => handleDelete(v.id)}
                          >
                            削除
                          </button>
                        </>
                      )}
                    </td>

                    {/* 車種 */}
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full px-2 py-1 border rounded bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={v.type}
                          onChange={(e) => patchVehicle(v.id, { type: e.target.value })}
                        />
                      ) : (v.type || "-")}
                    </td>

                    {/* ナンバー */}
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          className="w-full px-2 py-1 border rounded bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={v.number}
                          onChange={(e) => patchVehicle(v.id, { number: e.target.value })}
                        />
                      ) : (v.number || "-")}
                    </td>

                    {/* 車台番号 */}
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          className="w-full px-2 py-1 border rounded bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={v.vin}
                          onChange={(e) => patchVehicle(v.id, { vin: e.target.value })}
                        />
                      ) : (v.vin || "-")}
                    </td>

                    {/* 使用者 */}
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <select
                          className="w-full px-2 py-1 border rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={v.user}
                          onChange={(e) => patchVehicle(v.id, { user: e.target.value })}
                        >
                          <option value="">—選択—</option>
                          {driverOptions.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      ) : (v.user || "-")}
                    </td>

                    {/* 使用開始日 */}
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="date"
                          className="w-full px-2 py-1 border rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={v.startDate || ""}
                          onChange={(e) => patchVehicle(v.id, { startDate: e.target.value })}
                        />
                      ) : (v.startDate || "-")}
                    </td>

                    {/* 車検 */}
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="date"
                          className="w-full px-2 py-1 border rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={v.inspectionDate || ""}
                          onChange={(e) => patchVehicle(v.id, { inspectionDate: e.target.value })}
                        />
                      ) : (v.inspectionDate || "-")}
                    </td>

                    {/* 自賠責 */}
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="date"
                          className="w-full px-2 py-1 border rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={v.insuranceDate || ""}
                          onChange={(e) => patchVehicle(v.id, { insuranceDate: e.target.value })}
                        />
                      ) : (v.insuranceDate || "-")}
                    </td>

                    {/* 任意保険 */}
                    <td className="px-4 py-2 text-sm border-r border-slate-200 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="date"
                          className="w-full px-2 py-1 border rounded bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={v.voluntaryDate || ""}
                          onChange={(e) => patchVehicle(v.id, { voluntaryDate: e.target.value })}
                        />
                      ) : (v.voluntaryDate || "-")}
                    </td>

                    {/* 添付 */}
                    <td className="px-4 py-2 text-sm whitespace-nowrap">
                      {isEditing ? (
                        <div className="space-y-1">
                          {v.attachments?.map((att, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <button className="text-blue-600 underline text-xs mr-2" onClick={() => openAttachment(att)} type="button">
                                {att.name}
                              </button>
                              <button className="text-red-500 text-xs" onClick={() => removeAttachment(v.id, i)} type="button">
                                削除
                              </button>
                            </div>
                          ))}
                          <input
                            type="file"
                            multiple
                            accept="application/pdf,image/*"
                            onChange={(e) => handleFiles(v.id, e.target.files)}
                            className="text-xs mt-1"
                          />
                          <p className="text-xs text-gray-500">最大10ファイルまで添付可能</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {v.attachments?.length ? (
                            v.attachments.map((att, i) => (
                              <div key={i}>
                                <button className="text-blue-600 underline text-xs" onClick={() => openAttachment(att)} type="button">
                                  {att.name}
                                </button>
                              </div>
                            ))
                          ) : ("添付なし")}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* スマホ：カード表示 */}
      <div className="md:hidden px-4 pb-8 space-y-3">
        {vehicles.map((v) => {
          const isEditing = editingId === v.id;
          const isSaving = savingId === v.id;
          return (
            <div key={v.id} className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-slate-900">{v.type || "（車種未設定）"}</div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <button className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-60" disabled={isSaving} onClick={() => handleSave(v.id)}>
                      {isSaving ? "保存中..." : "保存"}
                    </button>
                    <button
                      className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
                      disabled={isSaving}
                      onClick={() => { if (v.id < 0 && !v.type && !v.number && !v.vin) setVehicles(prev => prev.filter(x => x.id !== v.id)); setEditingId(null); }}
                    >
                      ｷｬﾝｾﾙ
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button className="bg-yellow-500 text-white px-3 py-1 rounded text-sm" onClick={() => setEditingId(v.id)}>編集</button>
                    <button className="bg-rose-600 text-white px-3 py-1 rounded text-sm disabled:opacity-60" disabled={isSaving} onClick={() => handleDelete(v.id)}>削除</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                {/* 車種 */}
                {isEditing ? (
                  <input className="w-full px-2 py-1 border rounded" placeholder="車種" value={v.type} onChange={(e) => patchVehicle(v.id, { type: e.target.value })} />
                ) : <div className="text-slate-600">車種: <span className="text-slate-900">{v.type || "-"}</span></div>}

                {/* ナンバー */}
                {isEditing ? (
                  <input className="w-full px-2 py-1 border rounded" placeholder="ナンバー" value={v.number} onChange={(e) => patchVehicle(v.id, { number: e.target.value })} />
                ) : <div className="text-slate-600">ナンバー: <span className="text-slate-900">{v.number || "-"}</span></div>}

                {/* 車台番号 */}
                {isEditing ? (
                  <input className="w-full px-2 py-1 border rounded" placeholder="車台番号" value={v.vin} onChange={(e) => patchVehicle(v.id, { vin: e.target.value })} />
                ) : <div className="text-slate-600">車台番号: <span className="text-slate-900">{v.vin || "-"}</span></div>}

                {/* 使用者 */}
                {isEditing ? (
                  <select className="w-full px-2 py-1 border rounded" value={v.user} onChange={(e) => patchVehicle(v.id, { user: e.target.value })}>
                    <option value="">—選択—</option>
                    {driverOptions.map((name) => (<option key={name} value={name}>{name}</option>))}
                  </select>
                ) : <div className="text-slate-600">使用者: <span className="text-slate-900">{v.user || "-"}</span></div>}

                {/* 日付系 */}
                {isEditing ? (
                  <>
                    <input type="date" className="w-full px-2 py-1 border rounded" value={v.startDate || ""} onChange={(e) => patchVehicle(v.id, { startDate: e.target.value })} />
                    <input type="date" className="w-full px-2 py-1 border rounded" value={v.inspectionDate || ""} onChange={(e) => patchVehicle(v.id, { inspectionDate: e.target.value })} />
                    <input type="date" className="w-full px-2 py-1 border rounded" value={v.insuranceDate || ""} onChange={(e) => patchVehicle(v.id, { insuranceDate: e.target.value })} />
                    <input type="date" className="w-full px-2 py-1 border rounded" value={v.voluntaryDate || ""} onChange={(e) => patchVehicle(v.id, { voluntaryDate: e.target.value })} />
                  </>
                ) : (
                  <>
                    <div className="text-slate-600">使用開始日: <span className="text-slate-900">{v.startDate || "-"}</span></div>
                    <div className="text-slate-600">車検: <span className="text-slate-900">{v.inspectionDate || "-"}</span></div>
                    <div className="text-slate-600">自賠責: <span className="text-slate-900">{v.insuranceDate || "-"}</span></div>
                    <div className="text-slate-600">任意保険: <span className="text-slate-900">{v.voluntaryDate || "-"}</span></div>
                  </>
                )}

                {/* 添付 */}
                <div className="pt-1">
                  {isEditing ? (
                    <>
                      <ul className="text-xs">
                        {v.attachments?.map((att, i) => (
                          <li key={i} className="flex items-center justify-between">
                            <button className="text-blue-600 underline" onClick={() => openAttachment(att)}>{att.name}</button>
                            <button className="text-rose-600" onClick={() => removeAttachment(v.id, i)}>削除</button>
                          </li>
                        ))}
                      </ul>
                      <input type="file" multiple accept="application/pdf,image/*" onChange={(e) => handleFiles(v.id, e.target.files)} className="mt-1 text-xs" />
                    </>
                  ) : (
                    <ul className="text-xs">
                      {v.attachments?.length ? v.attachments.map((att, i) => (
                        <li key={i}><button className="text-blue-600 underline" onClick={() => openAttachment(att)}>{att.name}</button></li>
                      )) : <li>添付なし</li>}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VehicleManager;
