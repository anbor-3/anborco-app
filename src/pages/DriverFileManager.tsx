import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebaseClient";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

type FileRow = {
  id: string;
  kind: "daily" | "monthlyFolder" | "yearlyFolder";
  label?: string;
  date?: string;
  url?: string;
  path?: string;
  year?: string;
  month?: string;
  createdAt?: any;
  fileName?: string;
};

export default function DriverFileManager() {
  const user = useMemo(() => JSON.parse(localStorage.getItem("currentUser") || "{}"), []);
  const company: string = user.company || "default";
  const driverId: string = user.uid || user.id || auth.currentUser?.uid || "unknown";

  const [rows, setRows] = useState<FileRow[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>(""); // YYYY-MM

  useEffect(() => {
    const qCol = query(
      collection(db, "companies", company, "drivers", driverId, "files"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qCol, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as FileRow[];
      setRows(list);
    });
    return () => unsub();
  }, [company, driverId]);

  const monthlyFolders = rows.filter((r) => r.kind === "monthlyFolder");
  const yearlyFolders = rows.filter((r) => r.kind === "yearlyFolder");
  const daily = rows.filter((r) => r.kind === "daily");
  const filteredDaily = daily.filter((d) => filterMonth ? (d.date || "").startsWith(filterMonth) : true);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">📁 ファイル管理</h2>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">年次フォルダ</h3>
        {yearlyFolders.length === 0 && <p className="text-gray-500 text-sm">まだありません</p>}
        <ul className="list-disc pl-5">
          {yearlyFolders.map((f) => (
            <li key={f.id}>{f.label}</li>
          ))}
        </ul>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">月次フォルダ</h3>
        {monthlyFolders.length === 0 && <p className="text-gray-500 text-sm">まだありません</p>}
        <div className="flex gap-2 flex-wrap">
          {monthlyFolders.map((f) => (
            <span key={f.id}
                  role="button"
                  onClick={() => {
                    const y = f.label?.slice(0, 4);
                    const m = f.label?.slice(5, 7);
                    if (y && m) setFilterMonth(`${y}-${m}`);
                  }}
                  className="px-2 py-1 border rounded cursor-pointer hover:bg-gray-50 text-sm">
              {f.label}
            </span>
          ))}
          {filterMonth && (
            <button onClick={() => setFilterMonth("")}
                    className="px-2 py-1 border rounded text-sm">
              フィルタ解除
            </button>
          )}
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-3">日報（{filterMonth || "全期間"}）</h3>
        {filteredDaily.length === 0 && <p className="text-gray-500 text-sm">該当する日報はありません</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-2 border w-40">日付</th>
                <th className="px-2 py-2 border">ファイル名</th>
                <th className="px-2 py-2 border w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredDaily.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 border">{r.date}</td>
                  <td className="px-2 py-2 border">{r.fileName || r.path?.split("/").pop()}</td>
                  <td className="px-2 py-2 border text-center">
                    {r.url ? (
                      <a className="text-blue-600 underline" href={r.url} target="_blank" rel="noreferrer">開く</a>
                    ) : (
                      <span className="text-gray-400">URLなし</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
