import React, { useState, useEffect, useRef } from "react";
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { saveDailyReport } from "../utils/fileUtils";
import { runArchiveIfNeeded } from "../utils/fileUtils";

const DriverDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const reportRef = useRef(null);

  const userName = "山田太郎";
  const company = "株式会社Anbor";

  const days = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return date.toISOString().slice(0, 10);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
      setTime(now);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
useEffect(() => {
  runArchiveIfNeeded(); // ← 1日 or 1/1 に ZIP実行
}, []);
  const [tempCheck, setTempCheck] = useState("OK");
  const [alcoholCheck, setAlcoholCheck] = useState("OK");
  const [reason, setReason] = useState("");
  const [startDistance, setStartDistance] = useState("");
  const [endDistance, setEndDistance] = useState("");
  const [timestamps, setTimestamps] = useState({ start: "", breakStart: "", breakEnd: "", end: "" });
  const [clicked, setClicked] = useState({ start: false, breakStart: false, breakEnd: false, end: false });

  const handleTimestamp = (key) => {
    const now = new Date().toLocaleTimeString();
    setTimestamps({ ...timestamps, [key]: now });
    setClicked({ ...clicked, [key]: true });
  };
const [paymentPdf, setPaymentPdf] = useState<{ dataUrl: string; ym: string; fileName: string } | null>(null);

useEffect(() => {
  const driver = userName;
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const key = `payment_${year}_${month}_${driver}`;
  const dataUrl = localStorage.getItem(key);
  if (dataUrl) {
    setPaymentPdf({
      dataUrl,
      ym: `${year}年${month}月`,
      fileName: `${driver}_支払明細書.pdf`,
    });
  }
}, []);

  const cancelTimestamp = (key) => {
    setTimestamps({ ...timestamps, [key]: "" });
    setClicked({ ...clicked, [key]: false });
  };

  const handleSubmit = () => {
  const dateJP = new Date(selectedDate).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const fileName = `${dateJP}_${userName}_日報.pdf`;

  const element = reportRef.current;
  const opt = {
    margin: 0.5,
    filename: fileName,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
  };
  
  html2pdf().set(opt).from(element).outputPdf("blob").then((blob) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64 = reader.result as string;
    saveDailyReport({
  driverId: "driver001", // ← 実際はログイン中のドライバーIDを使う
  driverName: userName,  // ← "山田太郎"
  date: selectedDate,    // ← "2025-06-25" など
  fileName: fileName,    // ← "2025年06月25日_山田太郎_日報.pdf"
  dataUrl: base64        // ← base64形式PDF（dataURL）
});
    const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

    // ✅ driverHistory に Base64 付きで保存
    const driverHistory = JSON.parse(localStorage.getItem("driverHistory") || "[]");
    driverHistory.push({
      date: selectedDate,
      name: userName,
      submittedAt: now,
      fileName: fileName,
      fileData: base64,  // ← base64を保存
    });
    localStorage.setItem("driverHistory", JSON.stringify(driverHistory));

    // ✅ 管理者への通知
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    notifications.push({
      id: Date.now(),
      type: "report",
      category: "日報提出",
      message: `${userName} が ${dateJP} に日報を提出しました。`,
      target: userName,
      timestamp: new Date().toISOString(),
      read: false
    });
    localStorage.setItem("notifications", JSON.stringify(notifications));

    // ✅ 月ごとのファイル管理
    const monthKey = `reports_${selectedDate.slice(0, 7)}`;
    const monthlyReports = JSON.parse(localStorage.getItem(monthKey) || "[]");
    monthlyReports.push({
      date: selectedDate,
      fileName: fileName,
      driver: userName
    });
    localStorage.setItem(monthKey, JSON.stringify(monthlyReports));

    // ✅ 毎月1日に ZIP を作成
    const today = new Date();
    if (today.getDate() === 1) {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthKey = `reports_${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      const reports = JSON.parse(localStorage.getItem(prevMonthKey) || "[]");
      if (reports.length > 0) {
        const zip = new JSZip();
        reports.forEach((r: any) => {
          zip.file(r.fileName, `この ZIP はファイル名のみ保存\n${r.fileName}`);
        });
        zip.generateAsync({ type: "blob" }).then((zipBlob) => {
          saveAs(zipBlob, `${prevMonthKey}_日報.zip`);
        });
      }
    }

    alert("日報提出と保存が完了しました！");
  };

  reader.readAsDataURL(blob); // ← base64 へ変換開始
});
};

  return (
    <div ref={reportRef} className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">🚚 日報提出<span className="text-sm text-gray-500">- Driver Dashboard-</span></h1>

      {/* 本日のシフト情報 */}
      <section className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <label className="block text-sm text-gray-600">日付を選択：</label>
            <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border rounded p-1">
              {days.map((d) => (
                <option key={d} value={d}>{new Date(d).toLocaleDateString("ja-JP")}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-600">現在時刻（日本時間）：<span className="font-mono">{time}</span></div>
        </div>
        <p className="text-gray-600">案件情報を読み込み中...</p>
      </section>

      {/* 体調報告 */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">体調報告</h2>
        <label>検温チェック：
          <select value={tempCheck} onChange={e => setTempCheck(e.target.value)} className="ml-2 border rounded">
            <option value="OK">OK</option>
            <option value="NG">NG</option>
          </select>
        </label>
        <br />
        <label>アルコールチェック：
          <select value={alcoholCheck} onChange={e => setAlcoholCheck(e.target.value)} className="ml-2 border rounded">
            <option value="OK">OK</option>
            <option value="NG">NG</option>
          </select>
        </label>
        {(tempCheck === "NG" || alcoholCheck === "NG") && (
          <input type="text" placeholder="NG理由を入力" value={reason} onChange={e => setReason(e.target.value)} className="mt-2 border rounded w-full p-1" />
        )}
      </section>
    
      {/* 走行距離入力 */}
      <section className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">走行距離</h2>
          <input type="number" placeholder="開始距離" value={startDistance} onChange={e => setStartDistance(e.target.value)} className="border rounded w-full mb-2 p-1" />
          <input type="number" placeholder="終了距離" value={endDistance} onChange={e => setEndDistance(e.target.value)} className="border rounded w-full p-1" />
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">走行距離の写真</h2>
          <input type="file" accept="image/*" capture="environment" className="w-full border p-1 rounded" />
          <input type="file" accept="image/*" capture="environment" className="w-full border p-1 rounded mt-2" />
        </div>
      </section>

      {/* 勤務状況ボタン（リアルタイム記録） */}
      <section className="bg-white p-4 rounded shadow space-y-2">
        <h2 className="font-semibold mb-2">勤務ステータス（リアルタイム記録）</h2>
        {["start", "breakStart", "breakEnd", "end"].map((key) => {
          const labels = {
            start: "稼働開始",
            breakStart: "休憩開始",
            breakEnd: "休憩終了",
            end: "稼働終了",
          };
          return (
            <div key={key} className="flex justify-between items-center">
              <button
                onClick={() => handleTimestamp(key)}
                disabled={clicked[key]}
                className={`px-4 py-1 rounded shadow ${clicked[key] ? "bg-gray-300" : "bg-orange-500 text-white"}`}
              >
                {labels[key]}
              </button>
              <span>{timestamps[key]}</span>
              {clicked[key] && (
                <button onClick={() => cancelTimestamp(key)} className="text-sm text-blue-600 underline">取消</button>
              )}
            </div>
          );
        })}
      </section>

      {/* 日報提出ボタン */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold text-gray-700">本日の日報</h2>
        <p className="text-gray-600">未提出です。</p>
        <button onClick={handleSubmit} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded shadow">
          日報を提出（PDF出力）
        </button>
      </section>
      {/* ✅ 支払明細書プレビュー + 請求書作成確認ボタン */}
{paymentPdf && (
  <section className="bg-white p-4 rounded shadow">
    <h2 className="text-lg font-bold mb-2">📄 支払明細書プレビュー（{paymentPdf.ym}）</h2>
    <p className="mb-2">{paymentPdf.fileName}</p>
    <iframe src={paymentPdf.dataUrl} className="w-full h-96 border mb-4" title="支払明細書プレビュー" />
    <button
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      onClick={() => alert("この内容で請求書を作成します（次ステップへ）")}
    >
      この内容で請求書を作成する
    </button>
  </section>
)}
    </div>
  );
};

export default DriverDashboard;
