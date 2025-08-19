import  { useState, useEffect } from "react";

// ★ 追加: URLメタデータで添付を管理
type Attachment = {
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string; // ISO8601
};

type Project = {
  id: number;
  company: string;
  manager: string;
  phone: string;
  name: string;
  contractStart: string;
  contractEnd: string;
  /** １日（１コース・１台 …）当たりの支払額 */
  unitPrice: number; // 数値
  startTime: string;
  endTime: string;
  paymentDate: string;
  transferDate: string;
  requiredPeople: string;
  requiredUnit: string;
  attachments?: Attachment[]; // ★ ここを差し替え（files→attachments）
  customFields?: Record<string, string>;
};

// ========================= API helpers =========================
// ※ 必要に応じて BASE を調整（同一ドメインなら空でOK）
const BASE = "";

async function fetchProjects(company: string): Promise<Project[]> {
  const res = await fetch(`${BASE}/api/projects?company=${encodeURIComponent(company)}`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return await res.json();
}

async function saveProjectsBulk(company: string, projects: Project[]): Promise<Project[]> {
  const res = await fetch(`${BASE}/api/projects/save-bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company, projects }),
  });
  if (!res.ok) throw new Error("Failed to save projects");
  const data = await res.json();
  return data.projects as Project[];
}

async function deleteProjectById(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete project");
}

async function uploadProjectFiles(projectId: number, files: FileList): Promise<Attachment[]> {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append("files", f));
  const res = await fetch(`${BASE}/api/projects/${projectId}/files`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Failed to upload files");
  return await res.json(); // Attachment[]
}

async function fetchCustomFields(company: string): Promise<string[]> {
  const res = await fetch(`${BASE}/api/projects/custom-fields?company=${encodeURIComponent(company)}`);
  if (!res.ok) return [];
  return await res.json();
}

const initialProjects: Project[] = [
  {
    id: 1,
    company: "A社",
    manager: "佐藤太郎",
    phone: "090-1234-0001",
    name: "横浜ルート便",
    contractStart: "2024-06-01",
    contractEnd: "2024-09-30",
    unitPrice: 850000,
    startTime: "08:00",
    endTime: "17:00",
    paymentDate: "月末",
    transferDate: "月末",
    requiredPeople: "3",
    requiredUnit: "名"
  },
  {
    id: 2,
    company: "B社",
    manager: "鈴木花子",
    phone: "090-1234-0002",
    name: "品川定期便",
    contractStart: "2024-06-10",
    contractEnd: "2024-11-10",
    unitPrice: 780000,
    startTime: "09:00",
    endTime: "18:00",
    paymentDate: "月末",
    transferDate: "月末",
    requiredPeople: "2",
    requiredUnit: "コース"
  },
  {
    id: 3,
    company: "C社",
    manager: "高橋次郎",
    phone: "090-1234-0003",
    name: "渋谷スポット便",
    contractStart: "2024-05-01",
    contractEnd: "2024-08-01",
    unitPrice: 920000,
    startTime: "07:00",
    endTime: "16:00",
    paymentDate: "月末",
    transferDate: "月末",
    requiredPeople: "1",
    requiredUnit: "台"
  },
  {
    id: 4,
    company: "D社",
    manager: "田中三郎",
    phone: "090-1234-0004",
    name: "大田区配送",
    contractStart: "2024-07-15",
    contractEnd: "2024-10-15",
    unitPrice: 600000,
    startTime: "10:00",
    endTime: "19:00",
    paymentDate: "月末",
    transferDate: "月末",
    requiredPeople: "2",
    requiredUnit: "名"
  },
  {
    id: 5,
    company: "E社",
    manager: "山本花子",
    phone: "090-1234-0005",
    name: "品川ルート",
    contractStart: "2024-08-01",
    contractEnd: "2024-12-31",
    unitPrice: 990000,
    startTime: "08:30",
    endTime: "17:30",
    paymentDate: "月末",
    transferDate: "月末",
    requiredPeople: "4",
    requiredUnit: "名"
  }
];

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCustomFields, setProjectCustomFields] = useState<string[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // 初期データ読み込み（localStorage優先）
// 会社名は既存仕様に合わせて localStorage から
const company = typeof window !== "undefined" ? (localStorage.getItem("company") || "demoCompany") : "demoCompany";

// 初期データ読み込み（API）
useEffect(() => {
  let active = true;
  (async () => {
    try {
      const [list, fields] = await Promise.all([
        fetchProjects(company),
        fetchCustomFields(company),
      ]);
      if (!active) return;
      setProjects(list.length ? list : initialProjects);
      setProjectCustomFields(fields || []);
    } catch (e) {
      console.error(e);
      // フォールバック：初期ダミーを表示
      setProjects(initialProjects);
      setProjectCustomFields([]);
    }
  })();
  return () => { active = false; };
}, [company]);

  const handleInputChange = (index: number, key: keyof Project, value: any) => {
  const updated = [...projects];
  if (key === "unitPrice") {
    updated[index].unitPrice = typeof value === "number" ? value : Number(value) || 0;
  } else {
    (updated[index] as any)[key] = value;
  }
  setProjects(updated);
};

const handleCustomFieldChange = (index: number, fieldName: string, value: string) => {
    const updated = [...projects];
    if (!updated[index].customFields) updated[index].customFields = {};
    updated[index].customFields![fieldName] = value;
    setProjects(updated);
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
  };

  const handleSave = async () => {
  try {
    const saved = await saveProjectsBulk(company, projects);
    setProjects(saved); // サーバ採番IDで上書き
    setEditIndex(null);
    alert("保存しました（サーバ保存完了）");
  } catch (e) {
    console.error(e);
    alert("保存に失敗しました");
  }
};

  const handleDelete = async (index: number) => {
  const target = projects[index];
  if (!window.confirm("本当にこの案件を削除しますか？")) return;
  try {
    // 未保存（負ID）の場合はAPI削除不要
    if (target.id > 0) {
      await deleteProjectById(target.id);
    }
    const updated = [...projects];
    updated.splice(index, 1);
    setProjects(updated);
  } catch (e) {
    console.error(e);
    alert("削除に失敗しました");
  }
};
  
  const handleFileChange = async (index: number, files: FileList | null) => {
  if (!files || files.length === 0) return;

  // 1) 負IDなら先に保存してIDを確定させる
  let proj = projects[index];
  if (proj.id < 0) {
    try {
      const saved = await saveProjectsBulk(company, projects);
      setProjects(saved);
      proj = saved.find(p => p.name === proj.name && p.company === proj.company) || saved[index];
      if (!proj || proj.id < 0) throw new Error("ID割当が完了していません");
    } catch (e) {
      console.error(e);
      alert("先に案件の保存に失敗しました。ファイルはアップロードできません。");
      return;
    }
  }

  // 2) ファイルアップロード（APIが Attachment[] を返す前提）
  try {
    const newAttachments = await uploadProjectFiles(proj.id, files);
    const updated = [...projects];
    const cur = updated.find(p => p.id === proj.id);
    if (cur) {
      cur.attachments = [...(cur.attachments || []), ...newAttachments];
    }
    setProjects(updated);
    alert("ファイルをアップロードしました");
  } catch (e) {
    console.error(e);
    alert("ファイルのアップロードに失敗しました");
  }
};

  const handleAdd = () => {
  const newProject: Project = {
    id: -Date.now(), // ★ 新規は負ID（サーバ採番までの一時ID）
    company: company,
    manager: "",
    phone: "",
    name: "",
    contractStart: "",
    contractEnd: "",
    unitPrice: 0, // ★ 数値
    startTime: "08:00",
    endTime: "17:00",
    paymentDate: "",
    transferDate: "",
    requiredPeople: "0",
    requiredUnit: "名",
    attachments: [], // ★ 空で用意
    customFields: {},
  };
  setProjects(prev => [...prev, newProject]);
  setEditIndex(projects.length);
};

  const timeOptions = Array.from({ length: 24 * 12 }, (_, i) => {
    const h = String(Math.floor(i / 12)).padStart(2, '0');
    const m = String((i % 12) * 5).padStart(2, '0');
    return `${h}:${m}`;
  });

  return (
    <div className="p-4 font-sans tracking-wide text-base text-[#1f2937]">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-3 text-[#1f2937]">
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
  </svg>
  案件一覧
  <span className="text-sm text-gray-500 ml-2">-Project List-</span>
</h1>
      <div className="flex gap-2 mb-4 text-[#1f2937]">
        <button className="bg-blue-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-blue-700 transition" onClick={handleAdd}>新規案件追加</button>
        <button className="bg-green-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-green-700 transition" onClick={handleSave}>保存</button>
      </div>
      <div className="overflow-x-auto">
  <table className="min-w-[1600px] w-full text-base shadow-md rounded overflow-hidden bg-[#1e293b] text-[#1f2937]">
        <thead>
          <tr className="bg-[#1e293b] hover:bg-[#334155] border-b border-[#475569] text-[#1f2937]">
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">操作</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[150px]">会社名</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[150px]">担当社員</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[150px]">電話番号</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[150px]">案件名</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">契約開始日</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">契約終了日</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">単価(円/日)</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">勤務時間</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">入金日</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">支払日</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">必要人員</th>
            <th className="border px-2 py-1 text-[#1f2937] text-white min-w-[120px]">ファイル</th>
{projectCustomFields.map((field) => (
  <th key={field} className="border px-2 py-1 text-white">{field}</th>
))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
  <tr key={p.id} className="even:bg-white odd:bg-gray-50 hover:bg-gray-100 font-normal text-right text-[#1f2937]">
            <td className="p-2 border border-[#d1d5db] bg-[#f1f5f9] text-[#1f2937]">
      <div className="flex justify-center gap-2 text-[#1f2937]">
        <button onClick={() => handleEdit(i)} className="bg-blue-500 text-white font-bold px-2 py-1 rounded hover:bg-blue-600 transition">編集</button>
        <button onClick={() => handleDelete(i)} className="bg-red-500 text-white font-bold px-2 py-1 rounded hover:bg-red-600 transition">削除</button>
      </div>
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <input type="text" placeholder="入力してください"  disabled={editIndex !== i} value={p.company} onChange={(e) => handleInputChange(i, "company", e.target.value)} className="w-full border p-1 rounded text-right text-[#1f2937]" />
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <input type="text" placeholder="入力してください"  disabled={editIndex !== i} value={p.manager} onChange={(e) => handleInputChange(i, "manager", e.target.value)} className="w-full border p-1 rounded text-right text-[#1f2937]" />
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <input type="text" placeholder="入力してください"  disabled={editIndex !== i} value={p.phone} onChange={(e) => handleInputChange(i, "phone", e.target.value)} className="w-full border p-1 rounded text-right text-[#1f2937]" />
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <input type="text" placeholder="入力してください"  disabled={editIndex !== i} value={p.name} onChange={(e) => handleInputChange(i, "name", e.target.value)} className="w-full border p-1 rounded text-right text-[#1f2937]" />
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <input type="date" disabled={editIndex !== i} value={p.contractStart} onChange={(e) => handleInputChange(i, "contractStart", e.target.value)} className="w-full border p-1 rounded text-right text-[#1f2937]" />
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <input type="date" disabled={editIndex !== i} value={p.contractEnd} onChange={(e) => handleInputChange(i, "contractEnd", e.target.value)} className="w-full border p-1 rounded text-right text-[#1f2937]" />
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
  <input
    type="number"
    min={0}
    disabled={editIndex !== i}
    value={p.unitPrice}
    onChange={(e) => {
  const parsed = Number(e.target.value);
  handleInputChange(i, "unitPrice", Number.isNaN(parsed) ? 0 : parsed);
}}
    className="w-full border p-1 rounded text-right text-[#1f2937]"
  />
</td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <div className="flex gap-1 text-[#1f2937]">
        <select
         value={p.startTime}
          onChange={(e) => handleInputChange(i, "startTime", e.target.value)}
          disabled={editIndex !== i} 
          className="border rounded p-1 text-[#1f2937]"
          >
          {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span>〜</span>
        <select 
        value={p.endTime} 
        onChange={(e) => handleInputChange(i, "endTime", e.target.value)} 
        disabled={editIndex !== i} 
        className="border rounded p-1 text-[#1f2937]">
          {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <input type="text" placeholder="入力してください"  disabled={editIndex !== i} value={p.paymentDate} onChange={(e) => handleInputChange(i, "paymentDate", e.target.value)} className="w-full border p-1 rounded text-right text-[#1f2937]" />
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <input type="text" placeholder="入力してください"  disabled={editIndex !== i} value={p.transferDate} onChange={(e) => handleInputChange(i, "transferDate", e.target.value)} className="w-full border p-1 rounded text-right text-[#1f2937]" />
    </td>
            <td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
      <div className="flex gap-1 text-[#1f2937]">
        <input type="number" placeholder="入力してください"  disabled={editIndex !== i} value={p.requiredPeople} onChange={(e) => handleInputChange(i, "requiredPeople", e.target.value)} className="w-20 border p-1 rounded text-right text-[#1f2937]" />
        <select
  value={p.requiredUnit}
  onChange={(e) => handleInputChange(i, "requiredUnit", e.target.value)}
  className="border rounded p-1 text-[#1f2937]"
>
  <option value="名">名</option>
  <option value="コース">コース</option>
  <option value="台">台</option> {/* ★ 追加 */}
</select>
      </div>
    </td>
    
<td className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
  {editIndex === i ? (
    <div>
      <input
  type="file"
  multiple
  accept=".pdf,.jpeg,.jpg,.png"
  onChange={(e) => handleFileChange(i, e.target.files)}
  className="text-sm text-[#1f2937]"
/>
{p.attachments && p.attachments.length > 0 && (
  <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
    {p.attachments.map((a, idx) => (
      <li key={idx}>{a.name}</li>
    ))}
  </ul>
)}
    </div>
  ) : (
    
<span className="text-gray-500">
  {p.attachments && p.attachments.length > 0 ? (
  p.attachments.map((a, idx) => (
    <a
      key={idx}
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline mr-2"
      title={`${a.type} / ${a.size} bytes / ${a.uploadedAt}`}
    >
      {a.name}
    </a>
  ))
) : (
  <span className="text-gray-500">未添付</span>
)}
</span>

  )}
</td>
{projectCustomFields.map((field) => (
  <td key={field} className="p-2 border border-[#d1d5db] bg-[#f8fafc] text-[#1f2937]">
    {editIndex === i ? (
      <input
        type="text"
        value={p.customFields?.[field] || ""}
        onChange={(e) => handleCustomFieldChange(i, field, e.target.value)}
        className="w-full border p-1 rounded text-right"
      />
    ) : (
      <div className="text-right">{p.customFields?.[field] || ""}</div>
    )}
  </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
