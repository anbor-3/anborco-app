import React, { useState } from "react";
import { nanoid } from "nanoid";

const AdminCreateDriver = () => {
  const [form, setForm] = useState({
    name: "",
    company: "",
    driverId: "",
    password: "",
    autoGenerate: true,
  });

  const generateCredentials = () => {
    const id = `drv_${nanoid(6)}`;
    const pw = nanoid(10);
    setForm({ ...form, driverId: id, password: pw });
  };

  const handleSubmit = () => {
    if (!form.name || !form.company || !form.driverId || !form.password) {
      alert("すべて入力してください");
      return;
    }

    const list = JSON.parse(localStorage.getItem("driverList") || "[]");
    list.push({
      id: form.driverId,
      password: form.password, // 本番ではハッシュ化推奨
      name: form.name,
      company: form.company,
    });
    localStorage.setItem("driverList", JSON.stringify(list));
    alert("ドライバー登録が完了しました");

    setForm({
      name: "",
      company: "",
      driverId: "",
      password: "",
      autoGenerate: true,
    });
    generateCredentials();
  };

  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">👤 ドライバー登録</h1>

      <input
        className="border p-2 w-full"
        placeholder="氏名"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="会社名"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
      />

      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={form.autoGenerate}
          onChange={(e) => {
            const auto = e.target.checked;
            setForm({ ...form, autoGenerate: auto });
            if (auto) generateCredentials();
          }}
        />
        <span>ID/パスワードを自動発番する</span>
      </label>

      <input
        className="border p-2 w-full"
        placeholder="ログインID"
        value={form.driverId}
        disabled={form.autoGenerate}
        onChange={(e) => setForm({ ...form, driverId: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="パスワード"
        value={form.password}
        disabled={form.autoGenerate}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />

      <button
        onClick={generateCredentials}
        className="px-3 py-1 bg-gray-300 rounded"
      >
        自動生成
      </button>

      <button
        onClick={handleSubmit}
        className="px-4 py-2 bg-blue-600 text-white rounded shadow"
      >
        登録する
      </button>
    </div>
  );
};

export default AdminCreateDriver;