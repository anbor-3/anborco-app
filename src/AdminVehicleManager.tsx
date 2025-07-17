import React, { useState } from "react";

const initialDrivers = ["佐藤太郎", "鈴木花子"];

interface Vehicle {
  id: number;
  type: string;
  number: string;
  vin: string;
  user: string;
  startDate: string;
  inspectionDate: string;
  insuranceDate: string;
  voluntaryDate: string;
  attachments: File[];
  company: string;
  customFields?: { [key: string]: string };
}

const initialVehicles: Vehicle[] = [
  {
    id: 1,
    type: "軽バン",
    number: "品川 500 あ 12-34",
    vin: "XYZ123456789",
    user: "佐藤太郎",
    startDate: "2023-01-01",
    inspectionDate: "2024-12-31",
    insuranceDate: "2024-11-30",
    voluntaryDate: "2024-10-31",
    attachments: [],
    company: "",
  },
  {
    id: 2,
    type: "ハイエース",
    number: "練馬 300 い 56-78",
    vin: "ABC987654321",
    user: "鈴木花子",
    startDate: "2022-05-10",
    inspectionDate: "2024-08-15",
    insuranceDate: "2024-07-20",
    voluntaryDate: "2024-06-25",
    attachments: [],
    company: "",
  },
];

const VehicleManager = () => {
  const admin = JSON.parse(localStorage.getItem("loggedInAdmin") || "{}");
  const company = admin.company || "";
  const storageKey = `vehicleList_${company}`;
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [editingId, setEditingId] = useState<number | null>(null);
const [driverOptions, setDriverOptions] = useState<string[]>(initialDrivers);
const [vehicleCustomFields, setVehicleCustomFields] = useState<string[]>([]);

  React.useEffect(() => {
  const savedDrivers = localStorage.getItem("driverList");
  if (savedDrivers) {
    setDriverOptions(JSON.parse(savedDrivers).map((d: any) => d.name));
  }

  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // ✅ 管理者の会社のみ残す
        const filtered = parsed.filter((v: Vehicle) => v.company === company);
        setVehicles(filtered);
      }
    } catch (e) {
      console.error("vehicleList の読み込みに失敗:", e);
    }
  } else {
    // ✅ ここを追加（初期データに company を付与）
    const updatedInitial = initialVehicles.map((v) => ({ ...v, company }));
    setVehicles(updatedInitial);
    localStorage.setItem(storageKey, JSON.stringify(updatedInitial));
  }

  const savedCustom = localStorage.getItem("vehicleCustomFields");
  if (savedCustom) {
    setVehicleCustomFields(JSON.parse(savedCustom));
  }
}, []);

  const handleChange = (id: number, key: keyof Vehicle, value: string | FileList | null) => {
  const updated = vehicles.map((vehicle) =>
    vehicle.id === id
      ? {
          ...vehicle,
          [key]:
            key === "attachments" && value instanceof FileList
              ? Array.from(value).slice(0, 10)
              : value,
        }
      : vehicle
  );
  setVehicles(updated);
  localStorage.setItem(storageKey, JSON.stringify(updated)); // ✅ 保存追加
};
const handleCustomFieldChange = (id: number, fieldName: string, value: string) => {
  const updated = vehicles.map((v) =>
    v.id === id
      ? {
          ...v,
          customFields: {
            ...(v.customFields || {}),
            [fieldName]: value,
          },
        }
      : v
  );
  setVehicles(updated);
  localStorage.setItem(storageKey, JSON.stringify(updated));
};

  const handleSave = (id: number) => {
  setEditingId(null);
  localStorage.setItem(storageKey, JSON.stringify(vehicles)); // ✅ 保存追加
};

  const handleDelete = (id: number) => {
  if (window.confirm("本当に削除しますか？")) {
    const updated = vehicles.filter((v) => v.id !== id);
    setVehicles(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated)); // ✅ 保存追加
  }
};

  const handleAddVehicle = () => {
  const nextId = vehicles.length ? Math.max(...vehicles.map((v) => v.id)) + 1 : 1;
  const newVehicle: Vehicle = {
  id: nextId,
  type: "",
  number: "",
  vin: "",
  user: driverOptions[0] || "",
  startDate: "",
  inspectionDate: "",
  insuranceDate: "",
  voluntaryDate: "",
  attachments: [],
  company: company,
  customFields: vehicleCustomFields.reduce((acc, field) => {
    acc[field] = "";
    return acc;
  }, {} as { [key: string]: string }),
};

  const updated = [...vehicles, newVehicle];
  setVehicles(updated);
  setEditingId(nextId);
  localStorage.setItem(storageKey, JSON.stringify(updated)); // ✅ 保存追加
};

  const openFile = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
  };

  const removeFile = (vehicleId: number, fileIndex: number) => {
  if (!window.confirm("このファイルを削除しますか？")) return;

  const updated = vehicles.map((vehicle) =>
    vehicle.id === vehicleId
      ? {
          ...vehicle,
          attachments: vehicle.attachments.filter((_, i) => i !== fileIndex),
        }
      : vehicle
  );

  setVehicles(updated);
  localStorage.setItem(storageKey, JSON.stringify(updated)); // ✅ ここを追加
};

  const inputStyle = "text-right px-2 py-1 border rounded w-full";
  const centerInput = "text-center px-2 py-1 border rounded w-full";
  const headerStyle = "bg-blue-200 text-gray-800 text-sm font-semibold px-2 py-2 border border-gray-300";
  const rowBase = "border-b border-gray-300";
  const evenRow = "bg-white";
  const oddRow = "bg-blue-50";

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <span role="img" aria-label="truck" className="text-blue-600 text-3xl mr-2">
          🚚
        </span>
        車両管理 <span className="text-sm text-gray-500 ml-2">-Vehicle Management-</span>
      </h2>

      {/* ✅ 車両追加ボタン（復元済） */}
      <button
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={handleAddVehicle}
      >
        車両追加
      </button>

      <table className="w-full border shadow rounded border-collapse">
        <thead>
          <tr>
            <th className={headerStyle}>操作</th>
            <th className={headerStyle}>車種</th>
            <th className={headerStyle}>ナンバー</th>
            <th className={headerStyle}>車台番号</th>
            <th className={headerStyle}>使用者</th>
            <th className={headerStyle}>使用開始日</th>
            <th className={headerStyle}>車検有効期限</th>
            <th className={headerStyle}>自賠責有効期限</th>
            <th className={headerStyle}>任意保険有効期限</th>
            <th className={headerStyle}>添付ファイル</th>
            {vehicleCustomFields.map((field) => (
  <th key={field} className={headerStyle}>{field}</th>
))}
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle, idx) => (
            <tr key={vehicle.id} className={`${rowBase} ${idx % 2 === 0 ? evenRow : oddRow}`}>
              <td className="text-center">
                {editingId === vehicle.id ? (
                  <button
                    className="bg-green-500 text-white px-2 py-1 rounded"
                    onClick={() => handleSave(vehicle.id)}
                  >
                    保存
                  </button>
                ) : (
                  <>
                    <button
                      className="bg-yellow-400 text-white px-2 py-1 rounded mr-1"
                      onClick={() => setEditingId(vehicle.id)}
                    >
                      編集
                    </button>
                    <button
                      className="bg-red-500 text-white px-2 py-1 rounded"
                      onClick={() => handleDelete(vehicle.id)}
                    >
                      削除
                    </button>
                  </>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <input
                    className={inputStyle}
                    value={vehicle.type}
                    onChange={(e) => handleChange(vehicle.id, "type", e.target.value)}
                  />
                ) : (
                  <div className="text-right">{vehicle.type}</div>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <input
                    className={inputStyle}
                    value={vehicle.number}
                    onChange={(e) => handleChange(vehicle.id, "number", e.target.value)}
                  />
                ) : (
                  <div className="text-right">{vehicle.number}</div>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <input
                    className={inputStyle}
                    value={vehicle.vin}
                    onChange={(e) => handleChange(vehicle.id, "vin", e.target.value)}
                  />
                ) : (
                  <div className="text-right">{vehicle.vin}</div>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <select
                    className={inputStyle}
                    value={vehicle.user}
                    onChange={(e) => handleChange(vehicle.id, "user", e.target.value)}
                  >
                    {driverOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-right">{vehicle.user}</div>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <input
                    type="date"
                    className={centerInput}
                    value={vehicle.startDate}
                    onChange={(e) => handleChange(vehicle.id, "startDate", e.target.value)}
                  />
                ) : (
                  <div className="text-center">{vehicle.startDate}</div>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <input
                    type="date"
                    className={centerInput}
                    value={vehicle.inspectionDate}
                    onChange={(e) => handleChange(vehicle.id, "inspectionDate", e.target.value)}
                  />
                ) : (
                  <div className="text-center">{vehicle.inspectionDate}</div>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <input
                    type="date"
                    className={centerInput}
                    value={vehicle.insuranceDate}
                    onChange={(e) => handleChange(vehicle.id, "insuranceDate", e.target.value)}
                  />
                ) : (
                  <div className="text-center">{vehicle.insuranceDate}</div>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <input
                    type="date"
                    className={centerInput}
                    value={vehicle.voluntaryDate}
                    onChange={(e) => handleChange(vehicle.id, "voluntaryDate", e.target.value)}
                  />
                ) : (
                  <div className="text-center">{vehicle.voluntaryDate}</div>
                )}
              </td>
              <td>
                {editingId === vehicle.id ? (
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleChange(vehicle.id, "attachments", e.target.files)}
                  />
                ) : vehicle.attachments.length > 0 ? (
                  <div className="flex flex-col items-center text-xs text-blue-700 underline">
                    {vehicle.attachments.map((file, i) => (
                      <div key={i} className="flex items-center">
                        <button onClick={() => openFile(file)}>{file.name}</button>
                        <button className="text-red-500 ml-2" onClick={() => removeFile(vehicle.id, i)}>×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">添付なし</div>
                )}
              </td>
              {vehicleCustomFields.map((field) => (
  <td key={field}>
    {editingId === vehicle.id ? (
      <input
        className={inputStyle}
        value={vehicle.customFields?.[field] || ""}
        onChange={(e) => handleCustomFieldChange(vehicle.id, field, e.target.value)}
      />
    ) : (
      <div className="text-right">{vehicle.customFields?.[field] || ""}</div>
    )}
  </td>
))}

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VehicleManager;
