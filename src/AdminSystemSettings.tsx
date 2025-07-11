import React, { useState, useEffect } from "react";

export default function SystemSettings() {
  const [notificationSetting, setNotificationSetting] = useState("全員に通知");
  const [driverFields, setDriverFields] = useState<string[]>([]);
  const [newField, setNewField] = useState("");
  const [adminFields, setAdminFields] = useState<string[]>([]);
  const [newAdminField, setNewAdminField] = useState("");
  const [vehicleFields, setVehicleFields] = useState<string[]>([]);
  const [newVehicleField, setNewVehicleField] = useState("");
  const [projectFields, setProjectFields] = useState<string[]>([]);
  const [newProjectField, setNewProjectField] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("driverCustomFields");
    if (saved) setDriverFields(JSON.parse(saved));

    const savedAdmin = localStorage.getItem("adminCustomFields");
    if (savedAdmin) setAdminFields(JSON.parse(savedAdmin));

    const savedVehicle = localStorage.getItem("vehicleCustomFields");
    if (savedVehicle) setVehicleFields(JSON.parse(savedVehicle));

    const savedProject = localStorage.getItem("projectCustomFields");
    if (savedProject) setProjectFields(JSON.parse(savedProject));
  }, []);

  const persistFields = (fields: string[]) => {
    localStorage.setItem("driverCustomFields", JSON.stringify(fields));
    setDriverFields(fields);
  };

  const handleAddField = () => {
    if (!newField.trim()) return;
    if (driverFields.includes(newField.trim())) {
      alert("同じ項目がすでに存在します");
      return;
    }
    const updated = [...driverFields, newField.trim()];
    persistFields(updated);
    setNewField("");
  };

  const handleDeleteField = (field: string) => {
    if (!window.confirm(`「${field}」を削除しますか？`)) return;
    const updated = driverFields.filter((f) => f !== field);
    persistFields(updated);
  };

  const persistAdminFields = (fields: string[]) => {
    localStorage.setItem("adminCustomFields", JSON.stringify(fields));
    setAdminFields(fields);
  };

  const handleAddAdminField = () => {
    if (!newAdminField.trim()) return;
    if (adminFields.includes(newAdminField.trim())) {
      alert("同じ項目がすでに存在します");
      return;
    }
    const updated = [...adminFields, newAdminField.trim()];
    persistAdminFields(updated);
    setNewAdminField("");
  };

  const handleDeleteAdminField = (field: string) => {
    if (!window.confirm(`「${field}」を削除しますか？`)) return;
    const updated = adminFields.filter((f) => f !== field);
    persistAdminFields(updated);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">⚙️ システム設定</h1>

      {/* 通知設定 */}
      <div className="bg-white p-4 rounded shadow">
        <label className="block mb-2 font-semibold">通知設定</label>
        <select
          className="border rounded p-2 w-full"
          value={notificationSetting}
          onChange={(e) => setNotificationSetting(e.target.value)}
        >
          <option>全員に通知</option>
          <option>管理者のみ</option>
          <option>通知しない</option>
        </select>
      </div>

      {/* ドライバー情報項目 */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">📝 ドライバー情報のカスタム項目</h2>
        <ul className="space-y-2 mb-4">
          {driverFields.length === 0 && <li className="text-gray-500">項目はまだありません</li>}
          {driverFields.map((field, idx) => (
            <li key={idx} className="flex justify-between items-center border-b pb-1">
              <span>{field}</span>
              <button
                className="text-red-500 text-sm hover:underline"
                onClick={() => handleDeleteField(field)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            placeholder="例：生年月日"
            className="border px-3 py-2 rounded w-full"
          />
          <button
            onClick={handleAddField}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            追加
          </button>
        </div>
      </div>

      {/* 管理者情報項目 */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">🧑‍💼 管理者情報のカスタム項目</h2>
        <ul className="space-y-2 mb-4">
          {adminFields.length === 0 && <li className="text-gray-500">項目はまだありません</li>}
          {adminFields.map((field, idx) => (
            <li key={idx} className="flex justify-between items-center border-b pb-1">
              <span>{field}</span>
              <button
                className="text-red-500 text-sm hover:underline"
                onClick={() => handleDeleteAdminField(field)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newAdminField}
            onChange={(e) => setNewAdminField(e.target.value)}
            placeholder="例：得意分野"
            className="border px-3 py-2 rounded w-full"
          />
          <button
            onClick={handleAddAdminField}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            追加
          </button>
        </div>
      </div>

      {/* 車両情報項目 */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">🚗 車両情報のカスタム項目</h2>
        <ul className="space-y-2 mb-4">
          {vehicleFields.length === 0 && <li className="text-gray-500">項目はまだありません</li>}
          {vehicleFields.map((field, idx) => (
            <li key={idx} className="flex justify-between items-center border-b pb-1">
              <span>{field}</span>
              <button
                className="text-red-500 text-sm hover:underline"
                onClick={() => {
                  if (window.confirm(`「${field}」を削除しますか？`)) {
                    const updated = vehicleFields.filter((f) => f !== field);
                    localStorage.setItem("vehicleCustomFields", JSON.stringify(updated));
                    setVehicleFields(updated);
                  }
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newVehicleField}
            onChange={(e) => setNewVehicleField(e.target.value)}
            placeholder="例：車種"
            className="border px-3 py-2 rounded w-full"
          />
          <button
            onClick={() => {
              if (!newVehicleField.trim()) return;
              if (vehicleFields.includes(newVehicleField.trim())) {
                alert("同じ項目がすでに存在します");
                return;
              }
              const updated = [...vehicleFields, newVehicleField.trim()];
              localStorage.setItem("vehicleCustomFields", JSON.stringify(updated));
              setVehicleFields(updated);
              setNewVehicleField("");
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            追加
          </button>
        </div>
      </div>

      {/* 案件情報項目 */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">📦 案件情報のカスタム項目</h2>
        <ul className="space-y-2 mb-4">
          {projectFields.length === 0 && <li className="text-gray-500">項目はまだありません</li>}
          {projectFields.map((field, idx) => (
            <li key={idx} className="flex justify-between items-center border-b pb-1">
              <span>{field}</span>
              <button
                className="text-red-500 text-sm hover:underline"
                onClick={() => {
                  if (window.confirm(`「${field}」を削除しますか？`)) {
                    const updated = projectFields.filter((f) => f !== field);
                    localStorage.setItem("projectCustomFields", JSON.stringify(updated));
                    setProjectFields(updated);
                  }
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newProjectField}
            onChange={(e) => setNewProjectField(e.target.value)}
            placeholder="例：荷物サイズ"
            className="border px-3 py-2 rounded w-full"
          />
          <button
            onClick={() => {
              if (!newProjectField.trim()) return;
              if (projectFields.includes(newProjectField.trim())) {
                alert("同じ項目がすでに存在します");
                return;
              }
              const updated = [...projectFields, newProjectField.trim()];
              localStorage.setItem("projectCustomFields", JSON.stringify(updated));
              setProjectFields(updated);
              setNewProjectField("");
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
