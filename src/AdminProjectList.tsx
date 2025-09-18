import { useState, useEffect, useCallback } from "react";
import { getAuth } from "firebase/auth";

/** ========================= Types ========================= */
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
  unitPrice: number;
  startTime: string;
  endTime: string;
  paymentDate: string;
  transferDate: string;
  requiredPeople: string;
  requiredUnit: string;
  attachments?: Attachment[];
  customFields?: Record<string, string>;
};

/** ========================= API helpers =========================
 *  .env（どちらか）:
 *   - Vite:           VITE_API_BASE_URL=https://api.example.com
 *   - Next.js (App):  NEXT_PUBLIC_API_BASE=https://api.example.com
 */
const API_BASE: string =
  (((typeof process !== "undefined" ? (process as any) : undefined)?.env?.NEXT_PUBLIC_API_BASE) as string) ||
  (((typeof import.meta !== "undefined" ? (import.meta as any) : undefined)?.env?.VITE_API_BASE_URL) as string) ||
  "";

const joinURL = (base: string, path: string) => {
  if (!base) return path;
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
};

async function apiJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinURL(API_BASE, path);
  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status} at ${url}\n${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`Expected JSON but got "${ct || "unknown"}"\n` + text.slice(0, 200));
    err.status = 415;
    throw err;
  }
  return res.json();
}

const ProjectsAPI = {
  list: async (company: string) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<Project[]>(
      `/api/projects?company=${encodeURIComponent(company)}`,
      { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} }
    );
  },
  saveBulk: async (company: string, projects: Project[]) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<{ projects: Project[] }>(`/api/projects/save-bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ company, projects }),
    }).then((r) => r.projects);
  },
  remove: async (id: number) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<void>(`/api/projects/${id}`, {
      method: "DELETE",
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
  },
  uploadFiles: async (projectId: number, files: FileList) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    return apiJSON<Attachment[]>(`/api/projects/${projectId}/files`, {
      method: "POST",
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      body: form,
    });
  },
  customFields: async (company: string) => {
  const idToken = await getAuth().currentUser?.getIdToken?.();
  try {
    const data = await apiJSON<string[]>(
      `/api/projects/custom-fields?company=${encodeURIComponent(company)}`,
      { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} }
    );
    return Array.isArray(data) ? data : [];
  } catch (e: any) {
    // 本番が未実装/ローカル404でも UI を汚さない
    if (e?.status === 404) return [];
    return [];
  }
},
};

/** ========================= Fallback keys ========================= */
const projectStorageKey = (company: string) => `projectList_${company}`;

/** ========================= Component ========================= */
export default function AdminProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCustomFields, setProjectCustomFields] = useState<string[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 会社名は既存仕様に合わせて localStorage から（未設定なら demoCompany）
  const company =
    typeof window !== "undefined" ? (localStorage.getItem("company") || "demoCompany") : "demoCompany";

  /** 共通：サーバから最新取得（失敗時はローカル） */
  const reloadFromServer = useCallback(async () => {
  if (!company) return;
  setLoading(true);
  try {
    // 1) 案件リスト：失敗しても localStorage に静かにフォールバック
    let list: Project[] = [];
    try {
      list = await ProjectsAPI.list(company);
      localStorage.setItem(projectStorageKey(company), JSON.stringify(list ?? []));
    } catch {
      const local = JSON.parse(localStorage.getItem(projectStorageKey(company)) || "[]") as Project[];
      list = Array.isArray(local) ? local : [];
      // サーバ失敗時でも UI を汚さない（メッセージを出さない）
      console.warn("[projects] server fetch failed. show local fallback.");
    }

    // 2) カスタム項目：404 は ProjectsAPI.customFields 側で [] を返す想定。例外なら []。
    let fields: string[] = [];
    try {
      fields = await ProjectsAPI.customFields(company);
    } catch {
      fields = [];
      console.warn("[custom-fields] fetch error. use []");
    }

    setProjects(list);
    setProjectCustomFields(fields);
    setErr(null); // フォールバック成功時はエラーを出さない
  } finally {
    setLoading(false);
  }
}, [company]);

  // 初期ロード
  useEffect(() => {
    reloadFromServer();
  }, [reloadFromServer]);

  // 他タブ/他端末更新を取り込み
  useEffect(() => {
    const reload = () => reloadFromServer();
    window.addEventListener("projects:changed", reload);
    window.addEventListener("focus", reload);
    const onVis = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("projects:changed", reload);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reloadFromServer]);

  /** ========================= Handlers ========================= */
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

  const handleEdit = (index: number) => setEditIndex(index);

  const handleSave = async () => {
    try {
      const saved = await ProjectsAPI.saveBulk(company, projects);
      setProjects(saved);
      localStorage.setItem(projectStorageKey(company), JSON.stringify(saved));
      setMsg("保存しました。");
      setErr(null);
    } catch (e: any) {
      // サーバ未実装（404/415 等）はローカルへ保存して成功扱い
      localStorage.setItem(projectStorageKey(company), JSON.stringify(projects));
      setProjects(projects);
      setMsg("（ローカルに）保存しました。");
      setErr(null);
    }
  };

  const handleDelete = async (index: number) => {
    const target = projects[index];
    if (!window.confirm("本当にこの案件を削除しますか？")) return;
    try {
      if (target.id > 0) await ProjectsAPI.remove(target.id);
      const updated = projects.filter((_, i) => i !== index);
      setProjects(updated);
      localStorage.setItem(projectStorageKey(company), JSON.stringify(updated));
      setMsg("削除しました");
      setErr(null);
      window.dispatchEvent(new Event("projects:changed"));
      await reloadFromServer();
    } catch (e: any) {
      setErr(e?.message ?? "削除に失敗しました");
    }
  };

  const handleFileChange = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    // 1) ID未確定（負ID）なら先に保存して採番
    let proj = projects[index];
    if (proj.id < 0) {
      try {
        const saved = await ProjectsAPI.saveBulk(company, projects);
        setProjects(saved);
        proj = saved.find((p) => p.name === proj.name && p.company === proj.company) || saved[index];
        if (!proj || proj.id < 0) throw new Error("ID割当が完了していません");
      } catch (e: any) {
        setErr(e?.message ?? "先に案件の保存に失敗しました。ファイルはアップロードできません。");
        return;
      }
    }

    // 2) 添付アップロード → サーバのURL/メタを取り込み直す
    try {
      const newAttachments = await ProjectsAPI.uploadFiles(proj.id, files);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === proj.id ? { ...p, attachments: [...(p.attachments || []), ...newAttachments] } : p
        )
      );
      setMsg("ファイルをアップロードしました");
      setErr(null);
      window.dispatchEvent(new Event("projects:changed"));
      await reloadFromServer();
    } catch (e: any) {
      setErr(e?.message ?? "ファイルのアップロードに失敗しました");
    }
  };

  const handleAdd = () => {
    const newProject: Project = {
      id: -Date.now(), // サーバ採番までの一時ID
      company,
      manager: "",
      phone: "",
      name: "",
      contractStart: "",
      contractEnd: "",
      unitPrice: 0,
      startTime: "08:00",
      endTime: "17:00",
      paymentDate: "",
      transferDate: "",
      requiredPeople: "0",
      requiredUnit: "名",
      attachments: [],
      customFields: {},
    };
    setProjects((prev) => [...prev, newProject]);
    setEditIndex(projects.length);
  };

  /** ========================= UI ========================= */
  const timeOptions = Array.from({ length: 24 * 12 }, (_, i) => {
    const h = String(Math.floor(i / 12)).padStart(2, "0");
    const m = String((i % 12) * 5).padStart(2, "0");
    return `${h}:${m}`;
  });

  if (loading) return <div className="p-4">読み込み中…</div>;

  return (
    <div className="p-4 font-sans tracking-wide text-base text-[#1f2937]">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-3 text-white">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
        </svg>
        案件一覧 <span className="text-sm text-gray-500 ml-2">-Project List-</span>
      </h1>

      {err && <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-sm">{err}</div>}
      {msg && <div className="mb-3 p-2 rounded bg-green-50 text-green-700 text-sm">{msg}</div>}

      <div className="flex gap-2 mb-4 text-[#1f2937]">
        <button className="bg-blue-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-blue-700 transition" onClick={handleAdd}>
          新規案件追加
        </button>
        <button className="bg-green-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-green-700 transition" onClick={handleSave}>
          保存
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1600px] w-full text-base shadow-md rounded overflow-hidden bg-[#1e293b] text-[#1f2937]">
          <thead>
            <tr className="bg-[#1e293b] hover:bg-[#334155] border-b border-[#475569] text-[#1f2937]">
              <th className="border px-2 py-1 text-white min-w-[120px]">操作</th>
              <th className="border px-2 py-1 text-white min-w-[150px]">会社名</th>
              <th className="border px-2 py-1 text-white min-w-[150px]">担当社員</th>
              <th className="border px-2 py-1 text-white min-w-[150px]">電話番号</th>
              <th className="border px-2 py-1 text-white min-w-[150px]">案件名</th>
              <th className="border px-2 py-1 text-white min-w-[120px]">契約開始日</th>
              <th className="border px-2 py-1 text-white min-w-[120px]">契約終了日</th>
              <th className="border px-2 py-1 text-white min-w-[120px]">単価(円/日)</th>
              <th className="border px-2 py-1 text-white min-w-[120px]">勤務時間</th>
              <th className="border px-2 py-1 text-white min-w-[120px]">入金日</th>
              <th className="border px-2 py-1 text-white min-w-[120px]">支払日</th>
              <th className="border px-2 py-1 text-white min-w-[120px]">必要人員</th>
              <th className="border px-2 py-1 text-white min-w-[120px]">ファイル</th>
              {projectCustomFields.map((field) => (
                <th key={field} className="border px-2 py-1 text-white">{field}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p, i) => (
              <tr key={p.id} className="even:bg-white odd:bg-gray-50 hover:bg-gray-100 font-normal text-right text-[#1f2937]">
                <td className="p-2 border border-[#d1d5db] bg-[#f1f5f9]">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => handleEdit(i)} className="bg-blue-500 text-white font-bold px-2 py-1 rounded hover:bg-blue-600 transition">編集</button>
                    <button onClick={() => handleDelete(i)} className="bg-red-500 text-white font-bold px-2 py-1 rounded hover:bg-red-600 transition">削除</button>
                  </div>
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input type="text" placeholder="入力してください" disabled={editIndex !== i} value={p.company} onChange={(e) => handleInputChange(i, "company", e.target.value)} className="w-full border p-1 rounded text-right" />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input type="text" placeholder="入力してください" disabled={editIndex !== i} value={p.manager} onChange={(e) => handleInputChange(i, "manager", e.target.value)} className="w-full border p-1 rounded text-right" />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input type="text" placeholder="入力してください" disabled={editIndex !== i} value={p.phone} onChange={(e) => handleInputChange(i, "phone", e.target.value)} className="w-full border p-1 rounded text-right" />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input type="text" placeholder="入力してください" disabled={editIndex !== i} value={p.name} onChange={(e) => handleInputChange(i, "name", e.target.value)} className="w-full border p-1 rounded text-right" />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input type="date" disabled={editIndex !== i} value={p.contractStart} onChange={(e) => handleInputChange(i, "contractStart", e.target.value)} className="w-full border p-1 rounded text-right" />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input type="date" disabled={editIndex !== i} value={p.contractEnd} onChange={(e) => handleInputChange(i, "contractEnd", e.target.value)} className="w-full border p-1 rounded text-right" />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input
                    type="number"
                    min={0}
                    disabled={editIndex !== i}
                    value={p.unitPrice}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      handleInputChange(i, "unitPrice", Number.isNaN(parsed) ? 0 : parsed);
                    }}
                    className="w-full border p-1 rounded text-right"
                  />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <div className="flex gap-1">
                    <select value={p.startTime} onChange={(e) => handleInputChange(i, "startTime", e.target.value)} disabled={editIndex !== i} className="border rounded p-1">
                      {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span>〜</span>
                    <select value={p.endTime} onChange={(e) => handleInputChange(i, "endTime", e.target.value)} disabled={editIndex !== i} className="border rounded p-1">
                      {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input type="text" placeholder="入力してください" disabled={editIndex !== i} value={p.paymentDate} onChange={(e) => handleInputChange(i, "paymentDate", e.target.value)} className="w-full border p-1 rounded text-right" />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <input type="text" placeholder="入力してください" disabled={editIndex !== i} value={p.transferDate} onChange={(e) => handleInputChange(i, "transferDate", e.target.value)} className="w-full border p-1 rounded text-right" />
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  <div className="flex gap-1">
                    <input type="number" placeholder="入力してください" disabled={editIndex !== i} value={p.requiredPeople} onChange={(e) => handleInputChange(i, "requiredPeople", e.target.value)} className="w-20 border p-1 rounded text-right" />
                    <select value={p.requiredUnit} onChange={(e) => handleInputChange(i, "requiredUnit", e.target.value)} className="border rounded p-1">
                      <option value="名">名</option>
                      <option value="コース">コース</option>
                      <option value="台">台</option>
                    </select>
                  </div>
                </td>

                <td className="p-2 border bg-[#f8fafc]">
                  {editIndex === i ? (
                    <div>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpeg,.jpg,.png"
                        onChange={(e) => handleFileChange(i, e.target.files)}
                        className="text-sm"
                      />
                      {p.attachments && p.attachments.length > 0 && (
                        <ul className="mt-1 list-disc pl-5 text-sm text-gray-700 text-left">
                          {p.attachments.map((a, idx) => (<li key={idx}>{a.name}</li>))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-700">
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
                  <td key={field} className="p-2 border bg-[#f8fafc]">
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
