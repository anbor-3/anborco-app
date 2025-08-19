// ✅ import は一番上にまとめてください
import type React from "react";
import { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";

const debounce = <T extends (...args: any[]) => any>(fn: T, delay = 500) => {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), delay);
  };
};

// ✅ 関数定義は壊れてはいけません（ここが重要！！）
const genRandom = (len = 6): string =>
  Math.random().toString(36).slice(-len);

// ✅ Firestoreからドライバー一覧を取得する関数（あとで使います）
export const fetchDrivers = async (company: string): Promise<Driver[]> => {
  try {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("未ログイン");

    // company クエリは互換のため残す（本番はトークンの companyId を使用）
    const res = await fetch(`/api/drivers?company=${company}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error("Fetch failed");
    const drivers = await res.json();
    return drivers;
  } catch (error) {
    console.error("❌ ドライバー取得失敗:", error);
    return [];
  }
};

// ✅ Neonに保存する共通関数（Fileは送らない）
const persist = async (company: string, drivers: Driver[]) => {
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    alert("未ログインです。再ログインしてください。");
    throw new Error("no token");
  }

  const sanitized = drivers.map(({ attachments, licenseFiles, ...rest }) => rest);
  try {
    const res = await fetch("/api/drivers/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,     // ← 追加
      },
      body: JSON.stringify({ company, drivers: sanitized }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  } catch (e) {
    console.error("❌ 保存に失敗:", e);
    alert("保存に失敗しました。ネットワークをご確認ください。");
    throw e;
  }
};


interface Notification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}
export interface Driver {
  id: string;
  name: string;
  contractType: "社員" | "委託";
  company: string;
  phone: string;
  address: string;
  mail?: string;
  birthday: string;
  invoiceNo?: string;
  licenseFiles: File[];
  licenseExpiry: string;
  attachments: File[];
  hidden: boolean;
  status: "予定なし" | "稼働前" | "稼働中" | "休憩中" | "稼働終了";
  isWorking: boolean;
  resting: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  statusUpdatedAt?: string;
  uid: string;
  loginId: string;   // ✅追加
  password: string;  // ✅追加（必須化）
  [key: string]: any;
}

const AdminDriverManager = () => {
  // ✅ 入力の連打をまとめて保存（600ms）
  const persistDebounced = debounce((company: string, drivers: Driver[]) => {
    persist(company, drivers);
  }, 600);
  const admin = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}");
  const company = admin.company || "";
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customFields, setCustomFields] = useState<string[]>([]);

useEffect(() => {
  const loadDrivers = async () => {
    const fetched = await fetchDrivers(company); // ✅ Neon API から取得
    setDrivers(fetched);

    const storedCustom = localStorage.getItem("driverCustomFields");
    if (storedCustom) {
      setCustomFields(JSON.parse(storedCustom));
    }
  };
  loadDrivers();
}, []);

const [notifications, setNotifications] = useState<Notification[]>([]);
  const addNotification = (message: string) => {
  const id = `${Date.now()}-${Math.random()}`;
  const timestamp = new Date().toLocaleString("ja-JP");
  const newNotification: Notification = {
    id,
    message,
    timestamp,
    read: false,
  };

  setNotifications(prev => {
    const updated = [...prev, newNotification];
    localStorage.setItem("adminNotifications", JSON.stringify(updated));
    return updated;
  });
};
const updateDriverStatus = () => {
    setDrivers((prev) => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const formattedTime = now.toLocaleTimeString("ja-JP");

      return prev.map((d) => {
        const hasShift = d.shiftStart && d.shiftEnd;
        const shiftStart = d.shiftStart!;
        const shiftEnd = d.shiftEnd!;
        const isWorking = d.isWorking;
        const isResting = d.resting;

        if (!hasShift) {
          return { ...d, status: "予定なし", statusUpdatedAt: formattedTime };
        }

        if (!isWorking && currentTime >= shiftStart && currentTime < shiftEnd) {
          const message = `【警告】${d.name} さんが勤務開始していません（${shiftStart}〜）`;
          addNotification(message);
        }

        if (isWorking && currentTime >= shiftEnd) {
          const message = `【警告】${d.name} さんが勤務終了していません（〜${shiftEnd}）`;
          addNotification(message);
        }

        if (!isWorking && currentTime < shiftStart) {
          return { ...d, status: "稼働前", statusUpdatedAt: formattedTime };
        }

        if (isWorking && isResting) {
          return { ...d, status: "休憩中", statusUpdatedAt: formattedTime };
        }

        if (isWorking && currentTime >= shiftStart && currentTime < shiftEnd) {
          return { ...d, status: "稼働中", statusUpdatedAt: formattedTime };
        }

        if (isWorking && currentTime >= shiftEnd) {
          return { ...d, status: "稼働終了", statusUpdatedAt: formattedTime };
        }

        return { ...d, status: "予定なし", statusUpdatedAt: formattedTime };
      });
    });
  };
useEffect(() => {
  updateDriverStatus(); // 初回即時実行
  const timer = setInterval(updateDriverStatus, 30000); // 30秒ごとに更新
  return () => clearInterval(timer);
}, []);
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  
    const handleEdit = (index: number) => {
    setEditingIndex(index);
    setExpandedRowIndex(index);
  };

  const handleSave = () => {
    setEditingIndex(null);
    setExpandedRowIndex(null);
  };

  const handleDelete = async (index: number) => {
  if (!window.confirm("本当にこのドライバーを削除しますか？")) return;

  const updated = [...drivers];
  updated.splice(index, 1);
  setDrivers(updated);

  await persist(company, updated);
};

  const handleChange = (index: number, field: keyof Driver, value: any) => {
  const updated = [...drivers];
  (updated[index] as any)[field] = value;
  setDrivers(updated);

  // すぐに await しない（タイプが止まったら保存）
  persistDebounced(company, updated);
};

  const handleAddRow = async () => {
  const adminCompany = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}").company || "";

  const newLoginId = `driver${String(drivers.length + 1).padStart(4, "0")}`;
  const newPassword = genRandom(8);

  const updated = [
    ...drivers,
    {
      id: `driver${String(drivers.length + 1).padStart(4, "0")}`,
      uid: `uid${Date.now()}`,
      loginId: newLoginId,
      password: newPassword,
      name: "",
      contractType: "社員",
      invoiceNo: "",
      company: adminCompany,
      phone: "",
      address: "",
      mail: "",
      birthday: "",
      licenseFiles: [],
      licenseExpiry: "",
      attachments: [],
      hidden: false,
      status: "予定なし",
      isWorking: false,
      resting: false,
      shiftStart: "09:00",
      shiftEnd: "18:00",
    },
  ];

  setDrivers(updated);

  await persist(company, updated);

  setEditingIndex(drivers.length);
  setExpandedRowIndex(drivers.length);
  alert(`✅ ドライバーが追加されました\nログインID: ${newLoginId}\nパスワード: ${newPassword}`);
};

const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  const newFiles = Array.from(files);

  const updated = [...drivers];
  const current = { ...updated[index] };
  const existingFiles = current.attachments || [];

  const filteredNewFiles = newFiles.filter(newFile =>
    !existingFiles.some(existing => existing.name === newFile.name && existing.size === newFile.size)
  );

  if (existingFiles.length + filteredNewFiles.length > 10) {
    alert("最大10ファイルまで添付できます。");
    return;
  }

  current.attachments = [...existingFiles, ...filteredNewFiles];
  updated[index] = current;

  setDrivers(updated);

  await persist(company, updated);

  e.target.value = "";
};

  const handleFileDelete = async (rowIndex: number, fileIndex: number) => {
  const updatedFiles = [...(drivers[rowIndex].attachments || [])];
  updatedFiles.splice(fileIndex, 1);

  const updated = [...drivers];
  updated[rowIndex] = { ...updated[rowIndex], attachments: updatedFiles };

  setDrivers(updated);

  await persist(company, updated);
};
const getStatusColor = (status: string) => {
  switch (status) {
    case "予定なし": return "bg-gray-400 text-white";
    case "稼働前": return "bg-yellow-400 text-black";
    case "稼働中": return "bg-orange-400 text-white";
    case "休憩中": return "bg-blue-400 text-white";
    case "稼働終了": return "bg-green-500 text-white";
    default: return "bg-gray-200";
  }
};
  const getTypeBadge = (
  ct?: string
) => {
  const base = "inline-block px-3 py-1 rounded-full font-semibold text-sm ";

  switch (ct) {
    case "社員":
      return { class: base + "text-white bg-green-600", label: "社員" };
    case "委託":
      return { class: base + "text-white bg-purple-600", label: "委託" };
    default:
      return { class: base + "text-gray-700 bg-gray-300", label: "未設定" };
  }
};

  return (
    <div className="p-4 w-full overflow-auto bg-white">
      <div className="flex items-center text-2xl font-bold mb-4">
        <span className="mr-2">🚚</span>
        <span>ドライバー管理 <span className="text-sm text-gray-500 ml-2">-Driver Manager-</span></span>
      </div>

      <div className="flex justify-start mb-2 space-x-4">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded" onClick={handleAddRow}>
          ドライバー追加
        </button>
          <button
    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded"
    onClick={updateDriverStatus}
  >
    ステータス更新
  </button>
        {editingIndex !== null && (
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded" onClick={handleSave}>
            保存
          </button>
        )}
      </div>

      <div className="w-full overflow-x-auto">
       <table className="w-full border border-gray-300 shadow table-auto whitespace-nowrap">
        <thead className="bg-gray-800 text-white font-bold">
          <tr>
            <th className="border px-2 py-1">ステータス</th>
            <th className="border px-2 py-1">操作</th>
            <th className="border px-2 py-1">ID</th>
            <th className="border px-2 py-1">氏名</th>
            <th className="border px-2 py-1">契約種別</th>
            <th className="border px-2 py-1">インボイス番号</th>
            <th className="border px-2 py-1">所属会社</th>
            <th className="border px-2 py-1">電話番号</th>
            <th className="border px-2 py-1">ログインID</th>
            <th className="border px-2 py-1">パスワード</th>
            <th className="border px-2 py-1">住所</th>
            <th className="border px-2 py-1">メール</th>
            <th className="border px-2 py-1">生年月日</th>
            {customFields.map((field, i) => (
  <th key={`h-${i}`} className="border px-2 py-1">{field}</th>
))}
            <th className="border px-2 py-1">ファイル添付</th>
             </tr>
        </thead>
        <tbody>
           {drivers.map((d, idx) => (
            <tr key={idx} className="odd:bg-white even:bg-gray-100">
              <td className="border px-2 py-1 break-all">
  <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(d.status)}`}>
    {d.status}
  </div>
  <div className="text-[10px] text-gray-600 mt-1">
    最終更新: {d.statusUpdatedAt || "未取得"}
  </div>
</td>
<td className="border px-2 py-1 break-all">
  <button
    className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded mr-2"
    onClick={() => handleEdit(idx)}
  >
    編集
  </button>
  <button
    className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
    onClick={() => handleDelete(idx)}
  >
    削除
  </button>
              </td>
              <td className="border px-2 py-1 break-all">{d.id}</td>
              <td className="border px-2 py-1 break-all">
                {editingIndex === idx ? (
                  <input className="w-full text-sm" value={d.name} onChange={(e) => handleChange(idx, "name", e.target.value)} />
                ) : d.name}
              </td>
               {/* 契約種別セル */}
 <td className="border px-2 py-1 break-all">
   {editingIndex === idx ? (
     <select
       className="w-full text-sm"
       value={d.contractType}
       onChange={(e) =>
         handleChange(idx, "contractType", e.target.value as Driver["contractType"])
       }
     >
       <option value="社員">社員</option>
       <option value="委託">委託</option>
     </select>
   ) : (
     <span className={getTypeBadge(d.contractType).class}>
  {getTypeBadge(d.contractType).label}
</span>
   )}
 </td>

 {/* インボイス番号セル（委託のみ編集可） */}
 <td className="border px-2 py-1 break-all">
   {editingIndex === idx ? (
     <input
       className="w-full text-sm disabled:bg-gray-100"
       value={d.invoiceNo || ""}
       onChange={(e) => handleChange(idx, "invoiceNo", e.target.value)}
       placeholder="T1234-…"
       disabled={d.contractType !== "委託"}
     />
   ) : d.contractType === "委託" ? d.invoiceNo || "-" : "-"}
 </td>
              <td className="border px-2 py-1 break-all">
                {editingIndex === idx ? (
                  <input className="w-full text-sm" value={d.company} onChange={(e) => handleChange(idx, "company", e.target.value)} />
                ) : d.company}
              </td>
              <td className="border px-2 py-1 break-all">
                {editingIndex === idx ? (
                  <input className="w-full text-sm" value={d.phone} onChange={(e) => handleChange(idx, "phone", e.target.value)} />
                ) : d.phone}
              </td>
              <td className="border px-2 py-1 break-all">{d.loginId}</td>
<td className="border px-2 py-1 break-all">{d.password}</td>
              <td className="border px-2 py-1 break-all">
                {editingIndex === idx ? (
                  <input className="w-full text-sm" value={d.address} onChange={(e) => handleChange(idx, "address", e.target.value)} />
                ) : d.address}
              </td>
              <td className="border px-2 py-1 break-all">
               {editingIndex === idx ? (
                 <input
                   type="email"
                   className="w-full text-sm"
                   value={d.mail || ""}
                   onChange={(e) =>
                     handleChange(idx, "mail", e.target.value)
                   }
                   placeholder="sample@example.com"
                 />
               ) : d.mail}
             </td>
              <td className="border px-2 py-1 break-all">
                {editingIndex === idx ? (
                  <input type="date" className="w-full text-sm" value={d.birthday} onChange={(e) => handleChange(idx, "birthday", e.target.value)} />
                ) : d.birthday}
              </td>
              {customFields.map((field, i) => (
  <td key={`c-${idx}-${i}`} className="border px-2 py-1">
    {editingIndex === idx ? (
      <input
        className="w-full text-sm"
        value={d[field] || ""}
        onChange={(e) => handleChange(idx, field as keyof Driver, e.target.value)}
      />
    ) : (
      d[field] || "-"
    )}
  </td>
))}
              <td className="border px-2 py-1 text-center">
                <button className="bg-blue-500 text-white px-2 py-1 rounded text-sm" onClick={() => setExpandedRowIndex(expandedRowIndex === idx ? null : idx)}>詳細</button>
                {expandedRowIndex === idx && (
                  <div className="mt-2">
                    {editingIndex === idx && (
                      <input type="file" multiple onChange={(e) => handleFileUpload(idx, e)} className="mb-1 text-xs" />
                    )}
                   <ul className="text-left text-xs">
  {(d.attachments || []).map((file, fileIndex) => (
    <li key={fileIndex} className="flex items-center justify-between mb-1">
      <a
  href={URL.createObjectURL(file)}
  target="_blank"
  rel="noopener noreferrer"
  className="text-blue-600 underline break-all w-32"
>
  {file.name}
</a>
      {editingIndex === idx && (
        <button
          className="text-red-500 ml-2 text-xs"
          onClick={() => handleFileDelete(idx, fileIndex)}
        >
          削除
        </button>
      )}
    </li>
  ))}
</ul>

                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
};

export default AdminDriverManager;
