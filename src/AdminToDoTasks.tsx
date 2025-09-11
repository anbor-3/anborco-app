import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getDoc,
  where,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { CheckCircle, Clock4, RotateCw, Trash2, Plus, ShieldCheck } from "lucide-react";
import { auth, db } from "./firebaseClient";
import { fetchComplianceNews } from "@/utils/news";

/* ===================== Types ===================== */
type NewsItem = { title: string; link: string; source: string; isoDate: string };

type Task = {
  id?: string; // Firestore doc id
  label: string;
  done: boolean;
  excluded?: boolean;          // 対象外
  lawTag?: string;
  owner?: string;
  due?: string;                // YYYY-MM-DD
  note?: string;
  createdAt?: any;
  driverId?: string;
  driverName?: string;
  tplId?: string;              // どのテンプレ由来か（重複防止）
};

type Driver = { id: string; name: string; createdAt?: any; active?: boolean };

type Template = {
  id: string;
  label: string;
  lawTag?: string;
  defaultOwner?: string;
  defaultDueDays?: number;
  active: boolean;
};

type ComplianceSettingsDoc = {
  taskTemplates?: Template[];
};

/* ===================== News helpers ===================== */
const NEWS_CACHE_KEY = "compliance_news_cache_v1";
const VISIBLE_DEFAULT = 5;
const LOAD_MORE_STEP = 10;

function readNewsCache(): NewsItem[] {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return [];
    const { items } = JSON.parse(raw) as { items: NewsItem[]; savedAt: number };
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}
function writeNewsCache(items: NewsItem[]) {
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ items, savedAt: Date.now() }));
  } catch {}
}

/* ===================== Utils ===================== */
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function datePlusDays(days = 0) {
  const base = new Date();
  base.setDate(base.getDate() + days);
  return fmtDate(base);
}

/* ===================== Component ===================== */
export default function AdminToDoTasks() {
  /* --- 認証・会社・権限 --- */
  const [uid, setUid] = useState<string>("");
  const [company, setCompany] = useState<string>("default");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUid(u.uid);
      const meSnap = await getDoc(doc(db, "users", u.uid));
      const me = meSnap.exists() ? (meSnap.data() as any) : {};
      const co = me?.company || localStorage.getItem("company") || "default";
      setCompany(co);
      setIsAdmin(String(me?.role || "").toLowerCase().includes("admin"));
    });
    return () => unsub();
  }, []);

  /* --- ニュース --- */
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [visible, setVisible] = useState<number>(VISIBLE_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tzDate = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const loadNews = useCallback(async () => {
    setVisible(VISIBLE_DEFAULT);
    setLoading(true);
    setErr(null);
    try {
      const items = await fetchComplianceNews({ filter: true, limit: 20 });
      setAllNews(items);
      writeNewsCache(items);
    } catch (e) {
      console.error("[news] failed", e);
      const cache = readNewsCache();
      setAllNews(cache);
      if (!cache.length) setErr("ニュース取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cache = readNewsCache();
    if (cache.length > 0) setAllNews(cache);
    setVisible(VISIBLE_DEFAULT);
    loadNews();
  }, [loadNews]);

  /* --- ドライバー & 設定テンプレ --- */
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);

  // drivers 購読（古い順）
  useEffect(() => {
    if (!company) return;
    const qCol = query(collection(db, "companies", company, "drivers"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      qCol,
      (snap) => {
        const list: Driver[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setDrivers(list);
      },
      (e) => {
        console.warn("[drivers onSnapshot] error:", e);
        setDrivers([]); // 失敗時は空
      }
    );
    return () => unsub();
  }, [company]);

  // settings（テンプレ）購読
  useEffect(() => {
    if (!company) return;
    const ref = doc(db, "companies", company, "complianceSettings", "global");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() || {}) as ComplianceSettingsDoc;
        const tpl = (data.taskTemplates || []).filter((t) => !!t.active);
        setTemplates(tpl);
      },
      (e) => {
        console.warn("[settings onSnapshot] error:", e);
        setTemplates([]);
      }
    );
    return () => unsub();
  }, [company]);

  /* --- タスク（選択ドライバー別） --- */
  const [tasks, setTasks] = useState<Task[]>([]);

  // 選択ドライバーのタスク購読
  useEffect(() => {
    if (!company || !selectedDriverId) {
      setTasks([]);
      return;
    }
    const qCol = query(
      collection(db, "companies", company, "complianceTasks"),
      where("driverId", "==", selectedDriverId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(qCol, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Task[];
      setTasks(list);
    });
    return () => unsub();
  }, [company, selectedDriverId]);

  // ドライバー選択時：不足テンプレを自動反映（重複は tplId で防止）
  useEffect(() => {
    if (!company || !selectedDriverId || templates.length === 0) return;

    const d = drivers.find((x) => x.id === selectedDriverId);
    if (!d) return;

    // すでに購読で tasks が入っている → 既存 tplId をセットに
    const existingTpl = new Set(tasks.map((t) => t.tplId).filter(Boolean) as string[]);

    (async () => {
      const toCreate = templates.filter((tpl) => !existingTpl.has(tpl.id));
      if (toCreate.length === 0) return;

      for (const tpl of toCreate) {
        await addDoc(collection(db, "companies", company, "complianceTasks"), {
          label: tpl.label,
          lawTag: tpl.lawTag || "",
          owner: tpl.defaultOwner || "",
          due: tpl.defaultDueDays ? datePlusDays(tpl.defaultDueDays) : "",
          note: "",
          done: false,
          excluded: false,
          driverId: d.id,
          driverName: d.name || "",
          tplId: tpl.id,
          createdAt: serverTimestamp(),
        } as Omit<Task, "id">);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, selectedDriverId, templates]); // tasks は入れない（生成ループ防止）

  // 追加（選択中ドライバーに紐付け）
  const addTask = async (t: Omit<Task, "id" | "createdAt" | "driverId" | "driverName">) => {
    if (!selectedDriverId) {
      alert("先にドライバーを選択してください");
      return;
    }
    const d = drivers.find((x) => x.id === selectedDriverId);
    await addDoc(collection(db, "companies", company, "complianceTasks"), {
      ...t,
      driverId: selectedDriverId,
      driverName: d?.name || "",
      createdAt: serverTimestamp(),
    });
  };

  // 削除（管理者のみ）
  const removeTask = async (id?: string) => {
    if (!id) return;
    await deleteDoc(doc(db, "companies", company, "complianceTasks", id));
  };

  // 完了トグル（全員可）
  const toggleTask = async (t: Task) => {
    if (!t.id) return;
    await updateDoc(doc(db, "companies", company, "complianceTasks", t.id), {
      done: !t.done,
    });
  };

  // 対象外トグル
  const toggleExcluded = async (t: Task) => {
    if (!t.id) return;
    await updateDoc(doc(db, "companies", company, "complianceTasks", t.id), {
      excluded: !t.excluded,
    });
  };

  // 一括削除（選択ドライバーのタスクを全削除・管理者のみ）
  const clearAll = async () => {
    if (!isAdmin || tasks.length === 0) return;
    if (!confirm("このドライバーの全タスクを削除します。元に戻せません。よろしいですか？")) return;
    await Promise.all(
      tasks.map((t) => t.id && deleteDoc(doc(db, "companies", company, "complianceTasks", t.id)))
    );
  };

  // 入力フォーム
  const [form, setForm] = useState<Omit<Task, "id" | "createdAt" | "driverId" | "driverName">>({
    label: "",
    done: false,
    excluded: false,
    lawTag: "",
    owner: "",
    due: "",
    note: "",
    tplId: undefined,
  });

  // 達成率（対象外は分母から除外）
  const doneRate = useMemo(() => {
    const active = tasks.filter((t) => !t.excluded);
    const total = active.length;
    const done = active.filter((t) => t.done).length;
    return total ? Math.round((done / total) * 100) : 0;
  }, [tasks]);

  /* ===================== UI ===================== */
  return (
    <div className="p-6 space-y-8">
      {/* タイトル */}
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        📚 法改正ダッシュボード <span className="text-base text-gray-500">/ Law Compliance Dashboard</span>
      </h1>

      {/* 📰 最新ニュース */}
      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold mb-3">📰 最新ニュース（燃料・運送の法令等）</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{allNews.length}件</span>
            <button
              onClick={loadNews}
              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
              title="手動更新"
            >
              <RotateCw size={16} /> 更新
            </button>
          </div>
        </div>

        {loading && <p className="text-gray-500">読み込み中…</p>}
        {err && <p className="text-red-600">{err}</p>}

        <ul className="divide-y">
          {allNews.slice(0, Math.max(visible, VISIBLE_DEFAULT)).map((n, i) => (
            <li key={`${n.link}-${i}`} className="py-3">
              <a
                className="text-blue-700 underline font-medium"
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {n.title}
              </a>
              <div className="text-xs text-gray-500 mt-1">
                {n.source} ・ {tzDate(n.isoDate)}
              </div>
            </li>
          ))}
          {allNews.length === 0 && !loading && (
            <li className="py-3 text-gray-500">
              （キャッシュがないため初回は空の場合があります。上の「更新」を押すと取得を再試行します）
            </li>
          )}
        </ul>

        <div className="mt-3 flex flex-wrap gap-2">
          {Math.max(visible, VISIBLE_DEFAULT) < allNews.length && (
            <button
              onClick={() => setVisible((v) => v + LOAD_MORE_STEP)}
              className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            >
              もっと見る（+{LOAD_MORE_STEP}件）
            </button>
          )}
          {allNews.length > 0 && Math.max(visible, VISIBLE_DEFAULT) < allNews.length && (
            <button
              onClick={() => setVisible(9999)}
              className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            >
              すべて表示（{allNews.length}件）
            </button>
          )}
          {allNews.length > VISIBLE_DEFAULT && (
            <button
              onClick={() => setVisible(VISIBLE_DEFAULT)}
              className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
            >
              最新5件のみ
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3">
          ※ 見出し・リンク・日付のみ表示（本文転載なし）。情報源は国交省・経産省などの公式RSS。失敗時は前回キャッシュを表示します。
        </p>
      </section>

      {/* 📋 対応タスクリスト */}
      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">📋 対応タスクリスト / Compliance Tasks</h2>
          <div className="text-sm text-gray-500">達成率: {doneRate}%</div>
        </div>

        {/* ドライバー選択 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600">ドライバー:</label>
          <select
            className="border rounded px-3 py-2"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
          >
            <option value="">-- 選択してください --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || d.id}
              </option>
            ))}
          </select>

          {isAdmin && (
            <button
              onClick={clearAll}
              disabled={!tasks.length}
              className="ml-auto px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
              title="選択中ドライバーの全タスク削除"
            >
              全削除
            </button>
          )}
        </div>

        {/* 追加フォーム（管理者のみ & ドライバー選択時） */}
        {isAdmin && selectedDriverId && (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-2">
            <input
              className="border rounded px-3 py-2 md:col-span-2"
              placeholder="タスク名（必須）"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="法令タグ 例: 電帳法"
              value={form.lawTag || ""}
              onChange={(e) => setForm((f) => ({ ...f, lawTag: e.target.value }))}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="担当 例: 管理部"
              value={form.owner || ""}
              onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="期限 YYYY-MM-DD"
              value={form.due || ""}
              onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!form.label.trim()) return alert("タスク名は必須です");
                  addTask({ ...form, done: false });
                  setForm({
                    label: "",
                    done: false,
                    excluded: false,
                    lawTag: "",
                    owner: "",
                    due: "",
                    note: "",
                    tplId: undefined,
                  });
                }}
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus size={16} /> 追加
              </button>
            </div>
            <textarea
              className="border rounded px-3 py-2 md:col-span-6"
              placeholder="メモ（任意）"
              value={form.note || ""}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
            />
          </div>
        )}

        {/* タスクリスト */}
        {!selectedDriverId && (
          <p className="text-gray-500">ドライバーを選択すると、そのドライバーのタスクが表示されます。</p>
        )}

        {selectedDriverId && (
          <ul className="space-y-3">
            {tasks.map((t) => {
              const strike = t.excluded || t.done;
              return (
                <li key={t.id} className="flex items-start gap-3">
                  <button onClick={() => toggleTask(t)} aria-label="toggle" className="mt-0.5">
                    {t.done ? (
                      <CheckCircle className="text-green-500" size={20} />
                    ) : (
                      <Clock4 className="text-yellow-500" size={20} />
                    )}
                  </button>

                  <div className="flex-1">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={t.done || false}
                        onChange={() => toggleTask(t)}
                        disabled={t.excluded === true} // 対象外の時は完了チェックを無効化してもよい
                      />
                      <span className={strike ? "line-through text-gray-400" : ""}>{t.label}</span>
                    </label>

                    <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                      {t.lawTag && <span>#{t.lawTag}</span>}
                      {t.owner && <span>担当: {t.owner}</span>}
                      {t.due && <span>期限: {t.due}</span>}
                    </div>

                    {t.note && <div className="text-xs text-gray-500 mt-1">{t.note}</div>}

                    {/* 対象外トグル */}
                    <div className="mt-1 text-xs">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.excluded || false}
                          onChange={() => toggleExcluded(t)}
                        />
                        <span>対象外</span>
                      </label>
                    </div>
                  </div>

                  {/* 削除（管理者のみ） */}
                  {isAdmin && (
                    <button
                      onClick={() => removeTask(t.id)}
                      className="text-red-600 hover:text-red-800 mt-0.5"
                      title="タスクを削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </li>
              );
            })}
            {tasks.length === 0 && <li className="text-gray-500">タスクはまだありません。</li>}
          </ul>
        )}
      </section>

      {/* 📂 保存期間ガイド */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="text-xl font-semibold mb-3">📂 保存記録ガイド / Record Retention Guide</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border text-left">書類名 / Document</th>
                <th className="px-4 py-2 border text-left">保存期間 / Retention</th>
                <th className="px-4 py-2 border text-left">関連法令 / Related Law</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "請求書・領収書 / Invoices & Receipts", period: "7年 / 7 years", law: "電子帳簿保存法" },
                { name: "契約書・見積書 / Contracts & Estimates", period: "7年 / 7 years", law: "法人税法 他" },
                { name: "賃金台帳・出勤簿 / Wage & Attendance Books", period: "3年 / 3 years", law: "労働基準法" },
                { name: "労働者名簿 / Employee Registry", period: "3年 / 3 years", law: "労働基準法" },
                { name: "点呼記録・運転日報 / Driving Logs & Check Records", period: "1年 / 1 year", law: "運送法・安全規則" },
                { name: "事故記録 / Accident Records", period: "3年 / 3 years", law: "運送法" },
              ].map((doc, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{doc.name}</td>
                  <td className="px-4 py-2 border">{doc.period}</td>
                  <td className="px-4 py-2 border">{doc.law}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
