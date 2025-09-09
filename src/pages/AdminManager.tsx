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
    return apiJSON<AdminUser>(`/api/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
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
        if (!isProd && [0, 401, 403, 404, 415, 500, 502, 503].includes(s)) {
          // 開発時のみ localStorage にフォールバック
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
      // 毎回パスワード新規発行（画面には最後に成功した1回だけ表示）
      password = Math.random().toString(36).slice(-8);
      try {
        const r = await provisionAdminAuth(company, loginId, password);
        uid = r.uid;
        break; // 成功
      } catch (e: any) {
        if (e?.status === 409) {
          // ID衝突 → 末尾番号を+1して再試行（admin0001 → admin0002 → …）
          const m = loginId.match(/^admin(\d{4})$/);
          const n = m ? String(Number(m[1]) + 1).padStart(4, "0") : "0001";
          loginId = `admin${n}`;
          attempts++;
          continue;
        }
        throw e; // その他のエラーはそのまま外側のcatchへ
      }
    }

    if (!uid) {
      alert("ログインIDの重複で作成できませんでした。もう一度お試しください。");
      return;
    }

    // 2) サーバに管理者レコードを保存（会社でスコープ）
    await AdminsAPI.create({
      company,
      contactPerson: draft.contactPerson || "",
      phone: draft.phone || "",
      uid,
      loginId,
      attachments: draft.attachments || [],
      // ここにカスタム項目を展開
      ...customFields.reduce<Record<string, any>>((acc, k) => {
        acc[k] = (draft as any)[k] ?? "";
        return acc;
      }, {}),
    });

    // 3) 再読込（全員に共有される）
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
    if (!isProd && [0, 401, 403, 404, 415, 500, 502, 503].includes(s)) {
      // 開発フォールバック（本番は通らない）
      const next = [
        ...admins,
        { ...draft, id: admins.length, company, uid: draft.uid || "dev-uid", loginId },
      ];
      persistLocal(next);
      alert(
        `（開発）ローカルに追加: ${loginId}\nパスワード: ${password}\n※本番ではサーバ保存に切り替わります。`
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
        // 会社は固定（クロス会社変更を禁止）
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

  /** 行レンダリング（会社名は固定表示・編集不可に変更） */
  const renderRow = (admin: AdminUser) => {
    const isEdit = editRowId === admin.id;
    return (
      <tr key={admin.id} className="text-center hover:bg-gray-50">
        <td className="border px-3 py-2 w-28">
          {isEdit ? (
            <>
              <button className="bg-green-600 text-white px-2 py-1 rounded mr-1" onClick={saveEdit}>保存</button>
              <button className="bg-gray-400 text-white px-2 py-1 rounded" onClick={() => { setEditRowId(null); setDraft(emptyAdmin); }}>キャンセル</button>
            </>
          ) : (
            <>
              <button className="bg-blue-600 text-white px-2 py-1 rounded mr-1" onClick={() => startEdit(admin)}>編集</button>
              <button className="bg-red-600 text-white px-2 py-1 rounded" onClick={() => deleteRow(admin.id)}>削除</button>
            </>
          )}
        </td>
        {/* 会社名：編集不可（会社内で共有するため固定） */}
        <td className="border px-3 py-2">{admin.company}</td>
        <td className="border px-3 py-2">
          {isEdit ? (
            <input className="w-full border px-2 py-1" value={draft.contactPerson} onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })} />
          ) : admin.contactPerson}
        </td>
        <td className="border px-3 py-2">
          {isEdit ? (
            <input className="w-full border px-2 py-1" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          ) : admin.phone}
        </td>
        <td className="border px-3 py-2">{admin.uid}</td>
        <td className="border px-3 py-2">{admin.loginId}</td>
        <td className="border px-3 py-2">••••••</td>
        {customFields.map((field, idx) => (
          <td key={idx} className="border px-3 py-2">
            {isEdit ? (
              <input
                className="w-full border px-2 py-1"
                value={draft[field] || ""}
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
              />
            ) : (
              admin[field] || ""
            )}
          </td>
        ))}
        <td className="border px-3 py-2 text-left">
          {isEdit ? (
            <div>
              <input type="file" multiple onChange={handleFileChange} className="mb-2" />
              <ul className="text-xs space-y-1">
                {draft.attachments.map((att, idx) => (
                  <li key={idx} className="flex justify-between">
                    <a href={att.dataUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{att.name}</a>
                    <button onClick={() => removeAttachment(idx)} className="text-red-600 ml-2">削除</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="text-xs space-y-1">
              {admin.attachments?.map((att, idx) => {
                const byteString = atob(att.dataUrl.split(",")[1]);
                const mimeString = att.dataUrl.split(",")[0].split(":")[1].split(";")[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                const blob = new Blob([ab], { type: mimeString });
                const blobUrl = URL.createObjectURL(blob);
                return (
                  <li key={idx}>
                    <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
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
      <h1 className="text-2xl font-bold mb-4">
        👤 管理者管理<span className="ml-2 text-sm text-gray-500">-AdminManager-</span>
      </h1>

      <button
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded"
        onClick={() => {
          setDraft({ ...emptyAdmin, company }); // 会社は固定
          setIsAdding(true);
        }}
      >
        ＋ ユーザー追加
      </button>

      <table className="min-w-full border border-gray-300 bg-white rounded shadow text-sm">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="border px-3 py-2 w-28">操作</th>
            <th className="border px-3 py-2">会社名</th>
            <th className="border px-3 py-2">担当者</th>
            <th className="border px-3 py-2">電話番号</th>
            <th className="border px-3 py-2">UID</th>
            <th className="border px-3 py-2">ログインID</th>
            <th className="border px-3 py-2">パスワード（非表示）</th>
            {customFields.map((field, idx) => (
              <th key={idx} className="border px-3 py-2">{field}</th>
            ))}
            <th className="border px-3 py-2">添付ファイル</th>
          </tr>
        </thead>
        <tbody>
          {admins.map(renderRow)}
          {isAdding && (
            <tr className="text-center bg-yellow-50">
              <td className="border px-3 py-2 w-28">追加中</td>
              {/* 会社名は固定表示（編集不可） */}
              <td className="border px-3 py-2">
                <span className="text-gray-800">{company || "—"}</span>
              </td>
              <td className="border px-3 py-2">
                <input className="w-full border px-2 py-1" value={draft.contactPerson} onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })} />
              </td>
              <td className="border px-3 py-2">
                <input className="w-full border px-2 py-1" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </td>
              <td className="border px-3 py-2 text-gray-500">作成時に自動設定</td>
              <td className="border px-3 py-2 text-gray-500">自動発行</td>
              <td className="border px-3 py-2 text-gray-500">自動発行</td>
              {customFields.map((field, idx) => (
                <td key={idx} className="border px-3 py-2">
                  <input
                    className="w-full border px-2 py-1"
                    value={(draft as any)[field] || ""}
                    onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                  />
                </td>
              ))}
              <td className="border px-3 py-2">
                <input type="file" multiple onChange={handleFileChange} className="mb-2" />
                <ul className="text-xs space-y-1">
                  {draft.attachments.map((att, idx) => (
                    <li key={idx} className="flex justify-between">
                      <a href={att.dataUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{att.name}</a>
                      <button onClick={() => removeAttachment(idx)} className="text-red-600 ml-2">削除</button>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isAdding && (
        <div className="mt-4 flex gap-4">
          <button onClick={handleAdd} className="bg-green-600 text-white px-4 py-2 rounded">追加</button>
          <button onClick={() => { setIsAdding(false); setDraft(emptyAdmin); }} className="bg-gray-400 text-white px-4 py-2 rounded">キャンセル</button>
        </div>
      )}
    </div>
  );
};

export default AdminManager;
