import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";

function seedDemoUsers() {
  const demo = {
    id: "demo",
    password: "demo",
    name: "安保ルコ",
    company: "株式会社アンボルコ",
  };

  // ドライバー
  const dl = JSON.parse(localStorage.getItem("driverList") || "[]");
  if (!dl.find((u: any) => u.id === "demo")) {
    dl.push(demo);
    localStorage.setItem("driverList", JSON.stringify(dl));
  }

  // 管理者
  const al = JSON.parse(localStorage.getItem("adminList") || "[]");
  if (!al.find((u: any) => u.id === "demo")) {
    al.push(demo);
    localStorage.setItem("adminList", JSON.stringify(al));
  }

  // マスター ← これをここに追加するのが正解！
  const ml = JSON.parse(localStorage.getItem("masterList") || "[]");
  if (!ml.find((u: any) => u.id === "demo")) {
    ml.push(demo);
    localStorage.setItem("masterList", JSON.stringify(ml));
  }
}

const Login = () => {
  type Role = 'driver' | 'admin' | 'master';
  const [selectedRole, setSelectedRole] = useState<Role>('driver');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
useEffect(() => {
    seedDemoUsers();          // ← 初回マウント時に 1 度だけ実行
  }, []);

    const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  const listKey = selectedRole === "driver"
    ? "driverList"
    : selectedRole === "admin"
    ? "adminList"
    : "masterList";

  const loginKey = selectedRole === "driver"
    ? "loggedInDriver"
    : selectedRole === "admin"
    ? "loggedInAdmin"
    : "loggedInMaster";

  const nextRoute = selectedRole === "driver"
    ? "/driver"
    : selectedRole === "admin"
    ? "/admin"
    : "/master";

  const users = JSON.parse(localStorage.getItem(listKey) || "[]");
  const user = users.find(
     (u: any) => u.id === id.trim() && u.password === password.trim()
);

  if (!user) {
    alert("ID またはパスワードが違います");
    return;
  }

  localStorage.setItem(
    loginKey,
    JSON.stringify({
      id: user.id,
      name: user.name,
      company: user.company,
    })
  );

  navigate(nextRoute); // ← 条件なしで通常遷移
};

  return (
    <div className="flex h-screen bg-green-50">
      <div className="m-auto w-full max-w-md p-6 bg-white rounded-lg shadow-md">
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
            <label className="block mb-1 text-sm font-medium text-gray-700">ID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="IDを入力"
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
