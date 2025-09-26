import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebaseClient";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

type FileRow = {
  id: string;
  kind: "daily" | "monthlyFolder" | "yearlyFolder";
  label?: string;
  date?: string;      // YYYY-MM-DD
  url?: string;
  path?: string;
  year?: string;
  month?: string;     // MM
  createdAt?: any;
  fileName?: string;
};

export default function DriverFileManager() {
  const user = useMemo(() => JSON.parse(localStorage.getItem("currentUser") || "{}"), []);
  const company: string = user.company || "default";
  const driverId: string = user.uid || user.id || auth.currentUser?.uid || "unknown";

  const [rows, setRows] = useState<FileRow[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>(""); // YYYY-MM
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qCol = query(
      collection(db, "companies", company, "drivers", driverId, "files"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      qCol,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as FileRow[];
        setRows(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [company, driverId]);

  const yearlyFolders = rows.filter((r) => r.kind === "yearlyFolder");
  const monthlyFolders = rows.filter((r) => r.kind === "monthlyFolder");
  const daily = rows.filter((r) => r.kind === "daily");
  const filteredDaily = daily.filter((d) => (filterMonth ? (d.date || "").startsWith(filterMonth) : true));

  const count = {
    yearly: yearlyFolders.length,
    monthly: monthlyFolders.length,
    daily: daily.length,
    dailyFiltered: filteredDaily.length,
  };

  return (
    <div className="space-y-8 text-black">
      {/* ヘッダー */}
      <div className="flex items-end justify-between gap-3">
  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
    📁 <span className="text-white">ファイル管理</span>
    <span className="ml-2 align-baseline text-sm md:text-lg font-medium text-white">
      — Driver File Manager —
    </span>
  </h2>
  <div className="flex items-center gap-2">
    <span className="inline-flex items-center gap-1 text-xs md:text-sm px-2 py-1 rounded-full bg-slate-100">
      年 {count.yearly}
    </span>
    <span className="inline-flex items-center gap-1 text-xs md:text-sm px-2 py-1 rounded-full bg-slate-100">
      月 {count.monthly}
    </span>
    <span className="inline-flex items-center gap-1 text-xs md:text-sm px-2 py-1 rounded-full bg-slate-100">
      日報 {count.daily}
    </span>
  </div>
</div>

      {/* 年次フォルダ */}
      <section className="bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-6 bg-gray-900 rounded" />
          <h3 className="text-xl md:text-2xl font-extrabold">年次フォルダ</h3>
        </div>

        {loading ? (
          <p className="text-gray-800 text-sm">読み込み中…</p>
        ) : count.yearly === 0 ? (
          <p className="text-gray-800 text-sm">🗂️ まだありません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {yearlyFolders.map((f) => (
              <span
                key={f.id}
                className="px-3 py-2 text-sm md:text-base rounded-xl border-2 bg-white hover:bg-slate-50"
                title="年次フォルダ"
              >
                {f.label}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 月次フォルダ＋月フィルタ */}
      <section className="bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-blue-700 rounded" />
            <h3 className="text-xl md:text-2xl font-extrabold">月次フォルダ</h3>
          </div>
          {filterMonth ? (
            <div className="flex items-center gap-2">
              <span className="text-sm md:text-base font-semibold">
                フィルタ中：<span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800">{filterMonth}</span>
              </span>
              <button
                onClick={() => setFilterMonth("")}
                className="px-3 py-2 text-sm md:text-base border-2 rounded-xl hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                フィルタ解除
              </button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="text-gray-800 text-sm">読み込み中…</p>
        ) : count.monthly === 0 ? (
          <p className="text-gray-800 text-sm">🗓️ まだありません</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {monthlyFolders.map((f) => {
              const y = f.label?.slice(0, 4);
              const m = f.label?.slice(5, 7);
              const ym = y && m ? `${y}-${m}` : undefined;
              const active = ym && ym === filterMonth;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => ym && setFilterMonth(ym)}
                  className={`px-3 py-2 rounded-xl border-2 text-sm md:text-base transition
                    focus:outline-none focus:ring-4
                    ${active
                      ? "bg-blue-600 border-blue-700 text-white focus:ring-blue-300"
                      : "bg-white hover:bg-slate-50 border-slate-300 focus:ring-blue-200"}`}
                  title="クリックでその月に絞り込み"
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 日報テーブル */}
      <section className="bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-emerald-600 rounded" />
            <h3 className="text-xl md:text-2xl font-extrabold">
              日報 <span className="text-base md:text-lg text-gray-800 font-medium">（{filterMonth || "全期間"}）</span>
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 text-xs md:text-sm px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            件数 {count.dailyFiltered}
          </span>
        </div>

        {loading ? (
          <p className="text-gray-800 text-sm">読み込み中…</p>
        ) : filteredDaily.length === 0 ? (
          <p className="text-gray-800 text-sm">📄 該当する日報はありません</p>
        ) : (
          <div className="overflow-auto max-h-[60vh] rounded-xl border">
            <table className="min-w-full text-sm md:text-base text-black">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr className="text-left">
                  <th className="px-3 md:px-4 py-3 border-b w-40">日付</th>
                  <th className="px-3 md:px-4 py-3 border-b">ファイル名</th>
                  <th className="px-3 md:px-4 py-3 border-b w-36 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-gray-50">
                {filteredDaily.map((r) => {
                  const name = r.fileName || r.path?.split("/").pop() || "（名称未設定）";
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/60">
                      <td className="px-3 md:px-4 py-3 border-b font-mono">{r.date}</td>
                      <td className="px-3 md:px-4 py-3 border-b truncate">{name}</td>
                      <td className="px-3 md:px-4 py-3 border-b text-center">
                        {r.url ? (
                          <a
                            className="inline-flex items-center justify-center px-3 py-2 text-sm md:text-base rounded-xl border-2 bg-white hover:bg-slate-50 text-blue-700 border-blue-300 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-200"
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            title="別タブで開く"
                          >
                            開く
                          </a>
                        ) : (
                          <span className="text-gray-700">URLなし</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
