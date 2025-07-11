import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

// 👇 テンプレートPDFの読み込み（public に置いておく）
import templatePdf from "@/assets/支払明細書テンプレート.pdf?url";

interface Shift {
  date: string;
  driver: string;
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

  useEffect(() => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const shiftKey = `confirmedShift_${year}_${String(month).padStart(2, "0")}`;
     // ── ① DriverPaymentSummary 用に
 //     { driverId: { "YYYY-MM-DD": [{ project, unitPrice, … }] } }
 //     というネスト構造をフラットな配列へ変換する
 const raw = JSON.parse(localStorage.getItem(shiftKey) || "{}");

 const flat: Shift[] = [];
 Object.entries(raw).forEach(([drvId, days]: any) => {
   Object.entries(days).forEach(([date, items]: any) => {
     (Array.isArray(items) ? items : [items]).forEach((it: any) => {
       flat.push({
         date,
         driver: drivers.find(d => d.id === drvId)?.name ?? drvId,
         project: it.project,
       });
     });
   });
 });
 setShifts(flat);

    const loadedDrivers = JSON.parse(localStorage.getItem("driverList") || "[]");
    setDrivers(loadedDrivers);

    const loadedProjects = JSON.parse(localStorage.getItem("projectList") || "[]");
    setProjects(loadedProjects);
  }, []);

  const calculateTotal = (driverName: string) => {
    const relevantShifts = shifts.filter(s => s.driver === driverName);
    let total = 0;
    for (const shift of relevantShifts) {
      const project = projects.find(p => p.name === shift.project);
      if (project) {
        total += Number(project.unitPrice || 0);
      }
    }
    return total;
  };

  const handleGeneratePDF = (driver: Driver) => {
    fetch(templatePdf)
      .then(res => res.arrayBuffer())
      .then(data => {
        const doc = new jsPDF();
        const relevantShifts = shifts.filter(s => s.driver === driver.name);
        const total = calculateTotal(driver.name);

        doc.setFontSize(14);
        doc.text("支払明細書", 105, 20, { align: "center" });

        doc.setFontSize(11);
        doc.text(`氏名：${driver.name}`, 20, 40);
        doc.text(`住所：${driver.address || "未登録"}`, 20, 48);
        doc.text(`電話番号：${driver.phone || "未登録"}`, 20, 56);
        if (driver.type === "委託" && driver.invoiceNumber) {
          doc.text(`インボイス番号：${driver.invoiceNumber}`, 20, 64);
        }

        doc.autoTable({
          head: [["日付", "案件名", "単価"]],
          body: relevantShifts.map(s => {
            const price = projects.find(p => p.name === s.project)?.unitPrice || 0;
            return [s.date, s.project, `${price.toLocaleString()}円`];
          }),
          startY: 80,
        });

        doc.text(`合計金額：${total.toLocaleString()}円（税込）`, 20, doc.lastAutoTable.finalY + 10);

        doc.save(`${driver.name}_支払明細書.pdf`);
      });
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
              <td className="border px-2 py-1">{shifts.filter(s => s.driver === d.name).length}</td>
              <td className="border px-2 py-1">{calculateTotal(d.name).toLocaleString()}円</td>
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
    </div>
  );
}
