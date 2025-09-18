"use client";
import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";

/** ===== 型定義 ===== */
type AdminUser = {
  id: number;
  company: string;
  contactPerson: string;
  phone: string;
  uid: string;
  loginId: string;
  // password は画面/DBに保存しない（API入力のみ）
  attachments: { name: string; dataUrl: string }[];
  [key: string]: any;
};

/** ===== API 基盤 ===== */
const API_BASE: string =
  // Next.js
  (((typeof process !== "undefined" ? (process as any) : undefined)?.env?.NEXT_PUBLIC_API_BASE) as string) ||
  // Vite
  (((typeof import.meta !== "undefined" ? (import.meta as any) : undefined)?.env?.VITE_API_BASE_URL) as string) ||
  "";

/** base と path を安全結合 */
function joinURL(base: string, path: string) {
  if (!base) return path;
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

/** JSON フェッチ（HTMLが返る等は 415 で投げる） */
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
    const err: any = new Error(`Expected JSON but got "${ct || "unknown"}" from ${url}\n` + text.slice(0, 200));
    err.status = 415;
    throw err;
  }
  return res.json();
}

/** ===== Admins API ===== */
const AdminsAPI = {
  list: async (company: string) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<AdminUser[]>(
      `/api/admins?company=${encodeURIComponent(company)}`,
      { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} }
    );
  },
  create: async (payload: Omit<AdminUser, "id"> & { password?: string }) => {
  const idToken = await getAuth().currentUser?.getIdToken?.();
  try {
    return await apiJSON<AdminUser>(`/api/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    // 404/415(HTML応答) 等は上位でローカル保存へフォールバックさせる
    throw err;
  }
},
  update: async (id: number, patch: Partial<AdminUser>) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<AdminUser>(`/api/admins/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(patch),
    });
  },
  remove: async (id: number) => {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return apiJSON<{}>(`/api/admins/${id}`, {
      method: "DELETE",
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
  },
};

/** ===== 会社解決（最小実装：このファイル内で完結） ===== */
async function resolveCompany(): Promise<string> {
  // 同期ソース
  try {
    const cur = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (cur?.company) return String(cur.company).trim();
  } catch {}
  try {
    const admin = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}");
    if (admin?.company) return String(admin.company).trim();
  } catch {}
  const saved = (localStorage.getItem("company") || "").trim();
  if (saved) return saved;
  const qs = new URLSearchParams(window.location.search).get("company");
  if (qs) return qs.trim();

  // 非同期ソース
  try {
    const res = await getAuth().currentUser?.getIdTokenResult?.();
    const claim = (res?.claims as any)?.company;
    if (claim) return String(claim).trim();
  } catch {}
  try {
    const me = await apiJSON<{ company?: string }>(`/api/me`).catch(() => null as any);
    if (me?.company) return String(me.company).trim();
  } catch {}

  return "";
}

/** ===== ユーティリティ ===== */
const isProd = process.env.NODE_ENV === "production";

const generateLoginCredentials = (existingAdmins: AdminUser[]) => {
  const existingIds = existingAdmins.map((a) => a.loginId);
  let num = 1;
  while (true) {
    const candidateId = `admin${String(num).padStart(4, "0")}`;
    if (!existingIds.includes(candidateId)) break;
    num++;
  }
  const loginId = `admin${String(num).padStart(4, "0")}`;
  const password = Math.random().toString(36).slice(-8);
  return { loginId, password };
};

/** 認証ユーザー作成（UID 取得） */
const provisionAdminAuth = async (company: string, loginId: string, password: string) => {
  const idToken = await getAuth().currentUser?.getIdToken?.();
  return apiJSON<{ uid: string; email: string }>(`/api/admins/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ company, loginId, password }),
  });
};

/** ====== コンポーネント ====== */
const AdminManager = () => {
  const ADMIN_STORAGE_KEY = "adminMaster"; // 開発時のみのフォールバック用
  const [company, setCompany] = useState<string>("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<string[]>([]);

  const emptyAdmin: AdminUser = useMemo(() => ({
    id: -1,
    company: "",
    contactPerson: "",
    phone: "",
    uid: "",
    loginId: "",
    attachments: [],
  }), []);

  const [draft, setDraft] = useState<AdminUser>(emptyAdmin);

  /** 起動時：会社を解決 → 一覧読込 */
  useEffect(() => {
    (async () => {
      const c = await resolveCompany();
      setCompany(c);
      if (c) localStorage.setItem("company", c);
    })();
    const savedFields = localStorage.getItem("adminCustomFields");
    if (savedFields) setCustomFields(JSON.parse(savedFields));
  }, []);

  useEffect(() => {
    if (!company) return;
    const load = async () => {
      try {
        const list = await AdminsAPI.list(company);
        setAdmins(list ?? []);
      } catch (e: any) {
  const s = e?.status ?? 0;
  if ([0, 401, 403, 404, 415, 500, 502, 503].includes(s)) {
    // ✅ 本番でも localStorage にフォールバック（API未実装の間の暫定策）
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    setAdmins(raw ? JSON.parse(raw) : []);
  } else {
    throw e;
  }
}
    };
    load();
  }, [company]);

  /** 開発フォールバック時だけ使う */
  const persistLocal = (next: AdminUser[]) => {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(next));
    setAdmins(next);
  };

  /** 追加 */
  const handleAdd = async () => {
    if (!company) {
      alert("会社が未確定です。ログインまたは URL の ?company=… を確認してください。");
      return;
    }

    // ── 409（重複）に強いID発行＋Auth作成ループ ──
    const { loginId: seedId } = generateLoginCredentials(admins);
    let loginId = seedId;
    let password = "";
    let uid = "";
    let attempts = 0;

    try {
      while (attempts < 5) {
        password = Math.random().toString(36).slice(-8);
        try {
          const r = await provisionAdminAuth(company, loginId, password);
          uid = r.uid;
          break; // 成功
        } catch (e: any) {
          if (e?.status === 409) {
            const m = loginId.match(/^admin(\d{4})$/);
            const n = m ? String(Number(m[1]) + 1).padStart(4, "0") : "0001";
            loginId = `admin${n}`;
            attempts++;
            continue;
          }
          throw e;
        }
      }

      if (!uid) {
        alert("ログインIDの重複で作成できませんでした。もう一度お試しください。");
        return;
      }

      await AdminsAPI.create({
        company,
        contactPerson: draft.contactPerson || "",
        phone: draft.phone || "",
        uid,
        loginId,
        attachments: draft.attachments || [],
        ...customFields.reduce<Record<string, any>>((acc, k) => {
          acc[k] = (draft as any)[k] ?? "";
          return acc;
        }, {}),
      });

      const list = await AdminsAPI.list(company);
      setAdmins(list ?? []);
      alert(
        `✅ 管理者を追加しました（会社: ${company}）\n` +
        `ログインID: ${loginId}\n` +
        `初回パスワード: ${password}\n\n` +
        `※パスワードは今回のみ表示し、保存しません。`
      );
      setDraft(emptyAdmin);
      setIsAdding(false);
    } catch (e: any) {
  const s = e?.status ?? 0;
  if ([0, 401, 403, 404, 415, 500, 502, 503].includes(s)) {
    // ✅ 本番でもローカル保存フォールバック
    const next = [
      ...admins,
      { ...draft, id: admins.length, company, uid: draft.uid || "local-uid", loginId },
    ];
    persistLocal(next);
    alert(
      `（ローカルに）管理者を追加しました。\n` +
      `ログインID: ${loginId}\n初回パスワード: ${password}\n` +
      `※ API 実装後はサーバ保存に切り替わります。`
    );
    setDraft(emptyAdmin);
    setIsAdding(false);
  } else {
    console.error(e);
    alert("追加に失敗しました。権限・ネットワーク・API設定を確認してください。");
  }
}
  };

  /** 編集保存 */
  const saveEdit = async () => {
    if (editRowId == null) return;
    try {
      await AdminsAPI.update(editRowId, {
        contactPerson: draft.contactPerson,
        phone: draft.phone,
        attachments: draft.attachments,
        ...customFields.reduce<Record<string, any>>((acc, k) => {
          acc[k] = (draft as any)[k] ?? "";
          return acc;
        }, {}),
      });
      const list = await AdminsAPI.list(company);
      setAdmins(list ?? []);
      setEditRowId(null);
      setDraft(emptyAdmin);
    } catch (e: any) {
      const s = e?.status ?? 0;
      if (!isProd && [0, 401, 403, 404, 415, 500, 502, 503].includes(s)) {
        const next = admins.map((a) => (a.id === editRowId ? { ...draft, company } as AdminUser : a));
        persistLocal(next);
        setEditRowId(null);
        setDraft(emptyAdmin);
      } else {
        console.error(e);
        alert("保存に失敗しました。");
      }
    }
  };

  /** 削除 */
  const deleteRow = async (rowId: number) => {
    if (!window.confirm("本当に削除しますか？")) return;
    try {
      await AdminsAPI.remove(rowId);
      const list = await AdminsAPI.list(company);
      setAdmins(list ?? []);
    } catch (e: any) {
      const s = e?.status ?? 0;
      if (!isProd && [0, 401, 403, 404, 415, 500, 502, 503].includes(s)) {
        const next = admins.filter((a) => a.id !== rowId).map((a, idx) => ({ ...a, id: idx }));
        persistLocal(next);
      } else {
        console.error(e);
        alert("削除に失敗しました。");
      }
    }
  };

  /** 添付（今回も dataUrl のまま。必要なら API 化に差し替え） */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 10);
    const attachments = await Promise.all(
      files.map(
        (file) =>
          new Promise<{ name: string; dataUrl: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, dataUrl: reader.result as string });
            reader.readAsDataURL(file);
          })
      )
    );
    setDraft({ ...draft, attachments });
  };
  const removeAttachment = (index: number) => {
    const updated = draft.attachments.filter((_, i) => i !== index);
    setDraft({ ...draft, attachments: updated });
  };

  const startEdit = (row: AdminUser) => {
    setDraft({ ...row });
    setEditRowId(row.id);
  };

  /** 行レンダリング（会社名は固定表示・編集不可） */
  const renderRow = (admin: AdminUser) => {
    const isEdit = editRowId === admin.id;
    return (
      <tr
        key={admin.id}
        className="group text-center bg-white hover:bg-emerald-50 transition-colors"
      >
        {/* 操作列（左固定で視認性UP） */}
        <td className="sticky left-0 z-[1] bg-white border-r border-slate-200 px-3 py-2 w-36 shadow-[1px_0_0_0_rgba(226,232,240,1)]">
          {isEdit ? (
            <div className="flex gap-2 justify-center">
              <button
                className="bg-emerald-600 text-white px-3 py-1 rounded-md text-xs hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                onClick={saveEdit}
              >
                保存
              </button>
              <button
                className="bg-slate-400 text-white px-3 py-1 rounded-md text-xs hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                onClick={() => { setEditRowId(null); setDraft(emptyAdmin); }}
              >
                ｷｬﾝｾﾙ
              </button>
            </div>
          ) : (
            <div className="flex gap-2 justify-center">
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                onClick={() => startEdit(admin)}
              >
                編集
              </button>
              <button
                className="bg-rose-600 text-white px-3 py-1 rounded-md text-xs hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                onClick={() => deleteRow(admin.id)}
              >
                削除
              </button>
            </div>
          )}
        </td>

        {/* 会社名：編集不可 */}
        <td className="px-4 py-2 text-slate-800">{admin.company}</td>

        <td className="px-4 py-2">
          {isEdit ? (
            <input
              className="w-full border border-slate-300 rounded-md px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={draft.contactPerson}
              onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })}
            />
          ) : (
            <span className="text-slate-900">{admin.contactPerson}</span>
          )}
        </td>

        <td className="px-4 py-2">
          {isEdit ? (
            <input
              className="w-full border border-slate-300 rounded-md px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          ) : (
            <span className="text-slate-900">{admin.phone}</span>
          )}
        </td>

        {/* 視認性向上：UID/ログインIDをバッジ表示（項目はそのまま） */}
        <td className="px-4 py-2">
          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {admin.uid}
          </span>
        </td>

        <td className="px-4 py-2">
          <span className="inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {admin.loginId}
          </span>
        </td>

        <td className="px-4 py-2">
          <span className="tracking-widest text-slate-500">••••••</span>
        </td>

        {customFields.map((field, idx) => (
          <td key={idx} className="px-4 py-2">
            {isEdit ? (
              <input
                className="w-full border border-slate-300 rounded-md px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={draft[field] || ""}
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
              />
            ) : (
              <span className="text-slate-900">{admin[field] || ""}</span>
            )}
          </td>
        ))}

        {/* 添付 */}
        <td className="px-4 py-2 text-left">
          {isEdit ? (
            <div>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="mb-2 block text-sm text-slate-700"
              />
              <ul className="text-xs space-y-1">
                {draft.attachments.map((att, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <a
                      href={att.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 underline hover:text-blue-800"
                    >
                      {att.name}
                    </a>
                    <button
                      onClick={() => removeAttachment(idx)}
                      className="text-rose-600 hover:text-rose-700 ml-2"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="text-xs space-y-1">
              {admin.attachments?.map((att, idx) => {
                const byteString = atob(att.dataUrl.split(",")[1] || "");
                const mimeString = (att.dataUrl.split(",")[0]?.split(":")[1]?.split(";")[0]) || "application/octet-stream";
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                const blob = new Blob([ab], { type: mimeString });
                const blobUrl = URL.createObjectURL(blob);
                return (
                  <li key={idx}>
                    <a
                      href={blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 underline hover:text-blue-800"
                    >
                      {att.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 font-sans">
      <h1 className="text-2xl font-bold mb-4 text-white">
  👤 <span className="align-middle">管理者管理</span>
  <span className="ml-2 text-sm text-white/70">- AdminManager -</span>
</h1>

      <button
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        onClick={() => {
          setDraft({ ...emptyAdmin, company }); // 会社は固定
          setIsAdding(true);
        }}
      >
        ＋ ユーザー追加
      </button>

      {/* === ここから革新的テーブルUI（項目は一切変更なし） === */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm relative">
        {/* 上部バー（情報帯） */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <span className="text-xs text-slate-600">
            テーブルは横スクロール対応 / 操作列は左固定
          </span>
          <span className="text-xs text-slate-500">
            合計: <span className="font-semibold text-slate-700">{admins.length}</span> 件
          </span>
        </div>

        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-[2] bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80">
            <tr className="text-left text-slate-700">
              <th className="sticky left-0 z-[3] bg-slate-50/95 px-3 py-3 w-36 font-semibold border-r border-slate-200">操作</th>
              <th className="px-4 py-3 font-semibold">会社名</th>
              <th className="px-4 py-3 font-semibold">担当者</th>
              <th className="px-4 py-3 font-semibold">電話番号</th>
              <th className="px-4 py-3 font-semibold">UID</th>
              <th className="px-4 py-3 font-semibold">ログインID</th>
              <th className="px-4 py-3 font-semibold">パスワード（非表示）</th>
              {customFields.map((field, idx) => (
                <th key={idx} className="px-4 py-3 font-semibold">{field}</th>
              ))}
              <th className="px-4 py-3 font-semibold">添付ファイル</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {admins.map(renderRow)}

            {isAdding && (
              <tr className="text-center bg-yellow-50">
                <td className="sticky left-0 z-[1] bg-yellow-50 px-3 py-2 w-36 border-r border-slate-200">
                  追加中
                </td>
                {/* 会社名は固定表示（編集不可） */}
                <td className="px-4 py-2">
                  <span className="text-slate-800">{company || "—"}</span>
                </td>
                <td className="px-4 py-2">
                  <input
                    className="w-full border border-slate-300 rounded-md px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={draft.contactPerson}
                    onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    className="w-full border border-slate-300 rounded-md px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </td>
                <td className="px-4 py-2 text-slate-500">作成時に自動設定</td>
                <td className="px-4 py-2 text-slate-500">自動発行</td>
                <td className="px-4 py-2 text-slate-500">自動発行</td>
                {customFields.map((field, idx) => (
                  <td key={idx} className="px-4 py-2">
                    <input
                      className="w-full border border-slate-300 rounded-md px-2 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      value={(draft as any)[field] || ""}
                      onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                    />
                  </td>
                ))}
                <td className="px-4 py-2">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="mb-2 block text-sm text-slate-700"
                  />
                  <ul className="text-xs space-y-1">
                    {draft.attachments.map((att, idx) => (
                      <li key={idx} className="flex justify-between">
                        <a
                          href={att.dataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 underline hover:text-blue-800"
                        >
                          {att.name}
                        </a>
                        <button
                          onClick={() => removeAttachment(idx)}
                          className="text-rose-600 hover:text-rose-700 ml-2"
                        >
                          削除
                        </button>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <div className="mt-4 flex gap-4">
          <button
            onClick={handleAdd}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            追加
          </button>
          <button
            onClick={() => { setIsAdding(false); setDraft(emptyAdmin); }}
            className="bg-slate-400 text-white px-4 py-2 rounded-md shadow hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminManager;
