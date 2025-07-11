import React, { useState } from "react";

interface Driver {
  id: string;
  name: string;
  type: "社員" | "委託";
  company: string;
  phone: string;
  address: string;
  birthday: string;
  licenseFiles: File[];
  licenseExpiry: string;
  attachments: File[];
  hidden: boolean;
}

const DriverManager = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({});

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSave = () => {
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    if (window.confirm("本当にこのドライバーを削除しますか？")) {
      const updated = [...drivers];
      updated.splice(index, 1);
      setDrivers(updated);
    }
  };

  const handleChange = (index: number, field: keyof Driver, value: any) => {
    const updated = [...drivers];
    (updated[index] as any)[field] = value;
    setDrivers(updated);
  };

  const handleNewChange = (field: keyof Driver, value: any) => {
    setNewDriver({ ...newDriver, [field]: value });
  };

  const handleAddRow = () => {
    setDrivers(prev => ([
      ...prev,
      {
        id: `driver${prev.length + 1}`,
        name: "",
        type: "社員",
        company: "",
        phone: "",
        address: "",
        birthday: "",
        licenseFiles: [],
        licenseExpiry: "",
        attachments: [],
        hidden: false
      }
    ]));
  };

  const handleFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setDrivers(prev => {
      const updated = [...prev];
      const current = updated[index];
      const existingFiles = current.attachments || [];
      const newFiles = Array.from(files);
      if (existingFiles.length + newFiles.length > 10) {
        alert("最大10ファイルまで添付できます。");
        return prev;
      }
      current.attachments = [...existingFiles, ...newFiles];
      updated[index] = current;
      return updated;
    });
  };

  const handleFileDelete = (rowIndex: number, fileIndex: number) => {
    const updatedFiles = [...(drivers[rowIndex].attachments || [])];
    updatedFiles.splice(fileIndex, 1);
    const updated = [...drivers];
    updated[rowIndex].attachments = updatedFiles;
    setDrivers(updated);
  };

  const getTypeBadge = (type: string) => {
    const base = "px-3 py-1 rounded-full font-semibold text-sm ";
    return type === "社員"
      ? `${base}text-blue-700 border border-blue-400 bg-white`
      : `${base}text-yellow-700 border border-yellow-400 bg-white`;
  };

  return (
    <div className="p-4">
      <div className="flex items-center text-2xl font-bold mb-4">
        <span className="mr-2">🚚</span>
        <span>ドライバー管理 <span className="text-sm text-gray-500 ml-2">(Driver Manager)</span></span>
      </div>

      <div className="flex justify-start mb-2 space-x-4">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded" onClick={handleAddRow}>ドライバー追加</button>
      </div>

      <table className="w-full border border-gray-300 shadow">
        <thead className="bg-gray-800 text-white font-bold">
          <tr>
            <th className="border px-2 py-1">操作</th>
            <th className="border px-2 py-1">ID</th>
            <th className="border px-2 py-1">氏名</th>
            <th className="border px-2 py-1">種別</th>
            <th className="border px-2 py-1">所属会社</th>
            <th className="border px-2 py-1">電話番号</th>
            <th className="border px-2 py-1">住所</th>
            <th className="border px-2 py-1">生年月日</th>
            <th className="border px-2 py-1">ファイル添付</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d, idx) => (
            <tr key={idx} className="odd:bg-white even:bg-gray-100">
              <td className="border px-2 py-1">
                <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded mr-2" onClick={() => handleEdit(idx)}>編集</button>
                <button className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded" onClick={() => handleDelete(idx)}>削除</button>
              </td>
              <td className="border px-2 py-1">{d.id}</td>
              <td className="border px-2 py-1">{d.name}</td>
              <td className="border px-2 py-1"><span className={getTypeBadge(d.type)}>{d.type}</span></td>
              <td className="border px-2 py-1">{d.company}</td>
              <td className="border px-2 py-1">{d.phone}</td>
              <td className="border px-2 py-1">{d.address}</td>
              <td className="border px-2 py-1">{d.birthday}</td>
              <td className="border px-2 py-1 text-center">
                <button className="bg-blue-500 text-white px-2 py-1 rounded text-sm" onClick={() => setExpandedRowIndex(expandedRowIndex === idx ? null : idx)}>詳細</button>
                {expandedRowIndex === idx && (
                  <div className="mt-2">
                    <input type="file" multiple onChange={(e) => handleFileUpload(idx, e)} className="mb-1 text-xs" />
                    <ul className="text-left text-xs">
                      {(d.attachments || []).map((file, fileIndex) => (
                        <li key={fileIndex} className="flex items-center justify-between mb-1">
                          <span className="truncate w-32">{file.name}</span>
                          <button className="text-red-500 ml-2 text-xs" onClick={() => handleFileDelete(idx, fileIndex)}>削除</button>
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

export default DriverManager;
