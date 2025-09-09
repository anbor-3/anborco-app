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

/* ========================= API helpers（差し替え版） =========================
   .env で API ベース URL を切り替えできます。
   - Vite:           VITE_API_BASE_URL=https://api.example.com
   - Next.js (App):  NEXT_PUBLIC_API_BASE=https://api.example.com
   未設定なら空文字で同一オリジンの相対パスを叩きます。
============================================================================= */

const API_BASE: string =
  // Next.js
  (((typeof process !== "undefined" ? (process as any) : undefined)?.env?.NEXT_PUBLIC_API_BASE) as string) ||
  // Vite
  (((typeof import.meta !== "undefined" ? (import.meta as any) : undefined)?.env?.VITE_API_BASE_URL) as string) ||
  "";

/** base と path を安全に結合（スラッシュ重複/欠落を吸収） */
function joinURL(base: string, path: string) {
  if (!base) return path; // base 未設定なら相対パスのまま
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

/** JSON フェッチ（404 のとき status を載せて投げる） */
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

  // ★ JSON以外（例: index.html）が返ってきたら即エラー化
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(
      `Expected JSON but got "${ct || "unknown"}" from ${url}\n` + text.slice(0, 200)
    );
    err.status = 415; // 非JSON検出の合図として 415 を使用
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

  /** 任意: サーバ側が対応していれば利用（存在しない場合はクライアント更新にフォールバック） */
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
    return apiJSON<Driver[]>(
      `/api/drivers?company=${encodeURIComponent(company)}`,
      { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} }
    );
  },
};

/* ========================= Utils ========================= */

const required = (s: string) => s.trim().length > 0;

function validateVehicle(v: Vehicle): string | null {
  if (!required(v.type)) return "車種を入力してください。";
  if (!required(v.number)) return "ナンバーを入力してください。";
  if (!required(v.vin)) return "車台番号を入力してください。";
  if (!required(v.user)) return "使用者を選択してください。";

  // YYYY-MM-DD 形式のざっくりチェック
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
  // ▼ company を state 化し、できる限り多くのソースから解決
  const [company, setCompany] = React.useState<string>("");

  // 同期的にとれるものは即時トライ
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
    // まずは同期的な候補
    const first = pickCompanySync();
    if (first) {
      setCompany(first);
      localStorage.setItem("company", first);
      return;
    }

    // 非同期の候補（Firebase クレーム / /api/me）
    (async () => {
      try {
        const result = await getAuth().currentUser?.getIdTokenResult?.();
        const claim = (result?.claims as any)?.company;
        if (claim) {
          setCompany(String(claim));
          localStorage.setItem("company", String(claim));
          return;
        }
      } catch {}

      try {
        // 任意: /api/me がある場合のみ
        const me = await apiJSON<{ company?: string }>("/api/me").catch(() => null as any);
        if (me?.company) {
          setCompany(String(me.company));
          localStorage.setItem("company", String(me.company));
          return;
        }
      } catch {}
    })();
  }, []);

  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [vehicleCustomFields, setVehicleCustomFields] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!company) return;
    setVehicles(prev =>
      prev.map(v => (!v.company?.trim() ? { ...v, company } : v))
    );
  }, [company]);

  // カスタム項目はとりあえずローカルで管理（要件次第ではAPI化）
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("vehicleCustomFields");
      if (saved) setVehicleCustomFields(JSON.parse(saved));
    } catch {}
  }, []);

  /** ===== 共通：サーバから最新を再取得（会社スコープで共有） ===== */
  const reloadFromServer = React.useCallback(async () => {
    if (!company) return;
    try {
      const [vList, dList] = await Promise.all([
        VehiclesAPI.list(company),
        DriversAPI.list(company),
      ]);
      setVehicles(prev => {
        const drafts = prev.filter(x => x.id < 0);
        return [...drafts, ...(vList ?? [])];
      });
      setDrivers(dList ?? []);
    } catch (e: any) {
      const s = e?.status ?? 0;
      if ([0, 401, 403, 404, 415, 500, 502, 503].includes(s)) {
        const localV = JSON.parse(localStorage.getItem(vehicleStorageKey(company)) || "[]") as Vehicle[];
        const s1 = localStorage.getItem(`driverList_${company}`);
        const s2 = localStorage.getItem("driverList");
        const localDRaw = JSON.parse(s1 || s2 || "[]") as Array<{ id?: string; name?: string }>;
        setVehicles(prev => {
          const drafts = prev.filter(x => x.id < 0);
          const lv = Array.isArray(localV) ? localV : [];
          return [...drafts, ...lv];
        });
        setDrivers(
          Array.isArray(localDRaw)
            ? localDRaw.filter(x => x && x.name).map((x, i) => ({ id: x.id ?? String(i + 1), name: x.name! }))
            : []
        );
      } else {
        console.error(e);
      }
    }
  }, [company]);

  // 初期ロード
  React.useEffect(() => {
    let aborted = false;
    (async () => {
      if (!company) {
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await reloadFromServer();
      } catch (e: any) {
        if (!aborted) setError(e?.message ?? "データの取得に失敗しました。");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [company, reloadFromServer]);

  // 共有イベント・フォーカスで再読込（他端末の更新を取り込む）
  React.useEffect(() => {
    if (!company) return;
    const reload = () => reloadFromServer();

    const onVisibility = () => {
      if (document.visibilityState === "visible") reload();
    };

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

  // 行の編集用に、表示値を直接 state に持たせる（簡易版）
  const patchVehicle = (id: number, patch: Partial<Vehicle>) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
    );
  };

  const handleAdd = () => {
    if (!company) {
      console.warn("company is empty; creating a draft row anyway.");
    }
    const tempId = -(Date.now() + Math.floor(Math.random() * 1000));
    const firstDriverName = drivers[0]?.name ?? "";
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
      customFields: vehicleCustomFields.reduce<Record<string, string>>((acc, k) => {
        acc[k] = "";
        return acc;
      }, {}),
    };
    // 先頭に差し込み（要件に応じて末尾などに変えられます）
    setVehicles((prev) => [newV, ...prev]);
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

    setSavingId(id);
    setError(null);
    setInfo(null);

    try {
      if (id < 0) {
        // 新規作成
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
        // 一旦楽観反映 → 直後にサーバから再取得（ID採番や補正を取り込む）
        setVehicles((prev) => prev.map((x) => (x.id === id ? { ...created } : x)));
        await reloadFromServer();
      } else {
        // 既存更新
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
        setVehicles((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)));
        await reloadFromServer();
      }
      setEditingId(null);
      setInfo("保存しました。");
      window.dispatchEvent(new Event("vehicles:changed"));
    } catch (e: any) {
      if (e?.status === 404) {
        // ◆ ローカル保存で代替：新規は負IDを正に、既存は上書き
        const current = vehicles.find((x) => x.id === id)!;
        const normalizedId = id < 0 ? Math.abs(id) : id;
        const next = vehicles.map((x) =>
          x.id === id ? { ...current, id: normalizedId } : x
        );
        localStorage.setItem(vehicleStorageKey(company), JSON.stringify(next));
        setVehicles(next);
        setEditingId(null);
        setInfo("（ローカルに）保存しました。");
      } else {
        setError(e?.message ?? "保存に失敗しました。");
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;

    if (!window.confirm("本当に削除しますか？")) return;

    try {
      if (id > 0) {
        await VehiclesAPI.remove(id);
      }
      setVehicles((prev) => {
        const next = prev.filter((x) => x.id !== id);
        localStorage.setItem(vehicleStorageKey(company), JSON.stringify(next));
        return next;
      });
      setInfo("削除しました。");
      window.dispatchEvent(new Event("vehicles:changed"));
      await reloadFromServer(); // ← 他端末の同期も意識して最新化
    } catch (e: any) {
      if (e?.status === 404) {
        setVehicles((prev) => {
          const next = prev.filter((x) => x.id !== id);
          localStorage.setItem(vehicleStorageKey(company), JSON.stringify(next));
          return next;
        });
        setInfo("（ローカルで）削除しました。");
      } else {
        setError(e?.message ?? "削除に失敗しました。");
      }
    }
  };

  const handleFiles = async (id: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (id < 0) {
      setError("ファイルは保存後（ID採番後）にアップロードできます。先に「保存」してください。");
      return;
    }
    try {
      const list = Array.from(files).slice(0, 10);
      await VehiclesAPI.uploadAttachments(id, list);
      await reloadFromServer(); // ← サーバが付与するURL/メタデータを取り込み直す
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
      // サーバAPIがあるなら先にサーバ削除（存在しない場合は 404 などでフォールバック）
      try {
        await VehiclesAPI.deleteAttachment(vehicleId, att.name);
      } catch {}

      // クライアント側も更新
      setVehicles((prev) =>
        prev.map((vv) =>
          vv.id === vehicleId
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

  const driverOptions = drivers.map((d) => d.name);

  if (loading) return <div className="p-6">読み込み中...</div>;

  return (
    <div className="absolute top-16 left-60 right-0 bottom-0 bg-white px-8 py-6 overflow-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <span role="img" aria-label="truck" className="text-blue-600 text-3xl mr-2">🚚</span>
        車両管理 <span className="text-sm text-gray-500 ml-2">-Vehicle Management-</span>
      </h2>

      {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
      {info && <div className="mb-4 p-3 rounded bg-green-50 text-green-700 text-sm">{info}</div>}

      <button
        type="button"
        className="mb-6 w-48 py-3 bg-blue-600 text-white rounded text-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
        onClick={handleAdd}
      >
        車両追加
      </button>

      <div className="w-full flex-1 overflow-auto">
        <table className="w-full table-auto border border-gray-300 shadow rounded-lg text-sm">
          <thead className="bg-blue-100 text-gray-800 border-b border-gray-400">
            <tr>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">操作</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">車種</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">ナンバー</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">車台番号</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">使用者</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">使用開始日</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">車検有効期限</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">自賠責有効期限</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">任意保険有効期限</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">添付ファイル</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {vehicles.map((v, idx) => {
              const isEditing = editingId === v.id;
              const isSaving = savingId === v.id;
              return (
                <tr
                  key={v.id}
                  className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 border-b border-gray-200`}
                >
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button
                          className="bg-green-600 text-white px-2 py-1 rounded mr-2 disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() => handleSave(v.id)}
                        >
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
                        <button
                          className="bg-yellow-500 text-white px-2 py-1 rounded mr-2"
                          onClick={() => setEditingId(v.id)}
                        >
                          編集
                        </button>
                        <button
                          className="bg-red-600 text-white px-2 py-1 rounded disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() => handleDelete(v.id)}
                        >
                          削除
                        </button>
                      </>
                    )}
                  </td>

                  {/* 車種 */}
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        autoFocus
                        className="w-full px-2 py-1 border rounded"
                        value={v.type}
                        onChange={(e) => patchVehicle(v.id, { type: e.target.value })}
                      />
                    ) : (
                      v.type || "-"
                    )}
                  </td>

                  {/* ナンバー */}
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        className="w-full px-2 py-1 border rounded"
                        value={v.number}
                        onChange={(e) => patchVehicle(v.id, { number: e.target.value })}
                      />
                    ) : (
                      v.number || "-"
                    )}
                  </td>

                  {/* 車台番号 */}
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        className="w-full px-2 py-1 border rounded"
                        value={v.vin}
                        onChange={(e) => patchVehicle(v.id, { vin: e.target.value })}
                      />
                    ) : (
                      v.vin || "-"
                    )}
                  </td>

                  {/* 使用者 */}
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <select
                        className="w-full px-2 py-1 border rounded"
                        value={v.user}
                        onChange={(e) => patchVehicle(v.id, { user: e.target.value })}
                      >
                        <option value="">—選択—</option>
                        {driverOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      v.user || "-"
                    )}
                  </td>

                  {/* 使用開始日 */}
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="date"
                        className="w-full px-2 py-1 border rounded"
                        value={v.startDate || ""}
                        onChange={(e) => patchVehicle(v.id, { startDate: e.target.value })}
                      />
                    ) : (
                      v.startDate || "-"
                    )}
                  </td>

                  {/* 車検 */}
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="date"
                        className="w-full px-2 py-1 border rounded"
                        value={v.inspectionDate || ""}
                        onChange={(e) => patchVehicle(v.id, { inspectionDate: e.target.value })}
                      />
                    ) : (
                      v.inspectionDate || "-"
                    )}
                  </td>

                  {/* 自賠責 */}
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="date"
                        className="w-full px-2 py-1 border rounded"
                        value={v.insuranceDate || ""}
                        onChange={(e) => patchVehicle(v.id, { insuranceDate: e.target.value })}
                      />
                    ) : (
                      v.insuranceDate || "-"
                    )}
                  </td>

                  {/* 任意保険 */}
                  <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="date"
                        className="w-full px-2 py-1 border rounded"
                        value={v.voluntaryDate || ""}
                        onChange={(e) => patchVehicle(v.id, { voluntaryDate: e.target.value })}
                      />
                    ) : (
                      v.voluntaryDate || "-"
                    )}
                  </td>

                  {/* 添付 */}
                  <td className="px-4 py-2 text-sm whitespace-nowrap">
                    {isEditing ? (
                      <div className="space-y-1">
                        {v.attachments?.map((att, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <button
                              className="text-blue-600 underline text-xs mr-2"
                              onClick={() => openAttachment(att)}
                              type="button"
                            >
                              {att.name}
                            </button>
                            <button
                              className="text-red-500 text-xs"
                              onClick={() => removeAttachment(v.id, i)}
                              type="button"
                            >
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
                              <button
                                className="text-blue-600 underline text-xs"
                                onClick={() => openAttachment(att)}
                                type="button"
                              >
                                {att.name}
                              </button>
                            </div>
                          ))
                        ) : (
                          "添付なし"
                        )}
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
  );
};

export default VehicleManager;
