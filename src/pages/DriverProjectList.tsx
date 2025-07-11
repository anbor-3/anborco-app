import React, { useEffect, useState } from "react";

type Project = {
  id: string;
  company: string;
  name: string;
  person: string;     // 担当社員名
  time: string;       // 勤務時間（文字列）
};

const ProjectsList = () => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
  const stored = localStorage.getItem("projectList");
  if (stored) {
    const parsed = JSON.parse(stored);
    const normalized = parsed.map((p: any) => ({
      id: p.id,
      company: p.company,
      name: p.name,
      person: p.person || p.manager || "未登録",  // ← manager を吸収
      time: p.time || (p.startTime && p.endTime ? `${p.startTime}～${p.endTime}` : "未設定")
    }));
    setProjects(normalized);
  }
}, []);

  return (
    <div className="p-6">
      {/* タイトル */}
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-2xl">📋</span>
        <h1 className="text-2xl font-bold text-gray-800">
          案件一覧 <span className="text-sm text-gray-500 ml-2">- Project List -</span>
        </h1>
      </div>

      {/* 表表示 */}
      {projects.length === 0 ? (
        <p className="text-gray-500">登録された案件がありません。</p>
      ) : (
        <table className="w-full table-auto border border-gray-300 rounded shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">会社名</th>
              <th className="border px-2 py-1">案件名</th>
              <th className="border px-2 py-1">担当社員</th>
              <th className="border px-2 py-1">勤務時間</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p, index) => (
              <tr key={p.id}>
                <td className="border px-2 py-1 text-center">{p.company}</td>
                <td className="border px-2 py-1 text-center">{p.name}</td>
                <td className="border px-2 py-1 text-center">{p.person}</td>
                <td className="border px-2 py-1 text-center">{p.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ProjectsList;
