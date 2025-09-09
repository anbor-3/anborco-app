// src/SystemSettings.tsx — 会社共有＋ユーザー別カスタマイズ対応（本番仕様・全文）
"use client";
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

type PartialSettings = Partial<ComplianceSettings>;

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
const localKeyCompany = (company: string) => `complianceSettings:${company || "default"}`;
const localKeyUser = (company: string, uid: string) => `complianceOverrides:${company || "default"}:${uid || "guest"}`;

function loadLocal<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function saveLocal<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

/* ========= Merge helpers =========
   - 会社共有(base) ＋ ユーザー上書き(override) を統合
   - 配列はユニーク化・テンプレは id でマージ
=================================== */
const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

function mergeTemplates(base: Template[], ov?: Template[]): Template[] {
  if (!ov || ov.length === 0) return base;
  const map = new Map<string, Template>();
  base.forEach(t => map.set(t.id, t));
  ov.forEach(t => map.set(t.id, { ...(map.get(t.id) || {} as Template), ...t }));
  // 並び順は ov の順を優先し、存在しないものは末尾へ
  const ordered: Template[] = [];
  ov.forEach(t => { if (map.has(t.id)) ordered.push(map.get(t.id)!); });
  base.forEach(t => { if (!ordered.find(x => x.id === t.id)) ordered.push(map.get(t.id)!); });
  return ordered;
}

function mergeSettings(base: ComplianceSettings, ov?: PartialSettings): ComplianceSettings {
  if (!ov) return base;
  return {
    notificationSetting: ov.notificationSetting ?? base.notificationSetting,
    driverCustomFields: uniq([...(base.driverCustomFields || []), ...(ov.driverCustomFields || [])]),
    adminCustomFields: uniq([...(base.adminCustomFields || []), ...(ov.adminCustomFields || [])]),
    vehicleCustomFields: uniq([...(base.vehicleCustomFields || []), ...(ov.vehicleCustomFields || [])]),
    projectCustomFields: uniq([...(base.projectCustomFields || []), ...(ov.projectCustomFields || [])]),
    taskTemplates: mergeTemplates(base.taskTemplates || [], ov.taskTemplates || []),
    updatedAt: base.updatedAt,
  };
}

/* ========= Component ========= */
export default function SystemSettings() {
  const [uid, setUid] = useState<string>("");
  const [company, setCompany] = useState<string>("default");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // 会社共有の元設定 / 自分用の上書き / 適用結果（統合）
  const [baseSettings, setBaseSettings] = useState<ComplianceSettings>(DEFAULT_SETTINGS);
  const [userOverrides, setUserOverrides] = useState<PartialSettings>({});
  const settings = useMemo(() => mergeSettings(baseSettings, userOverrides), [baseSettings, userOverrides]);

  // 編集スコープ: 会社共有 or 自分だけ
  const [scope, setScope] = useState<"company" | "user">("company");

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
      const meCo = localStorage.getItem("company") || "default";
      if (!u) {
        setUid("");
        setIsAdmin(false);
        setCompany(meCo);
        setScope("company"); // 未ログイン時は会社設定の参照（書き込みはローカル）
        return;
      }
      setUid(u.uid);
      try {
        const meSnap = await getDoc(doc(db, "users", u.uid));
        const me = meSnap.exists() ? (meSnap.data() as any) : {};
        const co = me?.company || meCo;
        setCompany(co);
        const admin = String(me?.role || "").toLowerCase().includes("admin");
        setIsAdmin(admin);
        setScope(admin ? "company" : "user");
      } catch {
        setCompany(meCo);
        setIsAdmin(false);
        setScope("user");
      }
    });
    return () => unsub();
  }, []);

  // Firestore Refs
  const refCompany = useMemo(() => company ? doc(db, "companies", company, "complianceSettings", "global") : null, [company]);
  const refUser = useMemo(() => (company && uid) ? doc(db, "companies", company, "complianceOverrides", uid) : null, [company, uid]);

  /* === load company settings === */
  useEffect(() => {
    if (!refCompany) return;
    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      refCompany,
      async (snap) => {
        try {
          if (!snap.exists()) {
            // 初回作成（権限無い場合は catch）
            try {
              await setDoc(refCompany, { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() }, { merge: true });
              setBaseSettings(DEFAULT_SETTINGS);
              saveLocal(localKeyCompany(company), DEFAULT_SETTINGS);
              setFallbackLocal(false);
            } catch {
              const local = loadLocal<ComplianceSettings>(localKeyCompany(company)) || DEFAULT_SETTINGS;
              setBaseSettings(local);
              setFallbackLocal(true);
              setError("Firestore に書き込みできません。ローカル保存で動作中（会社設定）。");
            } finally {
              setLoading(false);
            }
            return;
          }
          const data = snap.data() as ComplianceSettings;
          setBaseSettings(data);
          saveLocal(localKeyCompany(company), data);
          setFallbackLocal(false);
          setLoading(false);
        } catch {
          const local = loadLocal<ComplianceSettings>(localKeyCompany(company)) || DEFAULT_SETTINGS;
          setBaseSettings(local);
          setFallbackLocal(true);
          setError("会社設定の読込に失敗したためローカル保存に切り替えました。");
          setLoading(false);
        }
      },
      (err) => {
        console.error("[company settings onSnapshot error]", err);
        const local = loadLocal<ComplianceSettings>(localKeyCompany(company)) || DEFAULT_SETTINGS;
        setBaseSettings(local);
        setFallbackLocal(true);
        setError("会社設定の監視に失敗したためローカル保存に切り替えました。");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [refCompany, company]);

  /* === load user overrides === */
  useEffect(() => {
    if (!refUser) {
      // 未ログイン時：ローカルのみ
      const local = loadLocal<PartialSettings>(localKeyUser(company, uid)) || {};
      setUserOverrides(local);
      return;
    }
    setError(null);
    const unsub = onSnapshot(
      refUser,
      (snap) => {
        try {
          if (!snap.exists()) {
            setUserOverrides({});
            saveLocal(localKeyUser(company, uid), {});
            return;
          }
          const data = snap.data() as PartialSettings;
          setUserOverrides(data || {});
          saveLocal(localKeyUser(company, uid), data || {});
        } catch {
          const local = loadLocal<PartialSettings>(localKeyUser(company, uid)) || {};
          setUserOverrides(local);
          setFallbackLocal(true);
          setError("ユーザー上書きの読込に失敗しました。ローカル保存に切替。");
        }
      },
      (err) => {
        console.error("[user overrides onSnapshot error]", err);
        const local = loadLocal<PartialSettings>(localKeyUser(company, uid)) || {};
        setUserOverrides(local);
        setFallbackLocal(true);
        setError("ユーザー上書きの監視に失敗しました。ローカル保存に切替。");
      }
    );
    return () => unsub();
  }, [refUser, company, uid]);

  /* === save helpers === */
  const editingReadOnly =
    scope === "company" ? !isAdmin : !uid; // 会社設定は管理者のみ。ユーザー上書きはログイン必須

  async function savePatch(patch: PartialSettings) {
    setSaving(true);
    setError(null);
    try {
      if (scope === "company") {
        // 会社共有の設定を更新
        const next = { ...baseSettings, ...patch } as ComplianceSettings;
        setBaseSettings(next);
        saveLocal(localKeyCompany(company), next);
        if (!refCompany) throw new Error("refCompany missing");
        await updateDoc(refCompany, { ...patch, updatedAt: serverTimestamp() });
        setFallbackLocal(false);
      } else {
        // 自分だけの上書きを更新（部分のみ）
        const next = { ...userOverrides, ...patch };
        setUserOverrides(next);
        saveLocal(localKeyUser(company, uid), next);
        if (!refUser) throw new Error("refUser missing");
        await setDoc(refUser, { ...next, updatedAt: serverTimestamp() }, { merge: true });
        setFallbackLocal(false);
      }
    } catch (e: any) {
      setFallbackLocal(true);
      setError("Firestore に保存できませんでした。ローカル保存で継続します。");
    } finally {
      setSaving(false);
    }
  }

  /* === template ops (作用対象＝現在のスコープ) === */
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
      defaultDueDays: Number.isFinite(tpl.defaultDueDays) ? Number(tpl.defaultDueDays) : 30,
      active: tpl.active ?? true,
    };

    if (scope === "company") {
      const exists = settings.taskTemplates.find((x) => x.id === id);
      const baseList = baseSettings.taskTemplates || [];
      const nextList = exists
        ? baseList.map((x) => (x.id === id ? newItem : x))
        : [...baseList, newItem];
      await savePatch({ taskTemplates: nextList });
    } else {
      // ユーザー上書きは「差分」だけを持つ（存在しない id は追加として扱う）
      const ovList = (userOverrides.taskTemplates || []).filter(Boolean) as Template[];
      const idx = ovList.findIndex((x) => x.id === id);
      if (idx >= 0) ovList[idx] = { ...ovList[idx], ...newItem };
      else ovList.push(newItem);
      await savePatch({ taskTemplates: ovList });
    }

    setNewTpl({ label: "", lawTag: "", defaultOwner: "", defaultDueDays: 30, active: true });
  }

  async function deleteTemplate(id: string) {
    if (scope === "company") {
      const nextList = (baseSettings.taskTemplates || []).filter((x) => x.id !== id);
      await savePatch({ taskTemplates: nextList });
    } else {
      const nextList = (userOverrides.taskTemplates || []).filter((x) => x.id !== id);
      await savePatch({ taskTemplates: nextList });
    }
  }

  async function toggleTemplate(id: string) {
    if (scope === "company") {
      const nextList = (baseSettings.taskTemplates || []).map((x) =>
        x.id === id ? { ...x, active: !x.active } : x
      );
      await savePatch({ taskTemplates: nextList });
    } else {
      // 上書き側に該当 id が無ければ「反転だけ」を差分として持つ
      const current = settings.taskTemplates.find(t => t.id === id);
      if (!current) return;
      const ovList = [...(userOverrides.taskTemplates || [])];
      const idx = ovList.findIndex(t => t.id === id);
      const nextRow = { ...(idx >= 0 ? ovList[idx] : { id, active: current.active }), active: !current.active } as Template;
      if (idx >= 0) ovList[idx] = nextRow;
      else ovList.push(nextRow);
      await savePatch({ taskTemplates: ovList });
    }
  }

  async function moveTemplate(id: string, dir: -1 | 1) {
    // 並び順は「現在のスコープの配列」で操作
    if (scope === "company") {
      const arr = [...(baseSettings.taskTemplates || [])];
      const idx = arr.findIndex(x => x.id === id);
      const ni = idx + dir;
      if (idx === -1 || ni < 0 || ni >= arr.length) return;
      const [row] = arr.splice(idx, 1);
      arr.splice(ni, 0, row);
      await savePatch({ taskTemplates: arr });
    } else {
      const arr = [...(userOverrides.taskTemplates || [])];
      const idx = arr.findIndex(x => x.id === id);
      // 上書き側に無い場合は base の順をコピーして調整
      if (idx === -1) {
        const baseSeq = (baseSettings.taskTemplates || []).map(t => ({ ...t }));
        const bidx = baseSeq.findIndex(x => x.id === id);
        const ni = bidx + dir;
        if (bidx === -1 || ni < 0 || ni >= baseSeq.length) return;
        const [row] = baseSeq.splice(bidx, 1);
        baseSeq.splice(ni, 0, row);
        // 差分として「順序」一式を保存
        await savePatch({ taskTemplates: baseSeq });
      } else {
        const ni = idx + dir;
        if (ni < 0 || ni >= arr.length) return;
        const [row] = arr.splice(idx, 1);
        arr.splice(ni, 0, row);
        await savePatch({ taskTemplates: arr });
      }
    }
  }

  async function retryCloudSync() {
    setSaving(true);
    setError(null);
    try {
      if (scope === "company") {
        if (!refCompany) throw new Error("refCompany missing");
        await setDoc(refCompany, { ...baseSettings, updatedAt: serverTimestamp() }, { merge: true });
      } else {
        if (!refUser) throw new Error("refUser missing");
        await setDoc(refUser, { ...userOverrides, updatedAt: serverTimestamp() }, { merge: true });
      }
      setFallbackLocal(false);
    } catch (e: any) {
      setFallbackLocal(true);
      setError("再同期に失敗しました。ログイン/権限/ルールをご確認ください。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500">読み込み中…</div>;

  return (
    <div className="p-6 space-y-6">
      {/* 題目（英字サブタイトル付き） */}
      <h1 className="text-2xl font-bold flex items-center gap-2">
        ⚙️ システム設定 <span className="ml-2 text-sm text-gray-500">- System Settings -</span>
        {isAdmin && (
          <span className="ml-2 text-emerald-700 text-sm inline-flex items-center">
            <ShieldCheck size={16} className="mr-1" />
            管理者
          </span>
        )}
        {saving && <span className="text-xs text-gray-500 ml-2">保存中…</span>}
      </h1>

      {/* スコープ切替 */}
      <div className="bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="font-semibold">適用スコープ / Scope</div>
          <div className="text-xs text-gray-500">会社共有設定（Company-wide）と自分だけの上書き（My overrides）を切替</div>
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={scope === "company"}
              onChange={() => setScope("company")}
              disabled={!isAdmin}
            />
            <span>会社共有（Company）</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={scope === "user"}
              onChange={() => setScope("user")}
            />
            <span>自分だけ（My overrides）</span>
          </label>
          {(error || fallbackLocal) && (
            <button
              onClick={retryCloudSync}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border hover:bg-gray-50"
            >
              <RefreshCcw size={16} /> 再接続
            </button>
          )}
        </div>
      </div>

      {(error || fallbackLocal) && (
        <div
          className={`p-3 rounded ${
            fallbackLocal
              ? "bg-yellow-50 border border-yellow-300 text-yellow-900"
              : "bg-red-50 border border-red-300 text-red-900"
          }`}
        >
          <div className="font-medium">
            {fallbackLocal ? "ローカル保存で動作中" : "エラー"}
            <span className="ml-2 text-xs text-gray-600">
              （対象：{scope === "company" ? "会社共有設定" : "ユーザー上書き"}）
            </span>
          </div>
          {error && <p className="text-sm mt-1">{error}</p>}
        </div>
      )}

      {/* 通知設定 - Notifications */}
      <div className="bg-white p-4 rounded shadow">
        <label className="block mb-2 font-semibold">
          通知設定 <span className="ml-2 text-xs text-gray-500">- Notifications -</span>
        </label>
        <select
          disabled={editingReadOnly}
          className="border rounded p-2 w-full"
          value={(scope === "company" ? baseSettings : (userOverrides.notificationSetting ?? settings.notificationSetting))}
          onChange={(e) =>
            savePatch({
              notificationSetting: e.target.value as ComplianceSettings["notificationSetting"],
            })
          }
        >
          <option>全員に通知</option>
          <option>管理者のみ</option>
          <option>通知しない</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          表示は適用結果（会社＋自分）の値、保存は現在のスコープに入ります。
        </p>
      </div>

      {/* タスクテンプレ - Task Templates */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">
          🧩 対応タスクリスト・テンプレ設定
          <span className="ml-2 text-xs text-gray-500">- Task Templates -</span>
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          画面の一覧は「適用結果（会社＋自分）」です。追加・編集・並び替え・削除は現在のスコープに対して行われます。
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
                      disabled={editingReadOnly}
                      checked={!!t.active}
                      onChange={() => toggleTemplate(t.id)}
                      title={scope === "company" ? "会社共有の有効フラグを切替" : "自分の上書きとして有効フラグを切替"}
                    />
                  </td>
                  <td className="px-2 py-2 border">{t.label}</td>
                  <td className="px-2 py-2 border">{t.lawTag || "-"}</td>
                  <td className="px-2 py-2 border">{t.defaultOwner || "-"}</td>
                  <td className="px-2 py-2 border text-right">{t.defaultDueDays ?? "-"}</td>
                  <td className="px-2 py-2 border text-center">
                    <div className="inline-flex gap-2">
                      <button
                        disabled={editingReadOnly}
                        className="px-2 py-1 border rounded"
                        onClick={() => moveTemplate(t.id, -1)}
                        title="上へ"
                      >
                        ↑
                      </button>
                      <button
                        disabled={editingReadOnly}
                        className="px-2 py-1 border rounded"
                        onClick={() => moveTemplate(t.id, +1)}
                        title="下へ"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 border text-center">
                    <button
                      disabled={editingReadOnly}
                      className="text-red-600 hover:text-red-800"
                      onClick={() => deleteTemplate(t.id)}
                      title={scope === "company" ? "会社共有から削除" : "自分の上書きから削除"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {settings.taskTemplates.length === 0 && (
                <tr>
                  <td className="px-2 py-4 border text-center text-gray-500" colSpan={7}>
                    テンプレはまだありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 新規追加（現在のスコープへ） */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-3">
          <input
            disabled={editingReadOnly}
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="タスク名（必須）"
            value={newTpl.label || ""}
            onChange={(e) => setNewTpl((s) => ({ ...s, label: e.target.value }))}
          />
          <input
            disabled={editingReadOnly}
            className="border rounded px-3 py-2"
            placeholder="法令タグ 例: 改善基準"
            value={newTpl.lawTag || ""}
            onChange={(e) => setNewTpl((s) => ({ ...s, lawTag: e.target.value }))}
          />
          <input
            disabled={editingReadOnly}
            className="border rounded px-3 py-2"
            placeholder="既定担当 例: 運行管理"
            value={newTpl.defaultOwner || ""}
            onChange={(e) => setNewTpl((s) => ({ ...s, defaultOwner: e.target.value }))}
          />
          <input
            disabled={editingReadOnly}
            type="number"
            className="border rounded px-3 py-2"
            placeholder="期限(日) 例: 30"
            value={String(newTpl.defaultDueDays ?? 30)}
            onChange={(e) => setNewTpl((s) => ({ ...s, defaultDueDays: Number(e.target.value || 30) }))}
          />
          <button
            disabled={editingReadOnly}
            onClick={() => upsertTemplate(newTpl)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-flex items-center justify-center disabled:opacity-50"
            title={scope === "company" ? "会社共有に追加" : "自分の上書きに追加"}
          >
            <Plus size={16} className="mr-1" /> 追加
          </button>
        </div>
      </div>

      {/* カスタム項目（ドライバー／管理者／車両／案件） */}
      <div className="grid md:grid-cols-2 gap-6">
        <FieldEditor
          title="📝 ドライバー情報のカスタム項目"
          en="- Driver custom fields -"
          placeholder="例：生年月日"
          items={settings.driverCustomFields}
          onAdd={(v) => {
            if (scope === "company") {
              const next = Array.from(new Set([...(baseSettings.driverCustomFields || []), v]));
              savePatch({ driverCustomFields: next });
            } else {
              const next = Array.from(new Set([...(userOverrides.driverCustomFields || []), v]));
              savePatch({ driverCustomFields: next });
            }
          }}
          onDelete={(v) => {
            if (scope === "company") {
              savePatch({ driverCustomFields: (baseSettings.driverCustomFields || []).filter(x => x !== v) });
            } else {
              savePatch({ driverCustomFields: (userOverrides.driverCustomFields || []).filter(x => x !== v) });
            }
          }}
          readOnly={editingReadOnly}
        />
        <FieldEditor
          title="🧑‍💼 管理者情報のカスタム項目"
          en="- Admin custom fields -"
          placeholder="例：得意分野"
          items={settings.adminCustomFields}
          onAdd={(v) => {
            if (scope === "company") {
              const next = Array.from(new Set([...(baseSettings.adminCustomFields || []), v]));
              savePatch({ adminCustomFields: next });
            } else {
              const next = Array.from(new Set([...(userOverrides.adminCustomFields || []), v]));
              savePatch({ adminCustomFields: next });
            }
          }}
          onDelete={(v) => {
            if (scope === "company") {
              savePatch({ adminCustomFields: (baseSettings.adminCustomFields || []).filter(x => x !== v) });
            } else {
              savePatch({ adminCustomFields: (userOverrides.adminCustomFields || []).filter(x => x !== v) });
            }
          }}
          readOnly={editingReadOnly}
        />
        <FieldEditor
          title="🚗 車両情報のカスタム項目"
          en="- Vehicle custom fields -"
          placeholder="例：車種"
          items={settings.vehicleCustomFields}
          onAdd={(v) => {
            if (scope === "company") {
              const next = Array.from(new Set([...(baseSettings.vehicleCustomFields || []), v]));
              savePatch({ vehicleCustomFields: next });
            } else {
              const next = Array.from(new Set([...(userOverrides.vehicleCustomFields || []), v]));
              savePatch({ vehicleCustomFields: next });
            }
          }}
          onDelete={(v) => {
            if (scope === "company") {
              savePatch({ vehicleCustomFields: (baseSettings.vehicleCustomFields || []).filter(x => x !== v) });
            } else {
              savePatch({ vehicleCustomFields: (userOverrides.vehicleCustomFields || []).filter(x => x !== v) });
            }
          }}
          readOnly={editingReadOnly}
        />
        <FieldEditor
          title="📦 案件情報のカスタム項目"
          en="- Project custom fields -"
          placeholder="例：荷物サイズ"
          items={settings.projectCustomFields}
          onAdd={(v) => {
            if (scope === "company") {
              const next = Array.from(new Set([...(baseSettings.projectCustomFields || []), v]));
              savePatch({ projectCustomFields: next });
            } else {
              const next = Array.from(new Set([...(userOverrides.projectCustomFields || []), v]));
              savePatch({ projectCustomFields: next });
            }
          }}
          onDelete={(v) => {
            if (scope === "company") {
              savePatch({ projectCustomFields: (baseSettings.projectCustomFields || []).filter(x => x !== v) });
            } else {
              savePatch({ projectCustomFields: (userOverrides.projectCustomFields || []).filter(x => x !== v) });
            }
          }}
          readOnly={editingReadOnly}
        />
      </div>
    </div>
  );
}

/* ====== 小さな再利用コンポーネント ====== */
function FieldEditor(props: {
  title: string;
  en: string;
  items: string[];
  placeholder: string;
  onAdd: (v: string) => void;
  onDelete: (v: string) => void;
  readOnly?: boolean;
}) {
  const { title, en, items, placeholder, onAdd, onDelete, readOnly } = props;
  const [value, setValue] = useState("");

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-2">
        {title} <span className="ml-2 text-xs text-gray-500">{en}</span>
      </h2>
      <ul className="space-y-2 mb-4">
        {items.length === 0 && <li className="text-gray-500">項目はまだありません</li>}
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
