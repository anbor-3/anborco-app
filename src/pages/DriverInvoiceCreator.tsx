
import React, { useState } from "react";
import jsPDF from "jspdf";
import { useNavigate } from "react-router-dom";

export default function DriverInvoiceCreator() {
  const navigate = useNavigate();
  const driver = JSON.parse(localStorage.getItem("loggedInDriver") || "{}");
  const driverId = localStorage.getItem("driverLoginId");
  const now = new Date();
  const [invoiceNo, setInvoiceNo] = useState("");

  const ym = `${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  const psKey = `ps_${ym}_${driverId}`;
  const psRaw = localStorage.getItem(psKey);
  const psMeta = psRaw ? JSON.parse(psRaw) : null;

  if (!psMeta) {
    return <div className="p-4">支払明細が見つかりません。</div>;
  }

  const handleGenerate = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("請求書", 90, 20);
    doc.setFontSize(12);
    doc.text(`請求番号: ${invoiceNo}`, 20, 40);
    doc.text(`請求日: ${now.toLocaleDateString("ja-JP")}`, 20, 50);
    doc.text(`請求元: ${driver.company} ${driver.name}`, 20, 60);
    doc.text(`合計金額: 計算金額`, 20, 80); // 実装に応じて金額を入れる

    doc.text("※本請求書は支払明細に基づき発行されました", 20, 110);

    const fileName = `請求書_${ym}_${driver.name}.pdf`;
    const dataUrl = doc.output("dataurlstring");

    const invoiceKey = `invoice_${ym}_${driverId}`;
    const meta = {
      driverId,
      driverName: driver.name,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      invoiceNo,
      dataUrl,
      fileName,
    };

    localStorage.setItem(invoiceKey, JSON.stringify(meta));
    // ✅ ファイル管理に保存（請求書として）
const fileKey = `file_invoice_${ym}_${driverId}`;
localStorage.setItem(fileKey, JSON.stringify({
  driverName: driver.name,
  driverId,
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  dataUrl,
  fileName,
}));
    doc.save(fileName);
    alert("請求書を作成しました！");
    navigate("/driver/history");
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">請求書作成</h1>
      <p className="mb-4">以下の情報を入力し、請求書を作成してください。</p>

      <label className="block mb-4">
        <span className="block font-semibold mb-1">請求番号</span>
        <input
          className="border p-2 w-full"
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          placeholder="例: INV-2025-0703"
        />
      </label>

      <button
        className="px-6 py-2 bg-blue-600 text-white rounded"
        onClick={handleGenerate}
        disabled={!invoiceNo}
      >
        請求書を作成する
      </button>
    </div>
  );
}
