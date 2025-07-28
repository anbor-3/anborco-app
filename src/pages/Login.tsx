import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";

const Login = () => {
  type Role = 'driver' | 'admin' | 'master';
  const [selectedRole, setSelectedRole] = useState<Role>('driver');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ マスター認証（固定 or 顧客発番）
    if (selectedRole === "master") {
      // 1) 固定認証
      if (id === "anbor" && password === "anboradminpass") {
        localStorage.setItem("loggedInMaster", JSON.stringify({
          id: "anbor",
          name: "マスター管理者",
          company: "ANBOR本社"
        }));
        localStorage.setItem("currentUser", JSON.stringify({
          id: "anbor",
          name: "マスター管理者",
          company: "ANBOR本社",
          role: "master"
        }));
        navigate("/master");
        return;
      }

      // 2) 顧客認証（customerMaster に保存されている ID & PW）
      const customers = JSON.parse(localStorage.getItem("customerMaster") || "[]");
      const user = customers.find((u: any) => u.uid === id.trim() && u.upw === password.trim());

      if (!user) {
        alert("ID または パスワードが違います");
        return;
      }

      localStorage.setItem("loggedInMaster", JSON.stringify(user));
      localStorage.setItem("currentUser", JSON.stringify({
        id: user.uid,
        name: user.contactPerson || user.company,
        company: user.company,
        role: "master"
      }));

      navigate("/master");
      return;
    }

    // ✅ ドライバー認証
    if (selectedRole === "driver") {
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith("driverList_"));
      let user: any = null;

      for (const key of allKeys) {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        const found = list.find((u: any) => u.loginId === id.trim() && u.password === password.trim());
        if (found) {
          user = found;
          break;
        }
      }

      if (!user) {
        alert("ログインID または パスワードが違います");
        return;
      }

      localStorage.setItem("loggedInDriver", JSON.stringify(user));
      localStorage.setItem("currentUser", JSON.stringify({
        id: user.uid,
        name: user.name,
        company: user.company,
        role: "driver"
      }));

      navigate("/driver");
      return;
    }

    // ✅ 管理者認証
    if (selectedRole === "admin") {
      const adminList = JSON.parse(localStorage.getItem("adminList") || "[]");
      const user = adminList.find((u: any) => u.id === id.trim() && u.password === password.trim());

      if (!user) {
        alert("ID または パスワードが違います");
        return;
      }

      localStorage.setItem("loggedInAdmin", JSON.stringify(user));
      localStorage.setItem("currentUser", JSON.stringify({
        id: user.id,
        name: user.name,
        company: user.company,
        role: "admin"
      }));

      navigate("/admin");
    }
  };

  return (
    <div className="login-container"> {/* ✅ 背景エリア */}
  <div className="login-box">
    <div className="flex justify-center mb-4">
      <img src="/logo.png" alt="ロゴ" className="h-20" />
    </div>
        <div className="flex justify-center gap-4 mb-4">
          <button
            className={`px-4 py-2 rounded ${selectedRole === 'driver' ? 'bg-green-700 text-white' : 'bg-green-200'}`}
            onClick={() => setSelectedRole('driver')}
          >
            ドライバー
          </button>
          <button
            className={`px-4 py-2 rounded ${selectedRole === 'admin' ? 'bg-green-700 text-white' : 'bg-green-200'}`}
            onClick={() => setSelectedRole('admin')}
          >
            管理者
          </button>
          <button
            className={`px-4 py-2 rounded ${selectedRole === 'master' ? 'bg-gray-700 text-white' : 'bg-gray-200'}`}
            onClick={() => setSelectedRole('master')}
          >
            マスター
          </button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">ID（ログインID）</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder={selectedRole === 'driver' ? 'ログインIDを入力' : 'IDを入力'}
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="パスワードを入力"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          >
            ログイン
          </button>
        </form>
        <div className="text-right mt-2">
          <Link to="/reset" className="text-sm text-blue-600 hover:underline">
            パスワードを忘れた方はこちら
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
