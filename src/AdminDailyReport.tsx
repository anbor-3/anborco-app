// src/pages/AdminDailyReport.tsx
import { useState, useEffect, useMemo } from 'react';
import { getAuth } from 'firebase/auth';

interface Report {
  id: string;
  company: string;
  name: string;
  date: string;
  temperature: 'OK' | 'NG';
  alcohol: 'OK' | 'NG';
  start: string;
  breakStart: string;
  breakEnd: string;
  end: string;
  distanceBefore: number;
  distanceAfter: number;
  status?: string; // submitted / returned / approved など
}

// ===== デモ判定 =====
const loginId = localStorage.getItem("loginId") || "";
const isDemo = false;
const sampleReports: Report[] = [];

// ===== 進捗計算（どこまで入力されたか） =====
function computeProgress(r: Report) {
  // ステップ: 体温/アルコール/稼働開始/休憩開始/休憩終了/稼働終了/距離入力
  const steps = [
    r.temperature ? 1 : 0,
    r.alcohol ? 1 : 0,
    r.start ? 1 : 0,
    r.breakStart ? 1 : 0,
    r.breakEnd ? 1 : 0,
    r.end ? 1 : 0,
    (Number.isFinite(r.distanceBefore) && Number.isFinite(r.distanceAfter)) ? 1 : 0,
  ];
  const done = steps.reduce((a, b) => a + b, 0);
  const total = steps.length;
  const percent = Math.round((done / total) * 100);

  // 状態ピル用のラベル
  let phase: '勤務中' | '休憩中' | '復帰中' | '帰庫済' = '勤務中';
  if (r.end) phase = '帰庫済';
  else if (r.breakStart && !r.breakEnd) phase = '休憩中';
  else if (r.breakEnd && !r.end) phase = '復帰中';

  return { percent, phase };
}

// 稼働中の定義：start 入力済み && end が空
function isActive(r: Report) {
  return !!r.start && !r.end;
}

export default function AdminDailyReport() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Report> | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const POLL_MS = 10000; // 10秒ごとにリアルタイム更新

  const fieldLabels: { [key: string]: string } = {
    date: "日付",
    start: "稼働開始",
    breakStart: "休憩開始",
    breakEnd: "休憩終了",
    end: "稼働終了",
  };

  // ===== 取得（初回 + ポーリング）=====
  useEffect(() => {
    if (isDemo) return; // デモ時は固定

    let timer: number | undefined;

    const fetchReports = async () => {
      try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        const res = await fetch("/api/daily-reports", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
   const ct = res.headers.get("content-type") || "";
   if (!ct.includes("application/json")) throw new Error("Non-JSON response");
        const data: Report[] = await res.json();
        setReports(data || []);
        setLastUpdatedAt(new Date().toLocaleTimeString());
      } catch (e) {
        // 失敗時は前回データ維持（無音）
      }
    };

    fetchReports();
    timer = window.setInterval(fetchReports, POLL_MS) as unknown as number;

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

  // 表示用の配列（デモならサンプル、通常は取得データ）
  const all = isDemo ? sampleReports : reports;

  // 稼働中のみ表示
  const activeOnly = useMemo(() => all.filter(isActive), [all]);

  const handleStatusUpdate = async (id: string, newStatus: "returned" | "approved") => {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) { alert("未ログインです"); return; }

    if (newStatus === "returned") {
      await fetch("/api/daily-reports/return", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ reportId: id, reason: "" }),
      });
    } else if (newStatus === "approved") {
      const r = all.find(r => r.id === id);
      if (!r) return;

      await fetch("/api/daily-reports/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          reports: [{
            id: r.id,
            date: r.date,
            status: "approved",
            company: r.company,
            name: r.name,
            temperature: r.temperature,
            alcohol: r.alcohol,
            start: r.start,
            breakStart: r.breakStart,
            breakEnd: r.breakEnd,
            end: r.end,
            distanceBefore: r.distanceBefore,
            distanceAfter: r.distanceAfter,
          }]
        }),
      });
    }

    // 更新
    if (!isDemo) {
      const res = await fetch("/api/daily-reports", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data: Report[] = await res.json();
      setReports(data);
      setLastUpdatedAt(new Date().toLocaleTimeString());
    }
  };

  const handleSaveEdit = async () => {
    if (!editData?.id) return;

    const base = all.find(r => r.id === editData.id);
    if (!base) return;

    const merged = { ...base, ...editData };

    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) { alert("未ログインです"); return; }

    await fetch("/api/daily-reports/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        reports: [{
          id: merged.id,
          date: merged.date,
          status: merged.status || "submitted",
          company: merged.company,
          name: merged.name,
          temperature: merged.temperature,
          alcohol: merged.alcohol,
          start: merged.start,
          breakStart: merged.breakStart,
          breakEnd: merged.breakEnd,
          end: merged.end,
          distanceBefore: merged.distanceBefore,
          distanceAfter: merged.distanceAfter,
        }]
      }),
    });

    alert("保存しました。");
    setIsEditing(false);

    if (!isDemo) {
      const res = await fetch("/api/daily-reports", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data: Report[] = await res.json();
      setReports(data);
      setLastUpdatedAt(new Date().toLocaleTimeString());
    }
  };

  const showModal = (report: Report) => setSelected(report);
  const hideModal = () => setSelected(null);

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー：白文字問題を修正 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 tracking-wide">
  📋 <span className="align-middle">日報管理</span>
  <span className="ml-2 text-sm text-slate-500">- Active Driver Reports -</span>
</h1>
        <div className="flex items-center gap-3">
          {!isDemo && (
            <span className="text-xs text-gray-500">
              ⏱ 最終更新: {lastUpdatedAt || '—'}（自動更新 10秒）
            </span>
          )}
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
            onClick={() => {
              if (selected) {
                setEditData({ ...selected });
                setIsEditing(true);
              } else {
                alert("先に日報を選択してください（表示ボタン）");
              }
            }}
          >
            編集
          </button>
          <button
            className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
            onClick={async () => {
              if (!selected) {
                alert("差し戻す日報を選択してください（表示ボタン）");
                return;
              }
              if (window.confirm("この日報を差し戻しますか？\nドライバーに再提出を依頼します。")) {
                await handleStatusUpdate(selected.id, "returned");
                alert("差し戻しました。");
              }
            }}
          >
            差し戻し
          </button>
        </div>
      </div>

      {/* 稼働中のみ（ヘッダー項目は変更せず、UIを刷新） */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
        <table className="w-full text-sm border-separate border-spacing-y-0">
          <thead className="sticky top-0 bg-slate-50 text-left">
            <tr className="text-slate-700">
              <th className="p-3 font-semibold">ID</th>
              <th className="p-3 font-semibold">会社名</th>
              <th className="p-3 font-semibold">氏名</th>
              <th className="p-3 font-semibold">日付</th>
              <th className="p-3 font-semibold">体調管理</th>
              <th className="p-3 font-semibold">稼働開始</th>
              <th className="p-3 font-semibold">休憩開始</th>
              <th className="p-3 font-semibold">休憩終了</th>
              <th className="p-3 font-semibold">稼働終了</th>
              <th className="p-3 font-semibold">走行距離</th>
              <th className="p-3 font-semibold">ステータス</th>
              <th className="p-3 font-semibold text-center">詳細</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {activeOnly.length === 0 && (
              <tr>
                <td colSpan={12} className="p-6 text-center text-gray-500">
                  現在、稼働中のドライバーはいません。
                </td>
              </tr>
            )}

            {activeOnly.map((report) => {
              const { percent, phase } = computeProgress(report);
              const distanceFilled =
                Number.isFinite(report.distanceBefore) &&
                Number.isFinite(report.distanceAfter);
              const distance = distanceFilled
                ? Math.max(0, report.distanceAfter - report.distanceBefore)
                : null;

              return (
                <tr
                  key={report.id}
                  className="bg-white hover:bg-emerald-50 transition-colors"
                >
                  <td className="p-3 text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                      </span>
                      {report.id}
                    </div>
                  </td>
                  <td className="p-3 text-slate-800">{report.company}</td>
                  <td className="p-3 text-slate-800 font-medium">{report.name}</td>
                  <td className="p-3 text-slate-800">{report.date}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <span className={report.temperature === 'OK' ? 'text-emerald-700' : 'text-rose-700'}>
                        体温: {report.temperature}
                      </span>
                      <span className={report.alcohol === 'OK' ? 'text-emerald-700' : 'text-rose-700'}>
                        ｱﾙｺｰﾙ: {report.alcohol}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-800">{report.start || '—'}</td>
                  <td className="p-3 text-slate-800">{report.breakStart || '—'}</td>
                  <td className="p-3 text-slate-800">{report.breakEnd || '—'}</td>
                  <td className="p-3 text-slate-800">{report.end || '—'}</td>
                  <td className="p-3 text-slate-800">
                    {distance !== null ? `${distance} km` : '—'}
                  </td>

                  {/* ステータス列に「状態ピル + 進捗バー」を内包（ヘッダー項目は減らさない） */}
                  <td className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold " +
                          (phase === '休憩中'
                            ? 'bg-amber-100 text-amber-800'
                            : phase === '復帰中'
                            ? 'bg-blue-100 text-blue-800'
                            : phase === '帰庫済'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-emerald-100 text-emerald-800')
                        }
                      >
                        {phase}
                      </span>

                      {report.status === "returned" ? (
                        <span className="text-rose-700 text-xs font-semibold">差し戻し</span>
                      ) : report.status === "approved" ? (
                        <span className="text-emerald-700 text-xs font-semibold">承認済</span>
                      ) : report.status === "submitted" ? (
                        <span className="text-amber-700 text-xs font-semibold">再提出済</span>
                      ) : (
                        <span className="text-slate-500 text-xs">提出済</span>
                      )}
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${percent}%` }}
                        aria-label={`進捗 ${percent}%`}
                        title={`進捗 ${percent}%`}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{percent}%</div>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() => showModal(report)}
                      className="text-blue-600 hover:underline"
                    >
                      表示
                    </button>
                    {report.status === "submitted" && (
                      <button
                        onClick={async () => {
                          if (!window.confirm("この日報を承認しますか？")) return;
                          await handleStatusUpdate(report.id, "approved");
                          alert("✅ 日報を承認しました");
                        }}
                        className="ml-3 px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs"
                      >
                        承認
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 詳細モーダル */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow p-6 w-[90%] max-w-xl space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">日報詳細</h2>
            <p><strong>氏名：</strong>{selected.name}</p>
            <p><strong>会社名：</strong>{selected.company}</p>
            <p><strong>日付：</strong>{selected.date}</p>
            <p><strong>体温検査：</strong>{selected.temperature}</p>
            <p><strong>アルコール検査：</strong>{selected.alcohol}</p>
            <p><strong>稼働開始：</strong>{selected.start || '—'}</p>
            <p><strong>休憩開始：</strong>{selected.breakStart || '—'}</p>
            <p><strong>休憩終了：</strong>{selected.breakEnd || '—'}</p>
            <p><strong>稼働終了：</strong>{selected.end || '—'}</p>
            <p><strong>走行距離：</strong>{
              (Number.isFinite(selected.distanceBefore) && Number.isFinite(selected.distanceAfter))
                ? `${Math.max(0, selected.distanceAfter - selected.distanceBefore)} km`
                : '—'
            }</p>
            <div className="text-right">
              <button onClick={hideModal} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {isEditing && editData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow p-6 w-[90%] max-w-xl space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">📘 日報編集</h2>
            {["date", "start", "breakStart", "breakEnd", "end"].map(field => (
              <div key={field}>
                <label className="block text-sm text-gray-700">
                  {fieldLabels[field]}
                </label>
                <input
                  type={field === "date" ? "date" : "time"}
                  className="w-full p-2 border rounded"
                  value={(editData[field as keyof Report] as string) || ""}
                  onChange={(e) =>
                    setEditData(prev => ({ ...prev!, [field]: e.target.value }))
                  }
                />
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4">
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => setIsEditing(false)}
              >
                キャンセル
              </button>
              <button
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                onClick={handleSaveEdit}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
