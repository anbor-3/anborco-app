import { useEffect, useMemo, useState, useCallback } from 'react';
import { CheckCircle, Clock4, RotateCw, Trash2, Plus, ShieldCheck } from 'lucide-react';
import { auth, db } from './firebaseClient';
import { collection, addDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

/* ===================== Types ===================== */
type NewsItem = { title: string; link: string; source: string; isoDate: string };
type Task = {
  id?: string;                 // Firestore doc id
  label: string;
  done: boolean;
  lawTag?: string;
  owner?: string;
  due?: string;                // YYYY-MM-DD
  note?: string;
  createdAt?: any;
};

/* ===================== News helpers ===================== */
const NEWS_CACHE_KEY = 'compliance_news_cache_v1';
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
    localStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({ items, savedAt: Date.now() })
    );
  } catch {}
}

export default function AdminToDoTasks() {
  /* ===================== 認証・会社・権限 ===================== */
  const [uid, setUid] = useState<string>('');
  const [company, setCompany] = useState<string>('default');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUid(u.uid);
      // 自分のユーザープロフィールから company と role を取得
      const meSnap = await getDoc(doc(db, 'users', u.uid));
      const me = meSnap.exists() ? (meSnap.data() as any) : {};
      const co = me?.company || localStorage.getItem('company') || 'default';
      setCompany(co);
      setIsAdmin(String(me?.role || '').toLowerCase().includes('admin'));
    });
    return () => unsub();
  }, []);

  /* ===================== ニュース ===================== */
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [visible, setVisible] = useState<number>(VISIBLE_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tzDate = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  const normalizeAndSort = (items: any[]): NewsItem[] => {
    const mapped = (items || []).map((n: any) => ({
      title: String(n?.title || '').trim(),
      link: String(n?.link || '').trim(),
      source: String(n?.source || 'RSS'),
      isoDate: n?.isoDate || n?.pubDate || new Date().toISOString(),
    }));
    mapped.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
    return mapped;
  };

  const fetchFromApi = async () => {
    const sources = [
   'https://www.mlit.go.jp/road/ir/ir-data/rss.xml',        // 国交省 道路関連
   'https://www.meti.go.jp/english/rss/index.xml',          // 経産省 英語RSS
 ];
 // rss2json 経由でCORS回避（※レート制限に注意）
 const calls = sources.map(u =>
   fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(u)}`, { cache: 'no-store' })
     .then(res => res.ok ? res.json() : Promise.reject(res.status))
     .then(j => (j.items || []).map((it:any) => ({
       title: it.title,
       link: it.link,
       source: j?.feed?.title || 'RSS',
       isoDate: it.pubDate || it.isoDate || new Date().toISOString(),
     })))
 );
 const settled = await Promise.allSettled(calls);
 const merged = settled.flatMap(s => s.status === 'fulfilled' ? s.value : []);
 if (!merged.length) throw new Error('rss2json failed');
 const mergedSorted = merged.sort(
  (a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime()
);
return normalizeAndSort(mergedSorted);
  };

  const fetchFallback = async () => {
    const FEEDS = [
      'https://www.mlit.go.jp/road/ir/ir-data/rss.xml',
      'https://www.meti.go.jp/english/rss/index.xml',
    ];
    const calls = FEEDS.map(async (url) => {
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('rss2json failed');
      const j = await res.json();
      const siteTitle = j?.feed?.title || 'RSS';
      return (j?.items || []).map((it: any) => ({
        title: it.title,
        link: it.link,
        source: siteTitle,
        isoDate: it.pubDate || it.isoDate || new Date().toISOString(),
      })) as NewsItem[];
    });
    const results = await Promise.allSettled(calls);
    const merged: NewsItem[] = [];
    results.forEach((p) => {
      if (p.status === 'fulfilled') merged.push(...p.value);
    });
    return normalizeAndSort(merged);
  };

  const loadNews = useCallback(async () => {
    setVisible(VISIBLE_DEFAULT);
    setLoading(true);
    setErr(null);
    try {
      // 1) API
      const items = await fetchFromApi();
      if (items.length > 0) {
        setAllNews(items);
        writeNewsCache(items);
        return;
      }
      // 2) APIが空ならフォールバック
      const fb = await fetchFallback();
      if (fb.length > 0) {
        setAllNews(fb);
        writeNewsCache(fb);
        return;
      }
      // 3) どちらも空 → 最後にキャッシュ
      const cache = readNewsCache();
      setAllNews(cache);
      if (cache.length === 0) setErr('ニュースが見つかりませんでした');
    } catch (e) {
      console.error('[news] failed', e);
      // 失敗時はキャッシュを表示（“常に5件”を担保）
      const cache = readNewsCache();
      setAllNews(cache);
      if (cache.length === 0) setErr('ニュース取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回：キャッシュを即表示→非同期で最新取得
  useEffect(() => {
    const cache = readNewsCache();
    if (cache.length > 0) setAllNews(cache);
    setVisible(VISIBLE_DEFAULT);
    loadNews();
  }, [loadNews]);

  /* ===================== タスク（Firestore・会社別） ===================== */
  const [tasks, setTasks] = useState<Task[]>([]);

  // テンプレ
  const TEMPLATE: Task[] = [
    { label: '電子帳簿保存法：スキャナ保存・検索要件の定着', done: true,  lawTag: '電帳法',         owner: '管理部', note: '検索要件（⽇付・⾦額・取引先）...' },
    { label: '運転者の労働時間改善（点呼・休息・拘束時間の順守）', done: false, lawTag: '労基法/改善基準', owner: '運行管理', note: 'アルコール検知記録の保存...' },
    { label: '安全管理者の選任・届出・講習受講',                 done: false, lawTag: '道路運送法',     owner: '総務' },
    { label: '点呼記録・運転日報・事故記録の保存期間整備',       done: false, lawTag: '運送法/安全規則', owner: '運行管理', note: '日報1年、事故3年 など' },
    { label: '燃料税/補助制度の適用チェック',                     done: false, lawTag: '租特/エネ政策',   owner: '経理' },
  ];

  // 購読
  useEffect(() => {
    if (!company) return;
    const qCol = query(
      collection(db, 'companies', company, 'complianceTasks'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(qCol, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Task[];
      setTasks(list);
    });
    return () => unsub();
  }, [company]);

  // 追加
  const addTask = async (t: Omit<Task, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'companies', company, 'complianceTasks'), {
      ...t,
      createdAt: serverTimestamp(),
    });
  };

  // 削除（管理者のみ）
  const removeTask = async (id?: string) => {
    if (!id) return;
    await deleteDoc(doc(db, 'companies', company, 'complianceTasks', id));
  };

  // 完了トグル（全員可）
  const toggleTask = async (t: Task) => {
    if (!t.id) return;
    await updateDoc(doc(db, 'companies', company, 'complianceTasks', t.id), {
      done: !t.done,
    });
  };

  // テンプレ投入（管理者のみ）
  const loadTemplate = async () => {
    if (!isAdmin) return;
    if (!confirm('現在のタスクにテンプレートを追加します。よろしいですか？')) return;
    for (const t of TEMPLATE) await addTask(t);
  };

  // 一括削除（管理者のみ）
  const clearAll = async () => {
    if (!isAdmin) return;
    if (!confirm('全タスクを削除します。元に戻せません。よろしいですか？')) return;
    const delAll = tasks.map(t => t.id && deleteDoc(doc(db, 'companies', company, 'complianceTasks', t.id)));
    await Promise.all(delAll);
  };

  // 追加フォーム
  const [form, setForm] = useState<Omit<Task, 'id' | 'createdAt'>>({
    label: '', done: false, lawTag: '', owner: '', due: '', note: ''
  });

  const doneRate = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
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

        {/* 常に最新5件（＋拡張） */}
        <ul className="divide-y">
          {(allNews.slice(0, Math.max(visible, VISIBLE_DEFAULT))).map((n, i) => (
            <li key={`${n.link}-${i}`} className="py-3">
              <a className="text-blue-700 underline font-medium" href={n.link} target="_blank" rel="noopener noreferrer">
                {n.title}
              </a>
              <div className="text-xs text-gray-500 mt-1">
                {n.source} ・ {tzDate(n.isoDate)}
              </div>
            </li>
          ))}
          {allNews.length === 0 && !loading && (
            <li className="py-3 text-gray-500">（キャッシュがないため初回は空の場合があります。上の「更新」を押すと取得を再試行します）</li>
          )}
        </ul>

        {/* 操作 */}
        <div className="mt-3 flex flex-wrap gap-2">
          {Math.max(visible, VISIBLE_DEFAULT) < allNews.length && (
            <button
              onClick={() => setVisible(v => v + LOAD_MORE_STEP)}
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">📋 対応タスクリスト / Compliance Tasks</h2>
          <div className="text-sm text-gray-500">達成率: {doneRate}%</div>
        </div>

        {/* 管理者操作 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {isAdmin && (
            <>
              <span className="inline-flex items-center text-emerald-700 text-sm font-medium">
                <ShieldCheck size={16} className="mr-1" /> 管理者モード
              </span>
              <button
                onClick={loadTemplate}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
              >
                テンプレ読込
              </button>
              <button
                onClick={clearAll}
                className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
              >
                全削除
              </button>
            </>
          )}
        </div>

        {/* 追加フォーム（管理者のみ） */}
        {isAdmin && (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-2">
            <input
              className="border rounded px-3 py-2 md:col-span-2"
              placeholder="タスク名（必須）"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="法令タグ 例: 電帳法"
              value={form.lawTag || ''}
              onChange={e => setForm(f => ({ ...f, lawTag: e.target.value }))}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="担当 例: 管理部"
              value={form.owner || ''}
              onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="期限 YYYY-MM-DD"
              value={form.due || ''}
              onChange={e => setForm(f => ({ ...f, due: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!form.label.trim()) return alert('タスク名は必須です');
                  addTask({ ...form, done: false });
                  setForm({ label: '', done: false, lawTag: '', owner: '', due: '', note: '' });
                }}
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus size={16} /> 追加
              </button>
            </div>
            <textarea
              className="border rounded px-3 py-2 md:col-span-6"
              placeholder="メモ（任意）"
              value={form.note || ''}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={2}
            />
          </div>
        )}

        {/* タスクリスト */}
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3">
              <button onClick={() => toggleTask(t)} aria-label="toggle" className="mt-0.5">
                {t.done ? <CheckCircle className="text-green-500" size={20} /> : <Clock4 className="text-yellow-500" size={20} />}
              </button>
              <div className="flex-1">
                <label className="inline-flex items-center">
                  <input type="checkbox" className="mr-2" checked={t.done} onChange={() => toggleTask(t)} />
                  <span className={t.done ? 'line-through text-gray-500' : ''}>{t.label}</span>
                </label>
                <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                  {t.lawTag && <span>#{t.lawTag}</span>}
                  {t.owner && <span>担当: {t.owner}</span>}
                  {t.due && <span>期限: {t.due}</span>}
                </div>
                {t.note && <div className="text-xs text-gray-500 mt-1">{t.note}</div>}
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
          ))}
          {tasks.length === 0 && (
            <li className="text-gray-500">タスクはまだありません。</li>
          )}
        </ul>
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
                { name: '請求書・領収書 / Invoices & Receipts', period: '7年 / 7 years', law: '電子帳簿保存法' },
                { name: '契約書・見積書 / Contracts & Estimates', period: '7年 / 7 years', law: '法人税法 他' },
                { name: '賃金台帳・出勤簿 / Wage & Attendance Books', period: '3年 / 3 years', law: '労働基準法' },
                { name: '労働者名簿 / Employee Registry', period: '3年 / 3 years', law: '労働基準法' },
                { name: '点呼記録・運転日報 / Driving Logs & Check Records', period: '1年 / 1 year', law: '運送法・安全規則' },
                { name: '事故記録 / Accident Records', period: '3年 / 3 years', law: '運送法' },
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
