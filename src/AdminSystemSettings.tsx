import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { Plus, Trash2, ShieldCheck, RefreshCcw } from "lucide-react";

/* ========= Types ========= */
type Template = {
  id: string;
  label: string;
  lawTag?: string;
  defaultOwner?: string;
  defaultDueDays?: number;
  active: boolean;
};

type ComplianceSettings = {
  notificationSetting: "全員に通知" | "管理者のみ" | "通知しない";
  driverCustomFields: string[];
  adminCustomFields: string[];
  vehicleCustomFields: string[];
  projectCustomFields: string[];
  taskTemplates: Template[];
  updatedAt?: any;
};

/* ========= Defaults ========= */
const DEFAULT_SETTINGS: ComplianceSettings = {
  notificationSetting: "全員に通知",
  driverCustomFields: [],
  adminCustomFields: [],
  vehicleCustomFields: [],
  projectCustomFields: [],
  taskTemplates: [
    {
      id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())) + "-a",
      label: "運転者の労働時間改善（点呼・休息・拘束時間の順守）",
      lawTag: "改善基準",
      defaultOwner: "運行管理",
      defaultDueDays: 30,
      active: true,
    },
    {
      id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())) + "-b",
      label: "点呼記録・運転日報・事故記録の保存期間整備",
      lawTag: "運送法/安全規則",
      defaultOwner: "運行管理",
      defaultDueDays: 30,
      active: true,
    },
  ],
};

/* ========= Local fallback ========= */
function localKey(company: string) {
  return `complianceSettings:${company || "default"}`;
}
function loadLocal(company: string): ComplianceSettings | null {
  try {
    const raw = localStorage.getItem(localKey(company));
    return raw ? (JSON.parse(raw) as ComplianceSettings) : null;
  } catch {
    return null;
  }
}
function saveLocal(company: string, s: ComplianceSettings) {
  try {
    localStorage.setItem(localKey(company), JSON.stringify(s));
  } catch {}
}

/* ========= Component ========= */
export default function SystemSettings() {
  const [uid, setUid] = useState<string>("");
  const [company, setCompany] = useState<string>("default");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [settings, setSettings] = useState<ComplianceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackLocal, setFallbackLocal] = useState(false);

  // 新規テンプレ入力
  const [newTpl, setNewTpl] = useState<Partial<Template>>({
    label: "",
    lawTag: "",
    defaultOwner: "",
    defaultDueDays: 30,
    active: true,
  });

  /* === auth & company === */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      // ログインしていなくても「default」会社で読み込みを試みる
      const meCo = localStorage.getItem("company") || "default";
      if (!u) {
        setUid("");
        setIsAdmin(false);
        setCompany(meCo);
        return;
      }
      setUid(u.uid);
      try {
        const meSnap = await getDoc(doc(db, "users", u.uid));
        const me = meSnap.exists() ? (meSnap.data() as any) : {};
        const co = me?.company || meCo;
        setCompany(co);
        setIsAdmin(String(me?.role || "").toLowerCase().includes("admin"));
      } catch {
        setCompany(meCo);
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  const settingsRef = useMemo(() => {
    if (!company) return null;
    // companies/{company}/complianceSettings/global
    return doc(db, "companies", company, "complianceSettings", "global");
  }, [company]);

  /* === load settings (with robust error/fallback) === */
  useEffect(() => {
    if (!settingsRef) return;
    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      settingsRef,
      async (snap) => {
        try {
          if (!snap.exists()) {
            // 初回作成を試みる（権限が無い場合は catch）
            try {
              await setDoc(
                settingsRef,
                { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() },
                { merge: true }
              );
              setSettings(DEFAULT_SETTINGS);
              saveLocal(company, DEFAULT_SETTINGS);
              setFallbackLocal(false);
            } catch (e: any) {
              // 書けない → ローカルにフォールバック
              const local = loadLocal(company) || DEFAULT_SETTINGS;
              setSettings(local);
              setFallbackLocal(true);
              setError(
                "Firestore に書き込みできません（未権限/未ログインの可能性）。ローカル保存で動作中。"
              );
            } finally {
              setLoading(false);
            }
            return;
          }
          const data = snap.data() as ComplianceSettings;
          setSettings(data);
          saveLocal(company, data);
          setFallbackLocal(false);
          setLoading(false);
        } catch (e: any) {
          const local = loadLocal(company) || DEFAULT_SETTINGS;
          setSettings(local);
          setFallbackLocal(true);
          setError("設定の読込に失敗したためローカル保存に切り替えました。");
          setLoading(false);
        }
      },
      (err) => {
        console.error("[settings onSnapshot error]", err);
        const local = loadLocal(company) || DEFAULT_SETTINGS;
        setSettings(local);
        setFallbackLocal(true);
        setError("Firestore 監視に失敗したためローカル保存に切り替えました。");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [settingsRef, company]);

  async function savePatch(patch: Partial<ComplianceSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveLocal(company, next);
    setSaving(true);
    setError(null);
    try {
      if (!settingsRef) throw new Error("settingsRef missing");
      await updateDoc(settingsRef, { ...patch, updatedAt: serverTimestamp() });
      setFallbackLocal(false);
    } catch (e: any) {
      // Cloud へは保存できない → ローカル維持
      setFallbackLocal(true);
      setError("Firestore に保存できませんでした。ローカル保存で継続します。");
    } finally {
      setSaving(false);
    }
  }

  async function upsertTemplate(tpl: Partial<Template>) {
    if (!tpl.label?.trim()) {
      alert("タスク名は必須です");
      return;
    }
    const id = tpl.id || (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const newItem: Template = {
      id,
      label: tpl.label.trim(),
      lawTag: tpl.lawTag?.trim() || undefined,
      defaultOwner: tpl.defaultOwner?.trim() || undefined,
      defaultDueDays: Number.isFinite(tpl.defaultDueDays)
        ? Number(tpl.defaultDueDays)
        : 30,
      active: tpl.active ?? true,
    };
    const exists = settings.taskTemplates.find((x) => x.id === id);
    const nextList = exists
      ? settings.taskTemplates.map((x) => (x.id === id ? newItem : x))
      : [...settings.taskTemplates, newItem];
    await savePatch({ taskTemplates: nextList });
    setNewTpl({
      label: "",
      lawTag: "",
      defaultOwner: "",
      defaultDueDays: 30,
      active: true,
    });
  }

  async function deleteTemplate(id: string) {
    const nextList = settings.taskTemplates.filter((x) => x.id !== id);
    await savePatch({ taskTemplates: nextList });
  }

  async function toggleTemplate(id: string) {
    const nextList = settings.taskTemplates.map((x) =>
      x.id === id ? { ...x, active: !x.active } : x
    );
    await savePatch({ taskTemplates: nextList });
  }

  async function moveTemplate(id: string, dir: -1 | 1) {
    const idx = settings.taskTemplates.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const arr = [...settings.taskTemplates];
    const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    const [row] = arr.splice(idx, 1);
    arr.splice(ni, 0, row);
    await savePatch({ taskTemplates: arr });
  }

  async function retryCloudSync() {
    if (!settingsRef) return;
    setSaving(true);
    setError(null);
    try {
      await setDoc(
        settingsRef,
        { ...settings, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setFallbackLocal(false);
    } catch (e: any) {
      setFallbackLocal(true);
      setError("再同期に失敗しました。ログイン/権限/ルールをご確認ください。");
    } finally {
      setSaving(false);
    }
  }

  const ro = !isAdmin; // 管理者のみ編集可（読み取りは誰でも）

  if (loading) return <div className="p-6 text-gray-500">読み込み中…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        ⚙️ システム設定
        {isAdmin && (
          <span className="text-emerald-700 text-sm inline-flex items-center">
            <ShieldCheck size={16} className="mr-1" />
            管理者
          </span>
        )}
        {saving && <span className="text-xs text-gray-500">保存中…</span>}
      </h1>

      {(error || fallbackLocal) && (
        <div
          className={`p-3 rounded ${
            fallbackLocal
              ? "bg-yellow-50 border border-yellow-300 text-yellow-900"
              : "bg-red-50 border border-red-300 text-red-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {fallbackLocal ? "ローカル保存で動作中" : "エラー"}
              </p>
              {error && <p className="text-sm mt-1">{error}</p>}
            </div>
            <button
              onClick={retryCloudSync}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border hover:bg-gray-50"
            >
              <RefreshCcw size={16} /> 再接続
            </button>
          </div>
        </div>
      )}

      {/* 通知設定 */}
      <div className="bg-white p-4 rounded shadow">
        <label className="block mb-2 font-semibold">通知設定</label>
        <select
          disabled={ro}
          className="border rounded p-2 w-full"
          value={settings.notificationSetting}
          onChange={(e) =>
            savePatch({
              notificationSetting:
                e.target.value as ComplianceSettings["notificationSetting"],
            })
          }
        >
          <option>全員に通知</option>
          <option>管理者のみ</option>
          <option>通知しない</option>
        </select>
      </div>

      {/* タスクテンプレ（＝対応タスクリストに何を載せるか） */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">🧩 対応タスクリスト・テンプレ設定</h2>
        <p className="text-xs text-gray-500 mb-3">
          有効（✅）のテンプレだけが「対応タスクリスト」に反映されます。順序は上から適用されます。
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-2 border w-16">有効</th>
                <th className="px-2 py-2 border">タスク名</th>
                <th className="px-2 py-2 border w-28">法令タグ</th>
                <th className="px-2 py-2 border w-28">既定担当</th>
                <th className="px-2 py-2 border w-28">期限(日)</th>
                <th className="px-2 py-2 border w-28">並び替え</th>
                <th className="px-2 py-2 border w-16">削除</th>
              </tr>
            </thead>
            <tbody>
              {settings.taskTemplates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 border text-center">
                    <input
                      type="checkbox"
                      disabled={ro}
                      checked={t.active}
                      onChange={() => toggleTemplate(t.id)}
                    />
                  </td>
                  <td className="px-2 py-2 border">{t.label}</td>
                  <td className="px-2 py-2 border">{t.lawTag || "-"}</td>
                  <td className="px-2 py-2 border">{t.defaultOwner || "-"}</td>
                  <td className="px-2 py-2 border text-right">
                    {t.defaultDueDays ?? "-"}
                  </td>
                  <td className="px-2 py-2 border text-center">
                    <div className="inline-flex gap-2">
                      <button
                        disabled={ro}
                        className="px-2 py-1 border rounded"
                        onClick={() => moveTemplate(t.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        disabled={ro}
                        className="px-2 py-1 border rounded"
                        onClick={() => moveTemplate(t.id, +1)}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 border text-center">
                    <button
                      disabled={ro}
                      className="text-red-600 hover:text-red-800"
                      onClick={() => deleteTemplate(t.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {settings.taskTemplates.length === 0 && (
                <tr>
                  <td
                    className="px-2 py-4 border text-center text-gray-500"
                    colSpan={7}
                  >
                    テンプレはまだありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 新規追加 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-3">
          <input
            disabled={ro}
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="タスク名（必須）"
            value={newTpl.label || ""}
            onChange={(e) => setNewTpl((s) => ({ ...s, label: e.target.value }))}
          />
          <input
            disabled={ro}
            className="border rounded px-3 py-2"
            placeholder="法令タグ 例: 改善基準"
            value={newTpl.lawTag || ""}
            onChange={(e) => setNewTpl((s) => ({ ...s, lawTag: e.target.value }))}
          />
          <input
            disabled={ro}
            className="border rounded px-3 py-2"
            placeholder="既定担当 例: 運行管理"
            value={newTpl.defaultOwner || ""}
            onChange={(e) =>
              setNewTpl((s) => ({ ...s, defaultOwner: e.target.value }))
            }
          />
          <input
            disabled={ro}
            type="number"
            className="border rounded px-3 py-2"
            placeholder="期限(日) 例: 30"
            value={String(newTpl.defaultDueDays ?? 30)}
            onChange={(e) =>
              setNewTpl((s) => ({
                ...s,
                defaultDueDays: Number(e.target.value || 30),
              }))
            }
          />
          <button
            disabled={ro}
            onClick={() => upsertTemplate(newTpl)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-flex items-center justify-center"
          >
            <Plus size={16} className="mr-1" /> 追加
          </button>
        </div>
      </div>

      {/* カスタム項目（ドライバー／管理者／車両／案件） */}
      <div className="grid md:grid-cols-2 gap-6">
        <FieldEditor
          title="📝 ドライバー情報のカスタム項目"
          placeholder="例：生年月日"
          items={settings.driverCustomFields}
          onAdd={(v) =>
            savePatch({ driverCustomFields: [...settings.driverCustomFields, v] })
          }
          onDelete={(v) =>
            savePatch({
              driverCustomFields: settings.driverCustomFields.filter(
                (x) => x !== v
              ),
            })
          }
          readOnly={ro}
        />
        <FieldEditor
          title="🧑‍💼 管理者情報のカスタム項目"
          placeholder="例：得意分野"
          items={settings.adminCustomFields}
          onAdd={(v) =>
            savePatch({ adminCustomFields: [...settings.adminCustomFields, v] })
          }
          onDelete={(v) =>
            savePatch({
              adminCustomFields: settings.adminCustomFields.filter((x) => x !== v),
            })
          }
          readOnly={ro}
        />
        <FieldEditor
          title="🚗 車両情報のカスタム項目"
          placeholder="例：車種"
          items={settings.vehicleCustomFields}
          onAdd={(v) =>
            savePatch({
              vehicleCustomFields: [...settings.vehicleCustomFields, v],
            })
          }
          onDelete={(v) =>
            savePatch({
              vehicleCustomFields: settings.vehicleCustomFields.filter(
                (x) => x !== v
              ),
            })
          }
          readOnly={ro}
        />
        <FieldEditor
          title="📦 案件情報のカスタム項目"
          placeholder="例：荷物サイズ"
          items={settings.projectCustomFields}
          onAdd={(v) =>
            savePatch({
              projectCustomFields: [...settings.projectCustomFields, v],
            })
          }
          onDelete={(v) =>
            savePatch({
              projectCustomFields: settings.projectCustomFields.filter(
                (x) => x !== v
              ),
            })
          }
          readOnly={ro}
        />
      </div>
    </div>
  );
}

/* ====== 小さな再利用コンポーネント ====== */
function FieldEditor(props: {
  title: string;
  items: string[];
  placeholder: string;
  onAdd: (v: string) => void;
  onDelete: (v: string) => void;
  readOnly?: boolean;
}) {
  const { title, items, placeholder, onAdd, onDelete, readOnly } = props;
  const [value, setValue] = useState("");

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <ul className="space-y-2 mb-4">
        {items.length === 0 && (
          <li className="text-gray-500">項目はまだありません</li>
        )}
        {items.map((f, idx) => (
          <li key={idx} className="flex justify-between items-center border-b pb-1">
            <span>{f}</span>
            <button
              disabled={readOnly}
              className="text-red-500 text-sm hover:underline disabled:opacity-50"
              onClick={() => onDelete(f)}
            >
              削除
            </button>
          </li>
        ))}
      </ul>
      <div className="flex space-x-2">
        <input
          disabled={readOnly}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="border px-3 py-2 rounded w-full"
        />
        <button
          disabled={readOnly}
          onClick={() => {
            if (value.trim()) {
              onAdd(value.trim());
              setValue("");
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          追加
        </button>
      </div>
    </div>
  );
}
