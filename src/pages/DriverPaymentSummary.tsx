import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// ※ jsPDF は既存PDFをそのままテンプレとして読み込めません。
//   既存テンプレPDFに書き込みたい場合は pdf-lib を使うのが定石です。

interface Shift {
  date: string;
  driverId: string;
  project: string;
}

interface Driver {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  invoiceNumber?: string;
}

interface Project {
  name: string;
  unitPrice: number;
}

export default function DriverPaymentSummary() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // 1) ドライバー・案件を先にロード
  useEffect(() => {
    const company = localStorage.getItem("company") ?? "";
    const loadedDrivers =
      JSON.parse(localStorage.getItem(`driverList_${company}`) || localStorage.getItem("driverList") || "[]");
    setDrivers(loadedDrivers);

    const loadedProjects =
      JSON.parse(localStorage.getItem(`projectList_${company}`) || localStorage.getItem("projectList") || "[]");
    setProjects(loadedProjects);
  }, []);

  // 2) drivers が入ってからシフトをフラット化
  useEffect(() => {
    const year  = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const shiftKey = `confirmedShift_${year}_${month}`;

    // raw 形式: { driverId: { "YYYY-MM-DD": [ { project, unitPrice, ... }, ... ] } }
    const raw = JSON.parse(localStorage.getItem(shiftKey) || "{}");
    const flat: Shift[] = [];

    Object.entries(raw).forEach(([drvId, days]: any) => {
      Object.entries(days).forEach(([date, items]: any) => {
        (Array.isArray(items) ? items : [items]).forEach((it: any) => {
          flat.push({ date, driverId: String(drvId), project: it.project });
        });
      });
    });

    setShifts(flat);
  }, [drivers]);

  const calculateTotalByDriverId = (driverId: string) => {
    const relevantShifts = shifts.filter(s => s.driverId === driverId);
    let total = 0;
    for (const shift of relevantShifts) {
      const price = projects.find(p => p.name === shift.project)?.unitPrice || 0;
      total += Number(price) || 0;
    }
    return total;
  };

  const handleGeneratePDF = (driver: Driver) => {
    const doc = new jsPDF();

    const relevantShifts = shifts.filter(s => s.driverId === driver.id);
    const total = calculateTotalByDriverId(driver.id);

    doc.setFontSize(14);
    doc.text("支払明細書", 105, 20, { align: "center" });

    doc.setFontSize(11);
    doc.text(`氏名：${driver.name}`, 20, 40);
    doc.text(`住所：${driver.address || "未登録"}`, 20, 48);
    doc.text(`電話番号：${driver.phone || "未登録"}`, 20, 56);
    if (driver.type === "委託" && driver.invoiceNumber) {
      doc.text(`インボイス番号：${driver.invoiceNumber}`, 20, 64);
    }

    autoTable(doc, {
      head: [["日付", "案件名", "単価"]],
      body: relevantShifts.map(s => {
        const price = projects.find(p => p.name === s.project)?.unitPrice || 0;
        return [s.date, s.project, `${Number(price).toLocaleString()}円`];
      }),
      startY: 80,
    });

    const endY = (doc as any).lastAutoTable?.finalY ?? 80;
    doc.text(`合計金額：${total.toLocaleString()}円（税込）`, 20, endY + 10);

    doc.save(`${driver.name}_支払明細書.pdf`);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">支払明細書出力</h1>
      <table className="table-auto w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1">ドライバー</th>
            <th className="border px-2 py-1">件数</th>
            <th className="border px-2 py-1">合計金額</th>
            <th className="border px-2 py-1">操作</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map(d => (
            <tr key={d.id}>
              <td className="border px-2 py-1">{d.name}</td>
              <td className="border px-2 py-1">{shifts.filter(s => s.driverId === d.id).length}</td>
              <td className="border px-2 py-1">{calculateTotalByDriverId(d.id).toLocaleString()}円</td>
              <td className="border px-2 py-1">
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                  onClick={() => handleGeneratePDF(d)}
                >
                  PDF出力
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 既存PDFテンプレに書き込みたい場合は pdf-lib へ切替推奨 */}
    </div>
  );
}
