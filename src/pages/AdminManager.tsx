import React, { useEffect, useState } from "react";

/** 型定義  */
type AdminUser = {
  id: number;
  company: string;
  contactPerson: string;
  phone: string;
  uid: string;
  loginId: string;   // ✅追加
  password: string;
  attachments: { name: string; dataUrl: string }[];
  [key: string]: any; // カスタム項目のための動的プロパティ
};

const generateLoginCredentials = (existingAdmins: AdminUser[]) => {
  const existingIds = existingAdmins.map((a) => a.loginId);
  let num = 1;
  while (true) {
    const candidateId = `admin${String(num).padStart(4, "0")}`;
    if (!existingIds.includes(candidateId)) {
      break;
    }
    num++;
  }
  const loginId = `admin${String(num).padStart(4, "0")}`;
  const password = Math.random().toString(36).slice(-8); // ランダム8文字
  return { loginId, password };
};

const AdminManager = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<string[]>([]);

  const emptyAdmin: AdminUser = {
    id: -1,
    company: "",
    contactPerson: "",
    phone: "",
    uid: "",
    loginId: "", // ✅追加
    password: "",
    attachments: [],
  };

  const [draft, setDraft] = useState<AdminUser>(emptyAdmin);

  useEffect(() => {
    const raw = localStorage.getItem("customerMaster");
    if (raw) {
      const customers = JSON.parse(raw);
      const formatted: AdminUser[] = customers.map((c: any, index: number) => ({
        id: index,
        company: c.company,
        contactPerson: c.contactPerson,
        phone: c.phone ?? "",
        uid: c.uid,
        attachments: c.attachments ?? [],
        ...c, // カスタム項目も含める
      }));
      setAdmins(formatted);
    }

    const savedFields = localStorage.getItem("adminCustomFields");
    if (savedFields) {
      setCustomFields(JSON.parse(savedFields));
    }
  }, []);

  const persist = (next: AdminUser[]) => {
    localStorage.setItem("customerMaster", JSON.stringify(next));
    setAdmins(next);
  };

  const handleAdd = () => {
  const { loginId, password } = generateLoginCredentials(admins); // ✅追加
  const next = [
    ...admins,
    { ...draft, id: admins.length, loginId, password } // ✅IDとパスワードを追加
  ];
  persist(next);

  // ✅ 登録後に表示
  alert(`✅ 管理者が追加されました\nログインID: ${loginId}\nパスワード: ${password}`);

  setDraft(emptyAdmin);
  setIsAdding(false);
};

  const startEdit = (row: AdminUser) => {
    setDraft({ ...row });
    setEditRowId(row.id);
  };

  const saveEdit = () => {
    const next = admins.map((a) => (a.id === editRowId ? draft : a));
    persist(next);
    setEditRowId(null);
    setDraft(emptyAdmin);
  };

  const deleteRow = (rowId: number) => {
    if (!window.confirm("本当に削除しますか？")) return;
    const next = admins.filter((a) => a.id !== rowId);
    const reIndexed = next.map((a, idx) => ({ ...a, id: idx }));
    persist(reIndexed);
  };

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
        <td className="border px-3 py-2">{isEdit ? (<input className="w-full border px-2 py-1" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />) : admin.company}</td>
        <td className="border px-3 py-2">{isEdit ? (<input className="w-full border px-2 py-1" value={draft.contactPerson} onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })} />) : admin.contactPerson}</td>
        <td className="border px-3 py-2">{isEdit ? (<input className="w-full border px-2 py-1" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />) : admin.phone}</td>
        <td className="border px-3 py-2">{admin.uid}</td>
        <td className="border px-3 py-2">{admin.loginId}</td>
        <td className="border px-3 py-2">{admin.password}</td>
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
                const byteString = atob(att.dataUrl.split(',')[1]);
                const mimeString = att.dataUrl.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: mimeString });
                const blobUrl = URL.createObjectURL(blob);

                return (
                  <li key={idx}>
                    <a
                      href={blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
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
      <h1 className="text-2xl font-bold mb-4">👤 管理者管理<span className="ml-2 text-sm text-gray-500">-AdminManager-</span></h1>
      <button
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded"
        onClick={() => {
          const newUid = generateUniqueUid(admins);
          setDraft({ ...emptyAdmin, uid: newUid });
          setIsAdding(true);
        }}>
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
            <th className="border px-3 py-2">パスワード</th>
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
              <td className="border px-3 py-2"><input className="w-full border px-2 py-1" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></td>
              <td className="border px-3 py-2"><input className="w-full border px-2 py-1" value={draft.contactPerson} onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })} /></td>
              <td className="border px-3 py-2"><input className="w-full border px-2 py-1" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></td>
              <td className="border px-3 py-2">
                <span className="text-gray-500">{draft.uid}</span>
              </td>
              <td className="border px-3 py-2 text-gray-500">自動発行</td>
              <td className="border px-3 py-2 text-gray-500">自動発行</td>
              {customFields.map((field, idx) => (
                <td key={idx} className="border px-3 py-2">
                  <input
                    className="w-full border px-2 py-1"
                    value={draft[field] || ""}
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
