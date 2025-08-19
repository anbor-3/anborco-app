import { useState, useEffect } from 'react';
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
  status?: string;
}

const loginId = localStorage.getItem("loginId") || "";
const sampleReports: Report[] = loginId === "demo" ? [
  {
    id: 'DRV-0001',
    company: '株式会社トライ物流',
    name: '佐藤 和真',
    date: '2025-04-19',
    temperature: 'OK',
    alcohol: 'NG',
    start: '08:00',
    breakStart: '12:00',
    breakEnd: '12:45',
    end: '18:00',
    distanceBefore: 35210,
    distanceAfter: 35590
  }
] : [];

export default function AdminDailyReport() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Report> | null>(null);

  const isDemo = loginId === "demo";

  const fieldLabels: { [key: string]: string } = {
    date: "日付",
    start: "稼働開始",
    breakStart: "休憩開始",
    breakEnd: "休憩終了",
    end: "稼働終了"
  };

  useEffect(() => {
  const fetchReports = async () => {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return; // 未ログイン時は何もしない

    const res = await fetch("/api/daily-reports", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data: Report[] = await res.json();
    setReports(data);
  };

  if (!isDemo) {
    fetchReports();
  }
}, [isDemo]);

  const handleStatusUpdate = async (id: string, newStatus: "returned" | "approved") => {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) { alert("未ログインです"); return; }

  if (newStatus === "returned") {
    // 差し戻しAPI
    await fetch("/api/daily-reports/return", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ reportId: id, reason: "" }),
    });
  } else if (newStatus === "approved") {
    // 承認は1件アップサートで反映
    const r = reports.find(r => r.id === id);
    if (!r) return;

    await fetch("/api/daily-reports/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        reports: [{
          id: r.id,
          driverId: r.id,          // ★暫定：driverIdが別にある場合は差し替えてOK
          date: r.date,
          status: "approved",
          // ついでに現在の値も保存（自由項目はサーバ側でJSONに入ります）
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

  // 再取得
  const res = await fetch("/api/daily-reports", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data: Report[] = await res.json();
  setReports(data);
};

  const handleSaveEdit = async () => {
  if (!editData?.id) return;

  const base = reports.find(r => r.id === editData.id);
  if (!base) return;

  const merged = { ...base, ...editData }; // 上書き後の1件

  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) { alert("未ログインです"); return; }

  await fetch("/api/daily-reports/save", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      reports: [{
        id: merged.id,
        driverId: merged.id,               // ★暫定：必要に応じて正しいdriverIdへ
        date: merged.date,
        status: merged.status || "submitted",
        // 任意項目（まとめてJSON保存）
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

  const res = await fetch("/api/daily-reports", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data: Report[] = await res.json();
  setReports(data);
};

  const showModal = (report: Report) => {
    setSelected(report);
  };

  const hideModal = () => {
    setSelected(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-green-800 tracking-wide shadow-sm">
          📋 日報管理 <span className="text-sm text-gray-500">- Driver Reports-</span>
        </h1>
        <div className="space-x-2">
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

      <table className="w-full text-sm border-separate border-spacing-y-2 bg-white rounded shadow border border-gray-300">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2">ID</th>
            <th>会社名</th>
            <th>氏名</th>
            <th>日付</th>
            <th>体調管理</th>
            <th>稼働開始</th>
            <th>休憩開始</th>
            <th>休憩終了</th>
            <th>稼働終了</th>
            <th>走行距離</th>
            <th>ステータス</th>
            <th className="text-center">詳細</th>
          </tr>
        </thead>
        <tbody>
          {(isDemo ? sampleReports : reports).map(report => (
            <tr key={report.id} className="border-b hover:bg-green-50 bg-white shadow-sm">
              <td className="p-2">{report.id}</td>
              <td>{report.company}</td>
              <td>{report.name}</td>
              <td>{report.date}</td>
              <td>
                <span className={report.temperature === 'OK' ? 'text-green-600' : 'text-red-600'}>体温: {report.temperature}</span><br />
                <span className={report.alcohol === 'OK' ? 'text-green-600' : 'text-red-600'}>ｱﾙｺｰﾙ: {report.alcohol}</span>
              </td>
              <td>{report.start}</td>
              <td>{report.breakStart}</td>
              <td>{report.breakEnd}</td>
              <td>{report.end}</td>
              <td>{report.distanceAfter - report.distanceBefore} km</td>
              <td>
                {report.status === "returned" ? (
                  <span className="text-red-600 font-semibold">差し戻し済</span>
                ) : report.status === "submitted" ? (
                  <span className="text-yellow-600 font-semibold">再提出済</span>
                ) : report.status === "approved" ? (
                  <span className="text-green-700 font-semibold">承認済</span>
                ) : (
                  <span className="text-gray-500">提出済</span>
                )}
              </td>
              <td className="text-center">
                <button onClick={() => showModal(report)} className="text-blue-600 hover:underline">表示</button>
              </td>
              {report.status === "submitted" && (
                <td className="text-center">
                  <button
                    onClick={async () => {
                      if (!window.confirm("この日報を承認しますか？")) return;
                      await handleStatusUpdate(report.id, "approved");
                      alert("✅ 日報を承認しました");
                    }}
                    className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    承認
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-[90%] max-w-xl space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">日報詳細</h2>
            <p><strong>氏名：</strong>{selected.name}</p>
            <p><strong>会社名：</strong>{selected.company}</p>
            <p><strong>日付：</strong>{selected.date}</p>
            <p><strong>体温検査：</strong>{selected.temperature}</p>
            <p><strong>アルコール検査：</strong>{selected.alcohol}</p>
            <p><strong>稼働開始：</strong>{selected.start}</p>
            <p><strong>休憩開始：</strong>{selected.breakStart}</p>
            <p><strong>休憩終了：</strong>{selected.breakEnd}</p>
            <p><strong>稼働終了：</strong>{selected.end}</p>
            <p><strong>走行距離：</strong>{selected.distanceAfter - selected.distanceBefore} km</p>
            <div className="text-right">
              <button onClick={hideModal} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {isEditing && editData && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-[90%] max-w-xl space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">📘 日報編集</h2>
            {["date", "start", "breakStart", "breakEnd", "end"].map(field => (
              <div key={field}>
                <label className="block text-sm text-gray-700">
                  {fieldLabels[field]}
                </label>
                <input
                  type={field === "date" ? "date" : "time"}
                  className="w-full p-2 border rounded"
                  value={editData[field as keyof Report] as string || ""}
                  onChange={(e) =>
                    setEditData(prev => ({ ...prev!, [field]: e.target.value }))
                  }
                />
              </div>
            ))}

            <div className="flex justify-end space-x-2 pt-4">
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => setIsEditing(false)}
              >
                キャンセル
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
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
