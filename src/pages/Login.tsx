// src/pages/Login.tsx  ← 丸ごと置換してください
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { initialDemoDrivers } from "../utils/initialDemoDrivers";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseClient"; // Firebase Auth をエクスポートしている前提

// ---- 本番補足：マスター認証情報は環境変数から読み込み（なければ従来値にフォールバック）----
const MASTER_ID = import.meta.env.VITE_MASTER_ID ?? "anbor";
const MASTER_PASSWORD = import.meta.env.VITE_MASTER_PASSWORD ?? "anboradminpass";

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

  // ---- 元の意図を維持しつつ、本番向けにnullガード/整形を強化 ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const typedRaw = id ?? "";
      const passRaw = password ?? "";
      const typed = typedRaw.trim();
      const pass = passRaw.trim();

      if (!typed || !pass) {
        alert("ID と パスワードを入力してください");
        return;
      }

      // --- master ---
      if (selectedRole === "master") {
        // 1) 固定ID/パス（環境変数化）での即ログイン（元仕様互換）
        if (typed === MASTER_ID && pass === MASTER_PASSWORD) {
          localStorage.setItem(
            "currentUser",
            JSON.stringify({
              id: MASTER_ID,
              name: "マスター管理者",
              company: "ANBOR本社",
              role: "master",
            })
          );
          navigate("/master");
          return;
        }

        // 2) メール/ID → メール化して Firebase Auth
        const email = typed.includes("@")
          ? typed.toLowerCase()
          : `${typed.toLowerCase()}@anborco.jp`;
        await signInWithEmailAndPassword(auth, email, pass);

        // ローカルの顧客台帳をメタ参照（元仕様互換）
        const customers = JSON.parse(localStorage.getItem("customerMaster") || "[]");
        const meta = customers.find(
          (u: any) =>
            (typeof u?.uid === "string" && u.uid.toLowerCase() === email) ||
            (typeof u?.loginId === "string" && u.loginId.toLowerCase() === typed.toLowerCase())
        );

        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            id: email,
            name: meta?.contactPerson || meta?.company || email,
            company: meta?.company || "",
            role: "master",
          })
        );
        navigate("/master");
        return;
      }

      // --- driver（localStorage 照合 + demo バイパス） ---
      if (selectedRole === "driver") {
        // ✅ demo 即ログイン（元仕様互換）
        if (typed.toLowerCase() === "demo" && pass === "demo") {
          resetDemoData();
          const demoUser = {
            uid: "demo-driver-001",
            name: "デモ太郎",
            company: "デモ会社",
            loginId: "demo",
          };
          localStorage.setItem(
            "currentUser",
            JSON.stringify({
              id: demoUser.uid,
              name: demoUser.name,
              company: demoUser.company,
              role: "driver",
            })
          );
          localStorage.setItem("company", demoUser.company);
          localStorage.setItem("loginId", demoUser.loginId);
          localStorage.setItem("loggedInDriver", "1");
          navigate("/driver", { replace: true });
          return;
        }

        // 通常：ブラウザ保存の driverList_* から照合（元仕様）
        const allKeys = Object.keys(localStorage).filter((k) => k.startsWith("driverList_"));
        let user: any = null;
        for (const key of allKeys) {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          const found = list.find(
            (u: any) =>
              u?.loginId?.toLowerCase?.() === typed.toLowerCase() &&
              (u?.password === pass || u?.password?.toString?.() === pass)
          );
          if (found) {
            user = found;
            break;
          }
        }
        if (!user) {
          alert("ログインID または パスワードが違います");
          return;
        }

        if (user.loginId === "demo") resetDemoData();

        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            id: user.uid,
            name: user.name,
            company: user.company,
            role: "driver",
          })
        );
        localStorage.setItem("company", user.company);
        localStorage.setItem("loginId", user.loginId);
        localStorage.setItem("loggedInDriver", "1");
        navigate("/driver");
        return;
      }

      // --- admin ---
      if (selectedRole === "admin") {
        // ✅ demo 即ログイン（元仕様互換）
        if (typed.toLowerCase() === "demo" && pass === "demo") {
          const demoUser = { loginId: "demo", contactPerson: "管理者デモ", company: "デモ会社" };
          const list = JSON.parse(localStorage.getItem("adminMaster") || "[]");
          if (!list.some((u: any) => u?.loginId?.toLowerCase?.() === "demo")) {
            list.push(demoUser);
            localStorage.setItem("adminMaster", JSON.stringify(list));
          }
          resetDemoData();

          localStorage.setItem(
            "currentUser",
            JSON.stringify({
              id: "demo",
              name: demoUser.contactPerson,
              company: demoUser.company,
              role: "admin",
            })
          );
          localStorage.setItem("company", demoUser.company);
          navigate("/admin");
          return;
        }

        // 通常：Firebase Auth（メール or ID→メール化）+ 管理者マスタ参照（元仕様）
        const email = typed.includes("@")
          ? typed.toLowerCase()
          : `${typed.toLowerCase()}@anborco.jp`;
        await signInWithEmailAndPassword(auth, email, pass);

        const adminList = JSON.parse(localStorage.getItem("adminMaster") || "[]");
        const user = adminList.find(
          (u: any) =>
            (typeof u?.loginId === "string" &&
              u.loginId.toLowerCase() === typed.toLowerCase()) ||
            (typeof u?.uid === "string" && u.uid.toLowerCase() === email)
        );

        if (user?.loginId === "demo") resetDemoData();

        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            id: user?.loginId || typed,
            name: user?.contactPerson || user?.company || typed,
            company: user?.company || "",
            role: "admin",
          })
        );
        localStorage.setItem("company", user?.company || "");
        navigate("/admin");
        return;
      }
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.code === "auth/user-not-found" || e?.code === "auth/wrong-password"
          ? "ID または パスワードが違います"
          : "ログインに失敗しました。しばらくしてから再度お試しください。";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---- UIは元のまま（クラス名/構造/文言も不変更）----
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
              loading
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-green-600 text-white hover:bg-green-700"
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
