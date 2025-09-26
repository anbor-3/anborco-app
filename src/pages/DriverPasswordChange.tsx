
import React, { useState } from "react";

const DriverPasswordChange = () => {
  const [current, setCurrent] = useState("");
  const [nextPass, setNextPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  const driver = JSON.parse(localStorage.getItem("loggedInDriver") || "{}");

  const handleChange = () => {
    if (nextPass !== confirm) {
      setMsg("新パスワードが一致しません");
      return;
    }
    const list = JSON.parse(localStorage.getItem("driverList") || "[]");
    const user = list.find((u:any)=>u.id===driver.id);
    if (!user || user.password!==current) {
      setMsg("現在のパスワードが違います");
      return;
    }
    user.password = nextPass;
    localStorage.setItem("driverList", JSON.stringify(list));
    setMsg("パスワードを変更しました");
    setCurrent(""); setNextPass(""); setConfirm("");
  };

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-bold">🔑 パスワード変更 <span className="text-sm text-gray-500">- Change Password -</span></h1>
      <input
  type="password"
  placeholder="現在のパスワード"
  value={current}
  onChange={(e) => setCurrent(e.target.value)}
  className="border w-full px-2 py-1 text-black"
/>
<input
  type="password"
  placeholder="新パスワード"
  value={nextPass}
  onChange={(e) => setNextPass(e.target.value)}
  className="border w-full px-2 py-1 text-black"
/>
<input
  type="password"
  placeholder="新パスワード(確認)"
  value={confirm}
  onChange={(e) => setConfirm(e.target.value)}
  className="border w-full px-2 py-1 text-black"
/>
      <button onClick={handleChange} className="bg-green-600 text-white px-4 py-2 rounded">変更</button>
      {msg && <p className="text-red-600">{msg}</p>}
    </div>
  )
};

export default DriverPasswordChange;
