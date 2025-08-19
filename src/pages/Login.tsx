import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { initialDemoDrivers } from "../utils/initialDemoDrivers";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseClient"; // あなたの Firebase 初期化ファイル

const resetDemoData = () => {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem("driverList_demoCompany", JSON.stringify(initialDemoDrivers));
  localStorage.setItem("demoResetDate", today);
  console.log("✅ demoデータを初期化しました");
};

const Login = () => {
  type Role = "driver" | "admin" | "master";
  const [selectedRole, setSelectedRole] = useState<Role>("driver");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

// ここからここまでを差し替え：Login.tsx の handleSubmit 全文
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (loading) return;
  setLoading(true);

  try {
    if (!id.trim() || !password.trim()) {
      alert("ID と パスワードを入力してください");
      return;
    }

    // --- master ---
    if (selectedRole === "master") {
      if (id === "anbor" && password === "anboradminpass") {
        localStorage.setItem("currentUser", JSON.stringify({
          id: "anbor", name: "マスター管理者", company: "ANBOR本社", role: "master"
        }));
        navigate("/master");
        return;
      }

      const typed = id.trim();
      const email = typed.includes("@") ? typed.toLowerCase() : `${typed.toLowerCase()}@anborco.jp`;
      await signInWithEmailAndPassword(auth, email, password.trim());

      // メタは Firestore 推奨（暫定で localStorage にあるなら併用）
      const customers = JSON.parse(localStorage.getItem("customerMaster") || "[]");
      const meta = customers.find((u: any) =>
        (typeof u.uid === "string" && u.uid.toLowerCase() === email) ||
        (typeof u.loginId === "string" && u.loginId.toLowerCase() === typed)
      );

      localStorage.setItem("currentUser", JSON.stringify({
        id: email, name: meta?.contactPerson || meta?.company || email,
        company: meta?.company || "", role: "master"
      }));
      navigate("/master");
      return;
    }

    // --- driver（暫定：localStorage、将来はFirestoreに） ---
    if (selectedRole === "driver") {
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith("driverList_"));
      let user: any = null;
      for (const key of allKeys) {
        const list = JSON.parse(localStorage.getItem(key) || "[]");
        const found = list.find((u: any) =>
          u.loginId?.toLowerCase?.() === id.trim().toLowerCase() &&
          u.password === password.trim()
        );
        if (found) { user = found; break; }
      }
      if (!user) { alert("ログインID または パスワードが違います"); return; }

      if (user.loginId === "demo") resetDemoData();

      localStorage.setItem("currentUser", JSON.stringify({
        id: user.uid, name: user.name, company: user.company, role: "driver"
      }));
      navigate("/driver");
      return;
    }

    // --- admin ---
if (selectedRole === "admin") {
  const typed = id.trim();
  const pass = password.trim();

  // ✅ デモバイパス：ID=demo & PW=demo は Firebase を使わず即ログイン
  if (typed.toLowerCase() === "demo" && pass === "demo") {
    const demoUser = {
      loginId: "demo",
      contactPerson: "管理者デモ",
      company: "デモ会社",
    };

    // adminMaster に demo が無ければ最小限を追加（ブラウザ保存）
    const list = JSON.parse(localStorage.getItem("adminMaster") || "[]");
    if (!list.some((u: any) => u?.loginId?.toLowerCase?.() === "demo")) {
      list.push(demoUser);
      localStorage.setItem("adminMaster", JSON.stringify(list));
    }

    // デモ用データ初期化（任意）
    resetDemoData();

    localStorage.setItem("currentUser", JSON.stringify({
      id: "demo",
      name: demoUser.contactPerson,
      company: demoUser.company,
      role: "admin",
    }));
    localStorage.setItem("company", demoUser.company);
    navigate("/admin");
    return;
  }

  // ✅ 通常ルート（Firebase Auth）
  const email = typed.includes("@") ? typed.toLowerCase() : `${typed.toLowerCase()}@anborco.jp`;
  await signInWithEmailAndPassword(auth, email, pass);

  const adminList = JSON.parse(localStorage.getItem("adminMaster") || "[]");
  const user = adminList.find((u: any) =>
    (typeof u.loginId === "string" && u.loginId.toLowerCase() === typed.toLowerCase()) ||
    (typeof u.uid === "string" && u.uid.toLowerCase() === email)
  );

  if (user?.loginId === "demo") resetDemoData();

  localStorage.setItem("currentUser", JSON.stringify({
    id: user?.loginId || typed,
    name: user?.contactPerson || user?.company || typed,
    company: user?.company || "",
    role: "admin",
  }));
  localStorage.setItem("company", user?.company || "");
  navigate("/admin");
  return;
}

  } catch (e: any) {
    console.error(e);
    const msg = (e?.code === "auth/user-not-found" || e?.code === "auth/wrong-password")
      ? "ID または パスワードが違います"
      : "ログインに失敗しました。しばらくしてから再度お試しください。";
    alert(msg);
  } finally {
    // どの経路でも最後に1回だけ解除
    setLoading(false);
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
            className={`px-6 py-3 rounded text-base font-semibold ${
              selectedRole === "driver" ? "bg-green-700 text-white" : "bg-green-200"
            }`}
            onClick={() => setSelectedRole("driver")}
            disabled={loading}
          >
            ドライバー
          </button>
          <button
            className={`px-6 py-3 rounded text-base font-semibold ${
              selectedRole === "admin" ? "bg-green-700 text-white" : "bg-green-200"
            }`}
            onClick={() => setSelectedRole("admin")}
            disabled={loading}
          >
            管理者
          </button>
          <button
            className={`px-6 py-3 rounded text-base font-semibold ${
              selectedRole === "master" ? "bg-gray-700 text-white" : "bg-gray-200"
            }`}
            onClick={() => setSelectedRole("master")}
            disabled={loading}
          >
            マスター
          </button>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block mb-2 text-base font-semibold text-gray-700">
              ID（ログインID）
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={loading}
              className="w-full px-5 py-3 border border-gray-300 rounded-md text-lg"
              placeholder={selectedRole === "driver" ? "ログインIDを入力" : "IDを入力"}
            />
          </div>

          <div>
            <label className="block mb-2 text-base font-semibold text-gray-700">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-5 py-3 border border-gray-300 rounded-md text-lg"
              placeholder="パスワードを入力"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 text-lg font-bold rounded transition ${
              loading ? "bg-gray-400 cursor-not-allowed text-white" : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {loading ? "ログイン中..." : "ログイン"}
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
