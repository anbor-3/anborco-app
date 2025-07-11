import React, { useState } from "react";

const AdminPasswordChange = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      alert("新しいパスワードが一致しません。");
      return;
    }

    const loggedIn = localStorage.getItem("loggedInAdmin");
    if (!loggedIn) {
      alert("ログイン情報が取得できません。");
      return;
    }

    const admin = JSON.parse(loggedIn);

    if (currentPassword !== admin.password) {
      alert("現在のパスワードが正しくありません。");
      return;
    }

    admin.password = newPassword;
    localStorage.setItem("loggedInAdmin", JSON.stringify(admin));

    alert("パスワードが変更されました");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">🔐 パスワード変更</h2>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block mb-1 font-medium">現在のパスワード</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">新しいパスワード</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">新しいパスワード（確認）</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
        <button
          onClick={handleChangePassword}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          パスワードを変更する
        </button>
      </div>
    </div>
  );
};

export default AdminPasswordChange;