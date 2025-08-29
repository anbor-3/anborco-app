// src/pages/AdminDashboard.tsx
// Neon (Postgres) 側の REST API を叩く前提。
// ・formStats は英字(PO/PS/INV)でも日本語でも OK（toJpType + safeGetNumber で吸収）
// ・Auth 付き fetch（Firebase ID トークン）
// ・欠損値に強いフォールバック

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { safeGetNumber } from "@/utils/formType";

type StatusList = { active: string[]; break: string[]; end: string[] };
type ShiftStatus = { registered: string[]; unregistered: string[] };

type DashboardApiResponse = Partial<{
  unsubmittedCount: number;
  activeTodayCount: number;
  registeredDriverCount: number;
  formStats: Record<string, number> | null; // 例: { PO: 3, PS: 1, INV: 0 } or 日本語キー
  latestReports: Array<{ date: string; name: string; status: string }>;
  statusList: StatusList;
  alerts: string[];
  shiftStatus: ShiftStatus;
}>;

export default function AdminDashboard() {
  const [unsubmittedCount, setUnsubmittedCount] = useState(0);
  const [activeTodayCount, setActiveTodayCount] = useState(0);
  const [registeredDriverCount, setRegisteredDriverCount] = useState(0);

  // formStats は任意キーの辞書に（undefined 許容）。UI 側で safeGetNumber を使用。
  const [formStats, setFormStats] = useState<Record<string, number> | undefined>(undefined);

  const [latestReports, setLatestReports] = useState<DashboardApiResponse["latestReports"]>([]);
  const [statusList, setStatusList] = useState<StatusList>({ active: [], break: [], end: [] });
  const [alerts, setAlerts] = useState<string[]>([]);
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>({ registered: [], unregistered: [] });

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  useEffect(() => {
    (async () => {
      const company = localStorage.getItem("company") || "demoCompany";

      // 登録ドライバー数（ローカルの既存データがあれば利用）
      try {
        const driverList = JSON.parse(localStorage.getItem(`driverList_${company}`) || "[]");
        if (Array.isArray(driverList)) setRegisteredDriverCount(driverList.length);
      } catch {}

      try {
        const idToken = await getAuth().currentUser?.getIdToken();
        const res = await fetch(
          `/api/dashboardStats?company=${encodeURIComponent(company)}&date=${today}&month=${currentMonth}`,
          { headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined }
        );

        if (!res.ok) throw new Error(`GET /api/dashboardStats -> ${res.status}`);
        const data: DashboardApiResponse = await res.json();

        setUnsubmittedCount(data.unsubmittedCount ?? 0);
        setFormStats((data.formStats ?? undefined) || undefined);

        // 稼働人数：API が返さない場合は statusList.active 長さにフォールバック
        const nextStatus: StatusList = {
          active: data.statusList?.active ?? [],
          break: data.statusList?.break ?? [],
          end: data.statusList?.end ?? [],
        };
        setStatusList(nextStatus);

        const activeCount = data.activeTodayCount ?? nextStatus.active.length ?? 0;
        setActiveTodayCount(activeCount);

        setLatestReports(Array.isArray(data.latestReports) ? data.latestReports : []);
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        setShiftStatus({
          registered: data.shiftStatus?.registered ?? [],
          unregistered: data.shiftStatus?.unregistered ?? [],
        });

        // API が総ドライバー数を返す場合は上書き
        if (typeof data.registeredDriverCount === "number") {
          setRegisteredDriverCount(data.registeredDriverCount);
        }
      } catch (err) {
        console.error("Neon API fetch failed:", err);
        // 失敗時でも既存 state を維持（画面は落とさない）
      }
    })();
  }, [today, currentMonth]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen space-y-10">
      <h1 className="text-3xl font-bold">📊 管理者ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="bg-white border-l-8 border-green-500 shadow p-6 rounded-lg">
          <h2 className="text-gray-600 text-lg mb-2">📅 今日の稼働状況</h2>
          <p className="text-4xl font-bold text-green-600">
            {activeTodayCount} / {registeredDriverCount} 名
          </p>
        </div>

        <div className="bg-white border-l-8 border-red-500 shadow p-6 rounded-lg">
          <h2 className="text-gray-600 text-lg mb-2">🚛 未提出・差し戻し日報</h2>
          <p className="text-4xl font-bold text-red-500">{unsubmittedCount} 件</p>
        </div>

        <div className="bg-white border-l-8 border-blue-500 shadow p-6 rounded-lg">
          <h2 className="text-gray-600 text-lg mb-2">📄 今月の帳票作成</h2>
          <div className="text-xl text-blue-600 space-y-1">
            {/* ✅ 直接 formStats.PO を読まずに safeGetNumber を使用 */}
            <p>発注書：<strong>{safeGetNumber(formStats, "PO")}</strong> 件</p>
            <p>支払明細：<strong>{safeGetNumber(formStats, "PS")}</strong> 件</p>
            <p>請求書：<strong>{safeGetNumber(formStats, "INV")}</strong> 件</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow p-6 rounded-lg border-l-4 border-indigo-400">
        <h2 className="text-gray-600 text-lg mb-4">📥 最新提出物（直近5件）</h2>
        <ul className="text-md space-y-2">
          {(latestReports ?? []).map((r, idx) => (
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
