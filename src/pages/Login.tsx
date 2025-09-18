// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { initialDemoDrivers } from "../utils/initialDemoDrivers";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseClient";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const typed = (id ?? "").trim();
      const pass = (password ?? "").trim();
      if (!typed || !pass) { alert("ID と パスワードを入力してください"); return; }

      // --- master ---
      if (selectedRole === "master") {
        if (typed === MASTER_ID && pass === MASTER_PASSWORD) {
          localStorage.setItem("currentUser", JSON.stringify({ id: MASTER_ID, name: "マスター管理者", company: "ANBOR本社", role: "master" }));
          navigate("/master"); return;
        }
        const email = typed.includes("@") ? typed.toLowerCase() : `${typed.toLowerCase()}@anborco.jp`;
        await signInWithEmailAndPassword(auth, email, pass);
        const customers = JSON.parse(localStorage.getItem("customerMaster") || "[]");
        const meta = customers.find((u: any) =>
          (typeof u?.uid === "string" && u.uid.toLowerCase() === email) ||
          (typeof u?.loginId === "string" && u.loginId.toLowerCase() === typed.toLowerCase())
        );
        localStorage.setItem("currentUser", JSON.stringify({ id: email, name: meta?.contactPerson || meta?.company || email, company: meta?.company || "", role: "master" }));
        navigate("/master"); return;
      }

      // --- driver ---
      if (selectedRole === "driver") {
        if (typed.toLowerCase() === "demo" && pass === "demo") {
          resetDemoData();
          const demoUser = { uid: "demo-driver-001", name: "デモ太郎", company: "デモ会社", loginId: "demo" };
          localStorage.setItem("currentUser", JSON.stringify({ id: demoUser.uid, name: demoUser.name, company: demoUser.company, role: "driver" }));
          localStorage.setItem("company", demoUser.company);
          localStorage.setItem("loginId", demoUser.loginId);
          localStorage.setItem("loggedInDriver", "1");
          navigate("/driver", { replace: true }); return;
        }
        const allKeys = Object.keys(localStorage).filter((k) => k.startsWith("driverList_"));
        let user: any = null;
        for (const key of allKeys) {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          const found = list.find((u: any) =>
            u?.loginId?.toLowerCase?.() === typed.toLowerCase() &&
            (u?.password === pass || u?.password?.toString?.() === pass)
          );
          if (found) { user = found; break; }
        }
        if (!user) { alert("ログインID または パスワードが違います"); return; }
        if (user.loginId === "demo") resetDemoData();
        localStorage.setItem("currentUser", JSON.stringify({ id: user.uid, name: user.name, company: user.company, role: "driver" }));
        localStorage.setItem("company", user.company);
        localStorage.setItem("loginId", user.loginId);
        localStorage.setItem("loggedInDriver", "1");
        navigate("/driver"); return;
      }

      // --- admin ---
      if (selectedRole === "admin") {
        if (typed.toLowerCase() === "demo" && pass === "demo") {
          const demoUser = { loginId: "demo", contactPerson: "管理者デモ", company: "デモ会社" };
          const list = JSON.parse(localStorage.getItem("adminMaster") || "[]");
          if (!list.some((u: any) => u?.loginId?.toLowerCase?.() === "demo")) { list.push(demoUser); localStorage.setItem("adminMaster", JSON.stringify(list)); }
          resetDemoData();
          localStorage.setItem("currentUser", JSON.stringify({ id: "demo", name: demoUser.contactPerson, company: demoUser.company, role: "admin" }));
          localStorage.setItem("company", demoUser.company);
          navigate("/admin"); return;
        }
        const email = typed.includes("@") ? typed.toLowerCase() : `${typed.toLowerCase()}@anborco.jp`;
        await signInWithEmailAndPassword(auth, email, pass);
        const adminList = JSON.parse(localStorage.getItem("adminMaster") || "[]");
        const user = adminList.find((u: any) =>
          (typeof u?.loginId === "string" && u.loginId.toLowerCase() === typed.toLowerCase()) ||
          (typeof u?.uid === "string" && u.uid.toLowerCase() === email)
        );
        if (user?.loginId === "demo") resetDemoData();
        localStorage.setItem("currentUser", JSON.stringify({ id: user?.loginId || typed, name: user?.contactPerson || user?.company || typed, company: user?.company || "", role: "admin" }));
        localStorage.setItem("company", user?.company || "");
        navigate("/admin"); return;
      }
    } catch (e: any) {
      console.error(e);
      const msg = e?.code === "auth/user-not-found" || e?.code === "auth/wrong-password"
        ? "ID または パスワードが違います"
        : "ログインに失敗しました。しばらくしてから再度お試しください。";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="fixed inset-0 overflow-hidden text-slate-100">
    {/* 背景＆塗り＆白枠 */}
    <div aria-hidden className="absolute inset-0 bg-[#0b1220] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
    <div aria-hidden className="absolute inset-0 bg-white/[0.06] backdrop-blur-[2px]" />
    <div aria-hidden className="pointer-events-none absolute inset-3 sm:inset-5 lg:inset-12 xl:inset-16 rounded-[32px] border-[8px] border-white/35" />

    {/* ネオングロー */}
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-teal-400/25 blur-3xl" />
      <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
    </div>

    {/* ★白枠の内側を10%縮小し、左右5:5の等幅に */}
    <div className="absolute inset-3 sm:inset-5 lg:inset-12 xl:inset-16 z-10">
      <div className="h-full w-full flex items-center justify-center">
        <div className="h-[90%] w-[90%]">
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">

            {/* 左：タイトル + 画像（カード高さ=右と同じ） */}
            <div className="min-h-0 flex flex-col">
              <p className="text-center text-white/85 text-base sm:text-lg lg:text-xl font-semibold mb-3 sm:mb-4">
                運転日報・業務管理アプリ
              </p>
              <div className="relative flex-1 min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-2xl">
                <img
                  src={`${import.meta.env.BASE_URL}login-visual.jpg`}
                  alt="近未来の軽バン配送イメージ"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            {/* 右：ログイン（中央寄せ＋左右10%狭め） */}
<div className="min-h-0 flex flex-col">
  {/* カード自体をフレックスにして縦中央寄せ。外側のパディングは0に移動 */}
  <div className="flex-1 min-h-0 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-0 flex">
    {/* 中身を左右10%狭め（=幅80%）かつ縦中央に配置。溢れたら中だけスクロール */}
    <div className="my-auto mx-auto w-[80%] max-h-full overflow-auto p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">ログイン</h2>
      </div>

      {/* 役割タブ */}
      <div className="mb-6 rounded-xl bg-white/5 p-1 shadow-inner">
        <div className="grid grid-cols-3 gap-1">
          {(["driver","admin","master"] as Role[]).map((role) => {
            const selected = selectedRole === role;
            const label = role === "driver" ? "ドライバー" : role === "admin" ? "管理者" : "マスター";
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                disabled={loading}
                aria-pressed={selected}
                className={[
                  "h-11 rounded-lg text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/60",
                  selected
                    ? "bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 shadow-[0_0_22px_rgba(34,211,238,.45)]"
                    : "text-white/75 hover:text-white"
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">ID（ログインID）</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={loading}
            placeholder={selectedRole === "driver" ? "ログインIDを入力" : "IDを入力"}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-cyan-400/60"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="パスワードを入力"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-cyan-400/60"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={[
            "w-full rounded-xl py-3.5 text-base font-bold tracking-wide transition",
            loading
              ? "cursor-not-allowed bg-white/20 text-white/60"
              : "bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 shadow-[0_0_30px_rgba(34,211,238,.45)] hover:brightness-110"
          ].join(" ")}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>

      <div className="mt-4 text-right">
        <Link to="/reset" className="text-sm text-cyan-300/80 underline-offset-4 hover:text-cyan-300 hover:underline">
          パスワードを忘れた方はこちら
        </Link>
      </div>
    </div>
  </div>

  <div className="mt-3 text-center text-xs text-white/40 sm:hidden">© Anborco</div>
</div>

          </div>
        </div>
      </div>
    </div>
  </div>
);
};
export default Login;
