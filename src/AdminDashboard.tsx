// 🔧 Firebase依存の部分をNeon API化する準備が必要な構成です
// 今回の目標：useEffect内のFirestore取得をREST API fetchに置き換えていく

import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [unsubmittedCount, setUnsubmittedCount] = useState(0);
  const [activeTodayCount, setActiveTodayCount] = useState(0);
  const [registeredDriverCount, setRegisteredDriverCount] = useState(0);
  const [formStats, setFormStats] = useState({ PO: 0, PS: 0, INV: 0 });
  const [latestReports, setLatestReports] = useState<any[]>([]);
  const [statusList, setStatusList] = useState<{ active: string[], break: string[], end: string[] }>({ active: [], break: [], end: [] });
  const [alerts, setAlerts] = useState<string[]>([]);
  const [shiftStatus, setShiftStatus] = useState<{ registered: string[], unregistered: string[] }>({ registered: [], unregistered: [] });

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  useEffect(() => {
    const fetchData = async () => {
      const company = localStorage.getItem("company") || "demoCompany";
      const loginId = localStorage.getItem("loginId") || "";
      const driverList = JSON.parse(localStorage.getItem(`driverList_${company}`) || "[]");
      setRegisteredDriverCount(driverList.length);

      try {
        const res = await fetch(`/api/dashboardStats?company=${company}&date=${today}&month=${currentMonth}`);
        const data = await res.json();

        setUnsubmittedCount(data.unsubmittedCount);
        setFormStats(data.formStats);
        setLatestReports(data.latestReports);
        setStatusList(data.statusList);
        setAlerts(data.alerts);
        setShiftStatus(data.shiftStatus);
      } catch (err) {
        console.error("Neon API fetch failed:", err);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    // NOTE: onSnapshot相当の更新監視は保留、リアルタイム性が不要なら削除してOK
  }, [today]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen space-y-10">
      <h1 className="text-3xl font-bold">📊 管理者ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="bg-white border-l-8 border-green-500 shadow p-6 rounded-lg">
          <h2 className="text-gray-600 text-lg mb-2">📅 今日の稼働状況</h2>
          <p className="text-4xl font-bold text-green-600">{activeTodayCount} / {registeredDriverCount} 名</p>
        </div>
        <div className="bg-white border-l-8 border-red-500 shadow p-6 rounded-lg">
          <h2 className="text-gray-600 text-lg mb-2">🚛 未提出・差し戻し日報</h2>
          <p className="text-4xl font-bold text-red-500">{unsubmittedCount} 件</p>
        </div>
        <div className="bg-white border-l-8 border-blue-500 shadow p-6 rounded-lg">
          <h2 className="text-gray-600 text-lg mb-2">📄 今月の帳票作成</h2>
          <div className="text-xl text-blue-600 space-y-1">
            <p>発注書：<strong>{formStats.PO}</strong> 件</p>
            <p>支払明細：<strong>{formStats.PS}</strong> 件</p>
            <p>請求書：<strong>{formStats.INV}</strong> 件</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow p-6 rounded-lg border-l-4 border-indigo-400">
        <h2 className="text-gray-600 text-lg mb-4">📥 最新提出物（直近5件）</h2>
        <ul className="text-md space-y-2">
          {latestReports.map((r, idx) => (
            <li key={idx} className="flex justify-between border-b pb-1">
              <span>{r.date} - {r.name}</span>
              <span className="text-sm text-gray-500">（{r.status}）</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white shadow p-6 rounded-lg border-l-4 border-green-400">
        <h2 className="text-gray-600 text-lg mb-4">🧑‍💼 稼働ステータス一覧</h2>
        <div className="grid grid-cols-3 gap-4 text-lg">
          <div>
            <p className="font-semibold text-green-600">✅ 稼働中</p>
            <ul className="text-sm">{statusList.active.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
          <div>
            <p className="font-semibold text-yellow-500">☕ 休憩中</p>
            <ul className="text-sm">{statusList.break.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
          <div>
            <p className="font-semibold text-gray-600">🚚 稼働終了</p>
            <ul className="text-sm">{statusList.end.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="shadow p-6 rounded-lg border-l-4 border-red-500 blink-box">
          <h2 className="text-red-700 text-lg font-bold mb-4">⚠️ アラート</h2>
          <ul className="space-y-2 text-md text-red-800">
            {alerts.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-yellow-50 shadow p-6 rounded-lg border-l-4 border-yellow-400">
        <h2 className="text-yellow-800 text-lg mb-4">🔄 今日のシフト登録状況</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="font-semibold text-green-600">✅ 登録済み</p>
            <ul className="text-sm text-gray-800">{shiftStatus.registered.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
          <div>
            <p className="font-semibold text-red-500">❌ 未登録</p>
            <ul className="text-sm text-gray-800">{shiftStatus.unregistered.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}