import React, { useState, useEffect } from "react";
const genRandom = (len = 6) =>
  Math.random().toString(36).slice(-len);
interface Notification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}
interface Driver {
  id: string;
  name: string;
  /** 雇用区分 */
  contractType: "社員" | "委託";
  company: string;
  phone: string;
  address: string;
  mail?: string;
  birthday: string;
  /** インボイス登録番号（委託のみ任意入力） */
  invoiceNo?: string;
  licenseFiles: File[];
  licenseExpiry: string;
  attachments: File[];
  hidden: boolean;
  status: "予定なし" | "稼働前" | "稼働中" | "休憩中" | "稼働終了";
    isWorking: boolean; // 勤務ボタン押したか
resting: boolean; // 休憩中かどうか
shiftStart?: string; // シフト開始時間（例: "09:00"）
shiftEnd?: string;   // シフト終了時間（例: "18:00"）
statusUpdatedAt?: string;
uid: string;
password?: string;
[key: string]: any;
}

const initialDrivers: Driver[] = [
  {
     id:       genRandom(5),   // 例：k3x9q
  uid: "driver001",
  name: "",
  contractType: "社員",
  company: "",
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
  resting:   false,
  shiftStart: "09:00",
  shiftEnd:   "18:00",
  },
  {
    id: "driver002",
    password: genRandom(8),
    name: "鈴木花子",
    contractType: "委託",
    invoiceNo: "T1234567890123",
    company: "大阪物流センター",
    phone: "080-1111-2222",
    address: "大阪府大阪市中央区4-5-6",
    mail: "hanako@example.com",
    birthday: "1990-05-10",
    licenseFiles: [],
    licenseExpiry: "2024-08-15",
    attachments: [],
    hidden: false,
    status: "予定なし",
isWorking: false,
resting: false,
shiftStart: "09:00",
shiftEnd: "18:00",
  },
  // 以下同様にあと8名追加予定
];

const AdminDriverManager = () => {
  const admin = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}");
  const company = admin.company || "";
  const storageKey = `driverList_${company}`;
  const [drivers, setDrivers] = useState<Driver[]>([]);

useEffect(() => {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    setDrivers(JSON.parse(saved)); // ✅ 自社データのみ
  } else {
    // ✅ 初回データに company を付与
    const updatedInitial = initialDrivers.map((d) => ({ ...d, company }));
    setDrivers(updatedInitial);
    localStorage.setItem(storageKey, JSON.stringify(updatedInitial));
  }

  // ✅ カスタムフィールド復元
  const storedCustom = localStorage.getItem("driverCustomFields");
  if (storedCustom) {
    setCustomFields(JSON.parse(storedCustom));
  }
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
  const [customFields, setCustomFields] = useState<string[]>([]);

useEffect(() => {
  const stored = localStorage.getItem("driverCustomFields");
  if (stored) {
    setCustomFields(JSON.parse(stored));
  }
}, []);

    const handleEdit = (index: number) => {
    setEditingIndex(index);
    setExpandedRowIndex(index);
  };

  const handleSave = () => {
    setEditingIndex(null);
    setExpandedRowIndex(null);
  };

  const handleDelete = (index: number) => {
  if (window.confirm("本当にこのドライバーを削除しますか？")) {
    const updated = [...drivers];
    updated.splice(index, 1);
    setDrivers(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }
};

  const handleChange = (index: number, field: keyof Driver, value: any) => {
  const updated = [...drivers];
  (updated[index] as any)[field] = value;
  setDrivers(updated);
  localStorage.setItem(storageKey, JSON.stringify(updated));
};

  const handleAddRow = () => {
  const adminCompany = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}").company || "";

  const updated = [
    ...drivers,
    {
      id: `driver${drivers.length + 1}`,
      uid: `uid${Date.now()}`,
      password: genRandom(8),
      name: "",
      contractType: "社員",
      invoiceNo: "",
      company: adminCompany, // ✅ 管理者と同じ会社を自動設定
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
  localStorage.setItem(storageKey, JSON.stringify(updated));
  setEditingIndex(drivers.length);
  setExpandedRowIndex(drivers.length);
};


const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  const newFiles = Array.from(files);
  setDrivers(prev => {
    const updated = [...prev];
    const current = updated[index];

    const existingFiles = current.attachments || [];
    const filteredNewFiles = newFiles.filter(newFile =>
      !existingFiles.some(existing => existing.name === newFile.name && existing.size === newFile.size)
    );

    if (existingFiles.length + filteredNewFiles.length > 10) {
      alert("最大10ファイルまで添付できます。");
      return prev;
    }

    current.attachments = [...existingFiles, ...filteredNewFiles];
    updated[index] = current;

    // ✅ この位置で保存
    localStorage.setItem(storageKey, JSON.stringify(updated));

    return updated;
  });

  e.target.value = "";
};

  const handleFileDelete = (rowIndex: number, fileIndex: number) => {
    const updatedFiles = [...(drivers[rowIndex].attachments || [])];
    updatedFiles.splice(fileIndex, 1);
    const updated = [...drivers];
    updated[rowIndex].attachments = updatedFiles;
    setDrivers(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
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
    <div className="p-4">
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

      <table className="w-full border border-gray-300 shadow">
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
              <td className="border px-2 py-1">
  <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(d.status)}`}>
    {d.status}
  </div>
  <div className="text-[10px] text-gray-600 mt-1">
    最終更新: {d.statusUpdatedAt || "未取得"}
  </div>
</td>
<td className="border px-2 py-1">
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
              <td className="border px-2 py-1">{d.id}</td>
              <td className="border px-2 py-1">
                {editingIndex === idx ? (
                  <input className="w-full text-sm" value={d.name} onChange={(e) => handleChange(idx, "name", e.target.value)} />
                ) : d.name}
              </td>
               {/* 契約種別セル */}
 <td className="border px-2 py-1">
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
 <td className="border px-2 py-1">
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
              <td className="border px-2 py-1">
                {editingIndex === idx ? (
                  <input className="w-full text-sm" value={d.company} onChange={(e) => handleChange(idx, "company", e.target.value)} />
                ) : d.company}
              </td>
              <td className="border px-2 py-1">
                {editingIndex === idx ? (
                  <input className="w-full text-sm" value={d.phone} onChange={(e) => handleChange(idx, "phone", e.target.value)} />
                ) : d.phone}
              </td>
              <td className="border px-2 py-1">
  <input
    className="w-full text-sm bg-gray-100"
    value={d.uid}
    disabled
  />
</td>
              <td className="border px-2 py-1">
                {editingIndex === idx ? (
                  <input className="w-full text-sm" value={d.address} onChange={(e) => handleChange(idx, "address", e.target.value)} />
                ) : d.address}
              </td>
              <td className="border px-2 py-1">
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
              <td className="border px-2 py-1">
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
        className="text-blue-600 underline truncate w-32"
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
  );
};

export default AdminDriverManager;
