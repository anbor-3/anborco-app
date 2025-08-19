import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock4, FileText, BookOpen, RotateCw } from 'lucide-react';

type NewsItem = { title: string; link: string; source: string; isoDate: string };

export default function AdminToDoTasks() {
  // --- ニュース ---
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadNews() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/compliance-news', { cache: 'no-store' });
      if (!r.ok) throw new Error('failed: ' + r.status);
      const data = await r.json();
      setNews(data.items || []);
    } catch (e:any) {
      setErr('ニュース取得に失敗しました');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadNews(); }, []);
  const tzDate = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });

  // --- タスク（充実版） ---
  type Task = {
    id: string;
    label: string;
    done: boolean;
    lawTag?: string;
    owner?: string;
    due?: string; // YYYY-MM-DD
    note?: string;
  };

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'e-doc',
      label: '電子帳簿保存法：スキャナ保存・検索要件の定着',
      done: true,
      lawTag: '電帳法',
      owner: '管理部',
      note: '検索要件：日付・金額・取引先。保存要件の年次棚卸も継続。',
    },
    {
      id: 'worktime',
      label: '運転者の労働時間改善（点呼・休息・拘束時間の順守）',
      done: false,
      lawTag: '労基法/改善基準',
      owner: '運行管理',
      due: '',
      note: 'アルコール検知記録の保存・日報との突合。',
    },
    {
      id: 'safety-mgr',
      label: '安全管理者（運行管理的役割）の選任・届出・講習受講',
      done: false,
      lawTag: '道路運送法/安全規則',
      owner: '総務',
    },
    {
      id: 'logs',
      label: '点呼記録・運転日報・事故記録の様式統一と保存期間の設定',
      done: false,
      lawTag: '運送法/安全規則',
      owner: '運行管理',
      note: '日報1年、事故3年 等の保存年限をシステムに反映。',
    },
    {
      id: 'fuel-tax',
      label: '燃料関連（軽油・ガソリン等）の税・補助制度の適用チェック',
      done: false,
      lawTag: '租税特別措置/エネ政策',
      owner: '経理',
      note: '請求書表記・適用期間・証憑の保管確認。',
    },
  ]);

  const toggleTask = (id: string) =>
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, done: !t.done } : t)));

  const doneRate = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    return total ? Math.round((done / total) * 100) : 0;
  }, [tasks]);

  const preservationList = [
    { name: '請求書・領収書 / Invoices & Receipts', period: '7年 / 7 years', law: '電子帳簿保存法' },
    { name: '契約書・見積書 / Contracts & Estimates', period: '7年 / 7 years', law: '法人税法 他' },
    { name: '賃金台帳・出勤簿 / Wage & Attendance Books', period: '3年 / 3 years', law: '労働基準法' },
    { name: '労働者名簿 / Employee Registry', period: '3年 / 3 years', law: '労働基準法' },
    { name: '点呼記録・運転日報 / Driving Logs & Check Records', period: '1年 / 1 year', law: '運送法・安全規則' },
    { name: '事故記録 / Accident Records', period: '3年 / 3 years', law: '運送法' },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* タイトル */}
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        📚 法改正ダッシュボード <span className="text-base text-gray-500">/ Law Compliance Dashboard</span>
      </h1>

      {/* 🔥 最新ニュース（燃料・運送・制度改正） */}
      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            📰 最新ニュース（燃料・運送の法令等） / Latest Regulatory News
          </h2>
          <button
            onClick={loadNews}
            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
            title="手動更新"
          >
            <RotateCw size={16} /> 更新
          </button>
        </div>

        {loading && <p className="text-gray-500">読み込み中…</p>}
        {err && <p className="text-red-600">{err}</p>}

        {!loading && !err && (
          <ul className="divide-y">
            {news.map((n, i) => (
              <li key={i} className="py-3">
                <a className="text-blue-700 underline font-medium" href={n.link} target="_blank" rel="noopener noreferrer">
                  {n.title}
                </a>
                <div className="text-xs text-gray-500 mt-1">
                  {n.source} ・ {tzDate(n.isoDate)}
                </div>
              </li>
            ))}
            {news.length === 0 && (
              <li className="py-3 text-gray-500">該当ニュースはまだありません。</li>
            )}
          </ul>
        )}

        <p className="text-xs text-gray-500 mt-3">
          ※ 見出し・リンク・日付のみ表示（本文転載なし）。情報源：国土交通省・経済産業省の公式RSS。
        </p>
      </section>

      {/* 📋 対応タスクリスト */}
      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            📋 対応タスクリスト / Compliance Tasks
          </h2>
          <div className="text-sm text-gray-500">達成率: {doneRate}%</div>
        </div>
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3">
              <button onClick={() => toggleTask(t.id)} aria-label="toggle" className="mt-0.5">
                {t.done ? <CheckCircle className="text-green-500" size={20} /> : <Clock4 className="text-yellow-500" size={20} />}
              </button>
              <div>
                <label className="inline-flex items-center">
                  <input type="checkbox" className="mr-2" checked={t.done} onChange={() => toggleTask(t.id)} />
                  <span className={t.done ? 'line-through text-gray-500' : ''}>{t.label}</span>
                </label>
                <div className="text-xs text-gray-500 mt-0.5">
                  {t.lawTag && <span className="mr-2">#{t.lawTag}</span>}
                  {t.owner && <span className="mr-2">担当: {t.owner}</span>}
                  {t.due && <span>期限: {t.due}</span>}
                </div>
                {t.note && <div className="text-xs text-gray-500 mt-1">{t.note}</div>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 📂 保存期間ガイド */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          📂 保存記録ガイド / Record Retention Guide
        </h2>
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
                ...[{ name: '請求書・領収書 / Invoices & Receipts', period: '7年 / 7 years', law: '電子帳簿保存法' }],
                ...[{ name: '契約書・見積書 / Contracts & Estimates', period: '7年 / 7 years', law: '法人税法 他' }],
                ...[{ name: '賃金台帳・出勤簿 / Wage & Attendance Books', period: '3年 / 3 years', law: '労働基準法' }],
                ...[{ name: '労働者名簿 / Employee Registry', period: '3年 / 3 years', law: '労働基準法' }],
                ...[{ name: '点呼記録・運転日報 / Driving Logs & Check Records', period: '1年 / 1 year', law: '運送法・安全規則' }],
                ...[{ name: '事故記録 / Accident Records', period: '3年 / 3 years', law: '運送法' }],
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

      {/* 📎 リンク（変えずに継承） */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          📎 書類テンプレート・様式リンク / Templates & Resources
        </h2>
        <ul className="list-disc pl-5 text-blue-600 underline space-y-2">
          <li>
            <a href="https://www.mlit.go.jp/jidosha/jidosha_tk2_000172.html#kanrisya" target="_blank" rel="noopener noreferrer">
              貨物軽自動車安全管理者の届出様式（国交省リンク）
            </a>
          </li>
          <li>
            <a href="https://www.mlit.go.jp/jidosha/jidosha_tk2_000173.html" target="_blank" rel="noopener noreferrer">
              講習登録機関一覧（定期講習・新任講習）
            </a>
          </li>
          <li>
            <a href="https://www.mlit.go.jp/jidosha/content/001768524.pdf" target="_blank" rel="noopener noreferrer">
              解説リーフレットPDF（国土交通省）
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
