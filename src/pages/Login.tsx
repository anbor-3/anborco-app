import  { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";
import { initialDemoDrivers } from "../utils/initialDemoDrivers";

const resetDemoData = () => {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem("driverList_demoCompany", JSON.stringify(initialDemoDrivers));
  localStorage.setItem("demoResetDate", today);
  console.log("✅ demoデータを初期化しました");
};

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
      if (user.loginId === "demo") {
  resetDemoData(); // 👈 demoログイン時のみ初期化
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
      if (user.id === "demo") {
  resetDemoData(); // 👈 demoログイン時のみ初期化
}
      localStorage.setItem("loggedInAdmin", JSON.stringify(user));
      localStorage.setItem("currentUser", JSON.stringify({
        id: user.id,
        name: user.name,
        company: user.company,
        role: "admin"
      }));
      localStorage.setItem("company", user.company);
      navigate("/admin");
    }
  };

  return (
    <div className="login-container flex items-center justify-center min-h-screen bg-gray-100">
  <div className="login-box w-full max-w-2xl bg-white p-10 rounded shadow-lg">
    <div className="flex justify-center mb-6">
      <img src="/logo.png" alt="ロゴ" className="h-40" />
    </div>
    <div className="flex justify-center gap-4 mb-6">
      <button
        className={`px-6 py-3 rounded text-base font-semibold ${selectedRole === 'driver' ? 'bg-green-700 text-white' : 'bg-green-200'}`}
        onClick={() => setSelectedRole('driver')}
      >
        ドライバー
      </button>
      <button
        className={`px-6 py-3 rounded text-base font-semibold ${selectedRole === 'admin' ? 'bg-green-700 text-white' : 'bg-green-200'}`}
        onClick={() => setSelectedRole('admin')}
      >
        管理者
      </button>
      <button
        className={`px-6 py-3 rounded text-base font-semibold ${selectedRole === 'master' ? 'bg-gray-700 text-white' : 'bg-gray-200'}`}
        onClick={() => setSelectedRole('master')}
      >
        マスター
      </button>
    </div>
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <label className="block mb-2 text-base font-semibold text-gray-700">ID（ログインID）</label>
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="w-full px-5 py-3 border border-gray-300 rounded-md text-lg"
          placeholder={selectedRole === 'driver' ? 'ログインIDを入力' : 'IDを入力'}
        />
      </div>
      <div>
        <label className="block mb-2 text-base font-semibold text-gray-700">パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-5 py-3 border border-gray-300 rounded-md text-lg"
          placeholder="パスワードを入力"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-green-600 text-white py-3 text-lg font-bold rounded hover:bg-green-700 transition"
      >
        ログイン
      </button>
    </form>
    <div className="text-right mt-4">
      <Link to="/reset" className="text-sm text-blue-600 hover:underline">
        パスワードを忘れた方はこちら
      </Link>
    </div>
  </div>
</div>
  );
};

export default Login;
