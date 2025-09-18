import React, { useEffect, useMemo, useState } from "react";
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

  // ✅ 追加: 初期は未選択。これでデフォルトで誰かが入って見える問題を回避
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  // 1) ドライバー・案件を先にロード
  useEffect(() => {
    const company = localStorage.getItem("company") ?? "";
    const loadedDrivers =
      JSON.parse(
        localStorage.getItem(`driverList_${company}`) ||
          localStorage.getItem("driverList") ||
          "[]"
      );
    setDrivers(loadedDrivers);

    const loadedProjects =
      JSON.parse(
        localStorage.getItem(`projectList_${company}`) ||
          localStorage.getItem("projectList") ||
          "[]"
      );
    setProjects(loadedProjects);
  }, []);

  // 2) drivers が入ってからシフトをフラット化
  useEffect(() => {
    const year = new Date().getFullYear();
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
    const relevantShifts = shifts.filter((s) => s.driverId === driverId);
    let total = 0;
    for (const shift of relevantShifts) {
      const price =
        Number(
          projects.find((p) => p.name === shift.project)?.unitPrice ?? 0
        ) || 0;
      total += price;
    }
    return total;
  };

  const handleGeneratePDF = (driver: Driver) => {
    const doc = new jsPDF();

    const relevantShifts = shifts.filter((s) => s.driverId === driver.id);
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
      body: relevantShifts.map((s) => {
        const price =
          Number(projects.find((p) => p.name === s.project)?.unitPrice ?? 0) ||
          0;
        return [s.date, s.project, `${price.toLocaleString()}円`];
      }),
      startY: 80,
    });

    const endY = (doc as any).lastAutoTable?.finalY ?? 80;
    doc.text(`合計金額：${total.toLocaleString()}円（税込）`, 20, endY + 10);

    doc.save(`${driver.name}_支払明細書.pdf`);
  };

  // ✅ 追加: 選択状態で絞り込み。空のときは全員表示でもOK
  const visibleDrivers = useMemo(() => {
    if (!selectedDriverId) return drivers;
    return drivers.filter((d) => String(d.id) === String(selectedDriverId));
  }, [drivers, selectedDriverId]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">支払明細書出力</h1>

      {/* ✅ 追加: ドライバー選択（初期は未選択） */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-gray-700">ドライバー:</label>
        <select
          className="border rounded px-2 py-1"
          value={selectedDriverId}
          onChange={(e) => setSelectedDriverId(e.target.value)}
        >
          <option value="">— 選択してください —</option>
          {drivers.map((d) => (
            <option key={String(d.id)} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

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
          {/* ✅ drivers → visibleDrivers に変更 */}
          {visibleDrivers.map((d) => (
            <tr key={String(d.id)}>
              <td className="border px-2 py-1">{d.name}</td>
              <td className="border px-2 py-1">
                {shifts.filter((s) => s.driverId === String(d.id)).length}
              </td>
              <td className="border px-2 py-1">
                {calculateTotalByDriverId(String(d.id)).toLocaleString()}円
              </td>
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
          {/* 選択して誰もいないケースのフォールバック表示（任意） */}
          {visibleDrivers.length === 0 && (
            <tr>
              <td className="border px-2 py-4 text-center text-sm" colSpan={4}>
                ドライバーを選択してください
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 既存PDFテンプレに書き込みたい場合は pdf-lib へ切替推奨 */}
    </div>
  );
}
