import React, { useState } from 'react';
import { CheckCircle, Clock4, FileText, BookOpen } from 'lucide-react';

export default function AdminToDoTasks() {
  const [tasks, setTasks] = useState([
    { label: '電子帳簿保存法対応 / e-Document Compliance', done: true },
    { label: '労働時間管理体制の見直し / Worktime System Review', done: false },
    { label: '安全管理者の届出と講習受講 / Safety Manager Filing & Training', done: false },
    { label: '業務記録・事故記録の整備 / Work & Accident Logs Setup', done: false },
  ]);

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

      {/* ToDoリスト */}
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          📋 対応タスクリスト / Compliance Tasks
        </h2>
        <ul className="space-y-3">
          {tasks.map((t, i) => (
            <li key={i} className="flex items-center gap-2">
              {t.done ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : (
                <Clock4 className="text-yellow-500" size={20} />
              )}
              <label className="inline-flex items-center">
                <input type="checkbox" className="mr-2" checked={t.done} readOnly />
                <span className={t.done ? 'line-through text-gray-500' : ''}>{t.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* 保存期間ガイド */}
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
              {preservationList.map((doc, idx) => (
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

      {/* リンクテンプレート欄（オプション） */}
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
