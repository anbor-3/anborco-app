import React, { useState } from "react";

const PasswordReset = () => {
  const [id, setId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState("driver");
  const [message, setMessage] = useState("");

  const handleReset = () => {
    if (role === "master") {
      setMessage("マスターのパスワードはリセットできません");
      return;
    }

    const key = role === "driver" ? "driverList" : "adminList";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const user = list.find((u: any) => u.id === id.trim());

    if (!user) {
      setMessage("指定されたIDが見つかりません");
      return;
    }

    user.password = newPassword;
    localStorage.setItem(key, JSON.stringify(list));
    setMessage("パスワードをリセットしました");
  };

  return (
    <div className="space-y-4 max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold">🔁 パスワードリセット</h1>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="border w-full px-2 py-1"
      >
        <option value="driver">ドライバー</option>
        <option value="admin">管理者</option>
      </select>
      <input
        type="text"
        placeholder="ユーザーID"
        value={id}
        onChange={(e) => setId(e.target.value)}
        className="border w-full px-2 py-1"
      />
      <input
        type="password"
        placeholder="新しいパスワード"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="border w-full px-2 py-1"
      />
      <button
        onClick={handleReset}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        リセット
      </button>
      {message && <p className="text-red-600">{message}</p>}
    </div>
  );
};

export default PasswordReset;
