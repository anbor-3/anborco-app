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
          const filtered = parsed.filter((v: Vehicle) => v.company === company);
          setVehicles(filtered);
        }
      } catch (e) {
        console.error("vehicleList の読み込みに失敗:", e);
      }
    } else {
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
    localStorage.setItem(storageKey, JSON.stringify(updated));
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
    localStorage.setItem(storageKey, JSON.stringify(vehicles));
  };

  const handleDelete = (id: number) => {
    if (window.confirm("本当に削除しますか？")) {
      const updated = vehicles.filter((v) => v.id !== id);
      setVehicles(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
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

  setVehicles((prev) => [...prev, newVehicle]);
  setEditingId(nextId); // 編集モードへ → 保存時に localStorage へ保存
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
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const inputStyle = "text-right px-2 py-1 border rounded w-full";
  const centerInput = "text-center px-2 py-1 border rounded w-full";
  const headerStyle = "bg-blue-200 text-gray-800 text-base font-semibold px-4 py-2 border border-gray-300";
  const rowBase = "border-b border-gray-300";
  const evenRow = "bg-white";
  const oddRow = "bg-blue-50";

  return (
    <div className="absolute top-16 left-60 right-0 bottom-0 bg-white px-8 py-6 overflow-auto">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <span role="img" aria-label="truck" className="text-blue-600 text-3xl mr-2">
          🚚
        </span>
        車両管理 <span className="text-sm text-gray-500 ml-2">-Vehicle Management-</span>
      </h2>

      <button
        className="mb-6 w-48 py-3 bg-blue-500 text-white rounded text-lg font-semibold hover:bg-blue-600"
        onClick={handleAddVehicle}
      >
        車両追加
      </button>
      <div className="w-full flex-1 overflow-auto">
        <table className="w-full table-auto border border-gray-300 shadow rounded-lg text-sm">
          <thead className="bg-blue-100 text-gray-800 border-b border-gray-400">
            <tr>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">操作</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">車種</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">ナンバー</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">車台番号</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">使用者</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">使用開始日</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">車検有効期限</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">自賠責有効期限</th>
              <th className="px-4 py-3 text-left border-r border-gray-300 whitespace-nowrap">任意保険有効期限</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">添付ファイル</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {vehicles.map((vehicle, idx) => (
              <tr
                key={vehicle.id}
                className={`${
    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
  } hover:bg-blue-50 border-b border-gray-200`}
              >
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
                  {editingId === vehicle.id ? (
                    <>
                      <button
                        className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                        onClick={() => handleSave(vehicle.id)}
                      >
                        保存
                      </button>
                      <button
  className="bg-gray-400 text-white px-2 py-1 rounded"
  onClick={() => {
    // 追加直後（空のvehicle）なら削除
    const addedVehicle = vehicles.find((v) => v.id === editingId);
    if (
      addedVehicle &&
      addedVehicle.type === "" &&
      addedVehicle.number === "" &&
      addedVehicle.vin === ""
    ) {
      setVehicles((prev) => prev.filter((v) => v.id !== editingId));
    }
    setEditingId(null);
  }}
>
  キャンセル
</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="bg-yellow-400 text-white px-2 py-1 rounded mr-2"
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
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
  {editingId === vehicle.id ? (
    <input
      type="text"
      value={vehicle.type}
      onChange={(e) => handleChange(vehicle.id, "type", e.target.value)}
      className="w-full px-2 py-1 border rounded"
    />
  ) : (
    vehicle.type
  )}
</td>
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
  {editingId === vehicle.id ? (
    <input
      type="text"
      value={vehicle.number}
      onChange={(e) => handleChange(vehicle.id, "number", e.target.value)}
      className="w-full px-2 py-1 border rounded"
    />
  ) : (
    vehicle.number
  )}
</td>
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
  {editingId === vehicle.id ? (
    <input
      type="text"
      value={vehicle.vin}
      onChange={(e) => handleChange(vehicle.id, "vin", e.target.value)}
      className="w-full px-2 py-1 border rounded"
    />
  ) : (
    vehicle.vin
  )}
</td>
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
  {editingId === vehicle.id ? (
    <select
      value={vehicle.user}
      onChange={(e) => handleChange(vehicle.id, "user", e.target.value)}
      className="w-full px-2 py-1 border rounded"
    >
      {driverOptions.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  ) : (
    vehicle.user
  )}
</td>
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
  {editingId === vehicle.id ? (
    <input
      type="date"
      value={vehicle.startDate}
      onChange={(e) => handleChange(vehicle.id, "startDate", e.target.value)}
      className="w-full px-2 py-1 border rounded"
    />
  ) : (
    vehicle.startDate
  )}
</td>
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
  {editingId === vehicle.id ? (
    <input
      type="date"
      value={vehicle.inspectionDate}
      onChange={(e) => handleChange(vehicle.id, "inspectionDate", e.target.value)}
      className="w-full px-2 py-1 border rounded"
    />
  ) : (
    vehicle.inspectionDate
  )}
</td>
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
  {editingId === vehicle.id ? (
    <input
      type="date"
      value={vehicle.inspectionDate}
      onChange={(e) => handleChange(vehicle.id, "inspectionDate", e.target.value)}
      className="w-full px-2 py-1 border rounded"
    />
  ) : (
    vehicle.insuranceDate
  )}
</td>
                <td className="px-4 py-2 text-sm border-r border-gray-200 whitespace-nowrap">
  {editingId === vehicle.id ? (
    <input
      type="date"
      value={vehicle.inspectionDate}
      onChange={(e) => handleChange(vehicle.id, "inspectionDate", e.target.value)}
      className="w-full px-2 py-1 border rounded"
    />
  ) : (
    vehicle.voluntaryDate
  )}
</td>
                <td className="px-4 py-2 text-sm whitespace-nowrap">
  {editingId === vehicle.id ? (
    <div className="space-y-1">
      {/* 添付済みファイル表示 */}
      {vehicle.attachments?.map((file, i) => (
        <div key={i} className="flex items-center justify-between">
          <button
            className="text-blue-600 underline text-xs mr-2"
            onClick={() => openFile(file)}
          >
            {file.name}
          </button>
          <button
            className="text-red-500 text-xs"
            onClick={() => removeFile(vehicle.id, i)}
          >
            削除
          </button>
        </div>
      ))}
      {/* 添付用input */}
      <input
        type="file"
        multiple
        accept="application/pdf,image/*"
        onChange={(e) => handleChange(vehicle.id, "attachments", e.target.files)}
        className="text-xs mt-1"
      />
      <p className="text-xs text-gray-500">最大10ファイルまで添付可能</p>
    </div>
  ) : (
    <div className="space-y-1">
      {vehicle.attachments?.length > 0 ? (
        vehicle.attachments.map((file, i) => (
          <div key={i}>
            <button
              className="text-blue-600 underline text-xs"
              onClick={() => openFile(file)}
            >
              {file.name}
            </button>
          </div>
        ))
      ) : (
        "添付なし"
      )}
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

export default VehicleManager;
