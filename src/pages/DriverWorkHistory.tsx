import React, { useEffect, useState } from "react";

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

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("driverHistory") || "[]");
    setHistory(data);
  }, []);

  const handleDelete = (index: number) => {
    if (!window.confirm("この日報を削除してもよろしいですか？")) return;
    const updated = [...history];
    updated.splice(index, 1);
    localStorage.setItem("driverHistory", JSON.stringify(updated));
    setHistory(updated);
  };

  const handleDownload = (base64: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = base64;
    link.download = fileName;
    link.click();
  };

  return (
  <>
    {/* タイトル（左上表示） */}
    <div className="flex items-center space-x-2 mb-6">
      <span className="text-2xl">📅</span>
      <h1 className="text-2xl font-bold text-gray-800">
        稼働履歴 <span className="text-sm text-gray-500 ml-2">- Work History -</span>
      </h1>
    </div>

    {/* メインカード */}
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow">
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

              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => {
                    const src = entry.fileData.startsWith("data:")
                      ? entry.fileData
                      : `data:application/pdf;base64,${entry.fileData}`;
                    setPreviewSrc(src);
                  }}
                  className="bg-green-500 text-white px-3 py-1 rounded shadow hover:bg-green-600"
                >
                  📄 プレビュー
                </button>

                <button
                  onClick={() => {
                    const base64 = entry.fileData.startsWith("data:")
                      ? entry.fileData
                      : `data:application/pdf;base64,${entry.fileData}`;
                    const link = document.createElement("a");
                    link.href = base64;
                    link.download = entry.fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded shadow hover:bg-blue-600"
                >
                  ⬇ ダウンロード
                </button>

                <button
                  onClick={() => handleDelete(index)}
                  className="bg-red-500 text-white px-3 py-1 rounded shadow hover:bg-red-600"
                >
                  🗑 削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* プレビュー用モーダル */}
      {previewSrc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">📄 日報プレビュー</h2>
              <button
                onClick={() => setPreviewSrc(null)}
                className="text-red-500 hover:underline"
              >
                閉じる
              </button>
            </div>
            <iframe src={previewSrc} className="flex-1 w-full" />
          </div>
        </div>
      )}
    </div>
  </>
);
};

export default DriverWorkHistory;
