import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebaseClient";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

type Project = {
  id: string;
  company: string;
  name: string;
  person: string;
  time: string;
};

type SortKey = "company" | "name" | "person" | "time";

const ProjectsList = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("currentUser") || "{}"), []);
  const company: string = currentUser?.company || "default";
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "companies", company, "projects"),
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          company: String(x.company ?? ""),
          name: String(x.name ?? ""),
          person: String(x.person ?? x.manager ?? "未登録"),
          time:
            x.time ??
            (x.startTime && x.endTime ? `${x.startTime}～${x.endTime}` : "未設定"),
        } as Project;
      });
      setProjects(list);
    });
    return () => unsub();
  }, [company]);

  const companies = useMemo(() => {
    const set = new Set(projects.map((p) => p.company));
    return Array.from(set).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = projects.filter((p) => {
      const compOk = companyFilter === "all" || p.company === companyFilter;
      if (!q) return compOk;
      const hay = `${p.company} ${p.name} ${p.person} ${p.time}`.toLowerCase();
      return compOk && hay.includes(q);
    });
    const sorted = [...base].sort((a, b) => {
      const A = (a[sortKey] ?? "").toString();
      const B = (b[sortKey] ?? "").toString();
      return sortAsc ? A.localeCompare(B, "ja") : B.localeCompare(A, "ja");
    });
    return sorted;
  }, [projects, search, companyFilter, sortKey, sortAsc]);

  const counts = {
    total: projects.length,
    filtered: filtered.length,
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) return setSortAsc((v) => !v);
    setSortKey(key);
    setSortAsc(true);
  }

  return (
    <div className="p-6 space-y-8 text-black">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📋</span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            案件一覧
            <span className="ml-2 text-base md:text-lg text-white font-medium">
              — Project List —
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs md:text-sm px-2 py-1 rounded-full bg-slate-100">
            全体 {counts.total}
          </span>
          <span className="inline-flex items-center gap-1 text-xs md:text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            表示 {counts.filtered}
          </span>
        </div>
      </div>

      <section className="bg-white p-4 md:p-5 rounded-2xl shadow-lg space-y-3 text-black">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm text-gray-800 mb-1">キーワード検索</label>
            <input
              className="w-full border-2 rounded-xl px-4 py-3 text-base text-black placeholder:text-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500"
              placeholder="会社名 / 案件名 / 担当 / 時間 で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-800 mb-1">会社で絞り込み</label>
            <select
              className="w-full border-2 rounded-xl px-3 py-3 text-base font-semibold text-black focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="md:hidden space-y-3 text-black">
        {filtered.length === 0 ? (
          <p className="text-gray-700">登録された案件がありません。</p>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-lg">{p.name}</div>
                <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-black">
                  {p.company}
                </span>
              </div>
              <div className="text-sm text-gray-800">
                担当：<span className="font-medium">{p.person}</span>
              </div>
              <div className="text-sm text-gray-800">
                勤務時間：<span className="font-mono">{p.time}</span>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="hidden md:block bg-white p-5 rounded-2xl shadow-lg text-black">
        {filtered.length === 0 ? (
          <p className="text-gray-700">登録された案件がありません。</p>
        ) : (
          <div className="overflow-auto max-h-[70vh] rounded-xl border">
            <table className="min-w-full text-sm md:text-base text-black">
              <thead className="sticky top-0 bg-gray-100 z-10 text-black">
                <tr className="text-left">
                  <th className="px-4 py-3 border-b w-56">
                    <button
                      onClick={() => toggleSort("company")}
                      className="inline-flex items-center gap-1 font-semibold hover:underline text-black"
                      title="クリックで並べ替え"
                    >
                      会社名
                      {sortKey === "company" && (
                        <span className="text-xs">{sortAsc ? "▲" : "▼"}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 border-b">
                    <button
                      onClick={() => toggleSort("name")}
                      className="inline-flex items-center gap-1 font-semibold hover:underline text-black"
                      title="クリックで並べ替え"
                    >
                      案件名
                      {sortKey === "name" && (
                        <span className="text-xs">{sortAsc ? "▲" : "▼"}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 border-b w-56">
                    <button
                      onClick={() => toggleSort("person")}
                      className="inline-flex items-center gap-1 font-semibold hover:underline text-black"
                      title="クリックで並べ替え"
                    >
                      担当社員
                      {sortKey === "person" && (
                        <span className="text-xs">{sortAsc ? "▲" : "▼"}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 border-b w-56">
                    <button
                      onClick={() => toggleSort("time")}
                      className="inline-flex items-center gap-1 font-semibold hover:underline text-black"
                      title="クリックで並べ替え"
                    >
                      勤務時間
                      {sortKey === "time" && (
                        <span className="text-xs">{sortAsc ? "▲" : "▼"}</span>
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-gray-50 text-black">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/60">
                    <td className="px-4 py-3 border-b">{p.company}</td>
                    <td className="px-4 py-3 border-b">{p.name}</td>
                    <td className="px-4 py-3 border-b">{p.person}</td>
                    <td className="px-4 py-3 border-b font-mono">{p.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProjectsList;
