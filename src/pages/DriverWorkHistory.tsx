// ✅ DriverWorkHistory.tsx - Firebaseを除去し、Neon APIに置き換える準備
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

type HistoryEntry = {
  date: string;
  name: string;
  submittedAt: string;
  fileName: string;
  fileData: string; // base64 PDF
};

const DriverWorkHistory = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [showReSubmit, setShowReSubmit] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [reSubmitData, setReSubmitData] = useState({ fileName: "", fileData: "" });

  useEffect(() => {
    const loginId = localStorage.getItem("loginId") || "";
    const company = localStorage.getItem("company") || "";

    const fetchReturnedReports = async () => {
      try {
        const res = await fetch(`/api/daily-reports?userId=${loginId}&company=${company}`);
        const data = await res.json();
        setHistory(data);
      } catch (err) {
        console.error("日報の取得に失敗:", err);
      }
    };

    fetchReturnedReports();
  }, []);

  const handleDelete = (index: number) => {
    if (!window.confirm("この日報を削除してもよろしいですか？")) return;
    const updated = [...history];
    updated.splice(index, 1);
    setHistory(updated);
  };

  const handleReSubmit = async () => {
    if (selectedIndex === null) return;

    const updated = [...history];
    updated[selectedIndex] = {
      ...updated[selectedIndex],
      submittedAt: new Date().toLocaleString(),
      fileName: reSubmitData.fileName,
      fileData: reSubmitData.fileData,
    };
    setHistory(updated);
    setShowReSubmit(false);
    setSelectedIndex(null);
    setReSubmitData({ fileName: "", fileData: "" });

    try {
      const auth = getAuth();
const idToken = await auth.currentUser?.getIdToken();
if (!idToken) {
  alert("未ログインです");
  return;
}

await fetch("/api/daily-reports/resubmit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  },
  body: JSON.stringify({
    driverId: localStorage.getItem("loginId"),
    company: localStorage.getItem("company"),
    date: updated[selectedIndex].date,
    fileName: reSubmitData.fileName,
    fileData: reSubmitData.fileData,
  }),
});
      alert("✅ 再提出が完了しました");
    } catch (err) {
      console.error("再提出エラー:", err);
      alert("エラーが発生しました");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">📅 稼働履歴</h1>
      {history.length === 0 ? (
        <p className="text-gray-500">まだ日報の提出履歴はありません。</p>
      ) : (
        <ul className="space-y-4">
          {history.map((entry, index) => (
            <li key={index} className="p-3 border rounded shadow space-y-1">
              <p>📌 日付: {entry.date}</p>
              <p>🧑‍ ドライバー: {entry.name}</p>
              <p>🕐 提出時刻: {entry.submittedAt}</p>
              <p>📄 ファイル名: {entry.fileName}</p>

              {entry.submittedAt === "差し戻し対象" && (
                <button
                  onClick={() => {
                    setSelectedIndex(index);
                    setShowReSubmit(true);
                  }}
                  className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600"
                >
                  🔁 再提出
                </button>
              )}

              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => {
                    const src = entry.fileData.startsWith("data:") ? entry.fileData : `data:application/pdf;base64,${entry.fileData}`;
                    setPreviewSrc(src);
                  }}
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                >
                  📄 プレビュー
                </button>

                <button
                  onClick={() => {
                    const base64 = entry.fileData.startsWith("data:") ? entry.fileData : `data:application/pdf;base64,${entry.fileData}`;
                    const link = document.createElement("a");
                    link.href = base64;
                    link.download = entry.fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  ⬇ ダウンロード
                </button>

                <button
                  onClick={() => handleDelete(index)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  🗑 削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {previewSrc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">📄 日報プレビュー</h2>
              <button onClick={() => setPreviewSrc(null)} className="text-red-500 hover:underline">閉じる</button>
            </div>
            <iframe src={previewSrc} className="flex-1 w-full" />
          </div>
        </div>
      )}

      {showReSubmit && selectedIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-xl space-y-4">
            <h2 className="text-lg font-semibold">📤 再提出日報</h2>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setReSubmitData({
                    fileName: file.name,
                    fileData: reader.result as string,
                  });
                };
                reader.readAsDataURL(file);
              }}
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setShowReSubmit(false); setSelectedIndex(null); setReSubmitData({ fileName: "", fileData: "" }); }} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                キャンセル
              </button>
              <button onClick={handleReSubmit} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                再提出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverWorkHistory;
