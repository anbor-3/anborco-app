"use client";
import React from "react";

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

/* ========================= API helpers =========================
   ※ エンドポイントはプロジェクトに合わせて調整してください。
   - vehicles:
       GET  /api/vehicles?company=XXX                -> Vehicle[]
       POST /api/vehicles                            -> Vehicle   (新規)
       PUT  /api/vehicles/:id                        -> Vehicle   (更新)
       DELETE /api/vehicles/:id
   - drivers:
       GET  /api/drivers?company=XXX                 -> { id,name }[]
   - uploads:
       POST /api/vehicles/:id/attachments (FormData) -> Attachment[]
*/
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
    let msg = `HTTP ${res.status} at ${url}`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {}
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  // 204 や空ボディ対応
  if (res.status === 204) return {} as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : ({} as T));
}

const VehiclesAPI = {
  list: async (company: string) => {
    const data = await apiJSON<any>(`/api/vehicles?company=${encodeURIComponent(company)}`);
    return Array.isArray(data) ? (data as Vehicle[]) : [];
  },

  create: (v: Omit<Vehicle, "id" | "attachments"> & { attachments?: Attachment[] }) =>
    apiJSON<Vehicle>(`/api/vehicles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    }),

  update: (id: number, v: Partial<Vehicle>) =>
    apiJSON<Vehicle>(`/api/vehicles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    }),

  remove: (id: number) =>
    apiJSON<{}>(`/api/vehicles/${id}`, { method: "DELETE" }),

  uploadAttachments: (id: number, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return apiJSON<Attachment[]>(`/api/vehicles/${id}/attachments`, {
      method: "POST",
      body: fd,
    });
  },
};

const DriversAPI = {
  list: (company: string) =>
    apiJSON<Driver[]>(`/api/drivers?company=${encodeURIComponent(company)}`),
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
  // 会社テナントの決定（既存仕様に合わせて両対応）
  const cur = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch {
      return {};
    }
  }, []);
  const fallbackCompany = localStorage.getItem("company") || "";
  const company = (cur?.company || fallbackCompany || "").trim();

  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [vehicleCustomFields, setVehicleCustomFields] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  // カスタム項目はとりあえずローカルで管理（要件次第ではAPI化）
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("vehicleCustomFields");
      if (saved) setVehicleCustomFields(JSON.parse(saved));
    } catch {}
  }, []);

  // 初期ロード

React.useEffect(() => {
  let aborted = false;
  (async () => {
    if (!company) {
      setLoading(false);
      setError("会社情報が見つかりません。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let vList: Vehicle[] = [];
      let dList: Driver[] = [];
      try {
        // まずは API を叩く
        [vList, dList] = await Promise.all([
          VehiclesAPI.list(company),
          DriversAPI.list(company),
        ]);
      } catch (e: any) {
        // API が未実装/未配備などで 404 の場合のみ、ローカルへフォールバック
        if (e?.status === 404) {
          const localVehicles = JSON.parse(
            localStorage.getItem(vehicleStorageKey(company)) || "[]"
          ) as Vehicle[];
          const localDriversRaw = JSON.parse(
            localStorage.getItem("driverList") || "[]"
          ) as Array<{ id?: string; name?: string }>;

          vList = Array.isArray(localVehicles) ? localVehicles : [];
          dList = Array.isArray(localDriversRaw)
            ? localDriversRaw
                .filter((x) => x && x.name)
                .map((x, i) => ({ id: x.id ?? String(i + 1), name: x.name! }))
            : [];
        } else {
          throw e; // 404 以外はそのままエラー
        }
      }

      if (!aborted) {
        setVehicles(vList ?? []);
        setDrivers(dList ?? []);
      }
    } catch (e: any) {
      if (!aborted) setError(e?.message ?? "データの取得に失敗しました。");
    } finally {
      if (!aborted) setLoading(false);
    }
  })();
  return () => { aborted = true; };
}, [company]);

  // 共有イベントで再読込（ドライバー/車両）
  React.useEffect(() => {
  const reload = async () => {
    try {
      const [vList, dList] = await Promise.all([
        VehiclesAPI.list(company),
        DriversAPI.list(company),
      ]);
      setVehicles(vList ?? []);
      setDrivers(dList ?? []);
    } catch (e: any) {
      if (e?.status === 404) {
        const localV = JSON.parse(localStorage.getItem(vehicleStorageKey(company)) || "[]") as Vehicle[];
        const localDRaw = JSON.parse(localStorage.getItem("driverList") || "[]") as Array<{ id?: string; name?: string }>;
        setVehicles(Array.isArray(localV) ? localV : []);
        setDrivers(
          Array.isArray(localDRaw)
            ? localDRaw.filter(x => x && x.name).map((x, i) => ({ id: x.id ?? String(i + 1), name: x.name! }))
            : []
        );
      } else {
        // 他のエラーは握りつぶさずログる
        console.error(e);
      }
    }
  };

  const onDriversChanged = () => reload();
  const onVehiclesChanged = () => reload();
  window.addEventListener("drivers:changed", onDriversChanged);
  window.addEventListener("vehicles:changed", onVehiclesChanged);
  return () => {
    window.removeEventListener("drivers:changed", onDriversChanged);
    window.removeEventListener("vehicles:changed", onVehiclesChanged);
  };
}, [company]);

  // 行の編集用に、表示値を直接 state に持たせる（簡易版）
  const patchVehicle = (id: number, patch: Partial<Vehicle>) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
    );
  };

  const handleAdd = () => {
    if (!company) {
      setError("会社情報が見つかりません。");
      return;
    }
    const tempId = -Date.now(); // 一時ID（負数）
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
    setVehicles((prev) => [newV, ...prev]);
    setEditingId(tempId);
    setInfo(null);
    setError(null);
  };

  const handleSave = async (id: number) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;

    const msg = validateVehicle(v);
    if (msg) {
      setError(msg);
      return;
    }

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
        setVehicles((prev) =>
          prev.map((x) => (x.id === id ? { ...created } : x))
        );
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
        setVehicles((prev) =>
          prev.map((x) => (x.id === id ? { ...x, ...updated } : x))
        );
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
} catch (e: any) {
  if (e?.status === 404) {
    // ◆ サーバ未実装時でもローカルの見た目を揃える
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
      const uploaded = await VehiclesAPI.uploadAttachments(id, list);
      // 追記
      setVehicles((prev) =>
        prev.map((v) => (v.id === id ? { ...v, attachments: [...(v.attachments || []), ...uploaded] } : v))
      );
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
    // ここはAPI仕様に合わせて、DELETE /api/vehicles/:id/attachments?name=... などに変更してください
    if (!window.confirm("このファイルを削除しますか？")) return;
    try {
      // 仮でクライアント側だけ更新（実際はサーバ側も削除する）
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicleId
            ? { ...v, attachments: v.attachments.filter((_, i) => i !== index) }
            : v
        )
      );
      setInfo("ファイルを削除しました。");
      window.dispatchEvent(new Event("vehicles:changed"));
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
                            // 新規で空行なら破棄
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

                  {/* 自賠責（※元コードの誤バインドを修正） */}
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

                  {/* 任意保険（※元コードの誤バインドを修正） */}
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
