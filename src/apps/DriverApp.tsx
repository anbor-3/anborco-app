// src/driver/App.tsx
import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { hardRefreshOnce } from "../utils/hardRefresh";
import { FileText, FolderOpen, User, Truck, Menu, X } from "lucide-react";

import DriverDailyReport from "../pages/DriverDashboard";
import DriverProfile from "../pages/DriverProfile";
import DriverProjectList from "../pages/DriverProjectList";
import DriverFileManager from "../pages/DriverFileManager";
import DriverDocumentUpload from "../pages/DriverDocumentUpload";
import DriverPasswordChange from "../pages/DriverPasswordChange";
import DriverPaymentPreview from "../pages/DriverPaymentPreview";
import DriverInvoiceCreator from "../pages/DriverInvoiceCreator";
import DriverChatPage from "../pages/DriverChatPage";

/** 会社ロゴ/社名/登録者名をローカルから推定取得（なければフォールバック） */
function useOrgInfo() {
  return useMemo(() => {
    let companyName = "会社未設定";
    let registrant = "未ログイン";
    let logoUrl: string | null = null;

    try {
      const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
      companyName = user?.company || companyName;
      registrant = user?.name || registrant;
      // currentUserにロゴが入っている場合
      if (typeof user?.logoUrl === "string" && user.logoUrl.length > 0) {
        logoUrl = user.logoUrl;
      }
    } catch {}

    // よくありそうな保存キーを順に探索
    const candidates = ["companyLogoUrl", "orgLogoUrl", "logoUrl", "logo"];
    for (const k of candidates) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        // JSON文字列 or 直URL の両対応
        const val = raw.startsWith("{") ? JSON.parse(raw)?.url ?? JSON.parse(raw)?.logoUrl : raw;
        if (typeof val === "string" && val.length > 0) {
          logoUrl = val;
          break;
        }
      } catch {}
    }

    // 最後のフォールバック（public/logo.png 前提）
    if (!logoUrl) logoUrl = "/logo.png";

    return { companyName, registrant, logoUrl };
  }, []);
}

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("__hard_refreshed__")) {
      hardRefreshOnce();
    }
  }, []);

  const { companyName, registrant, logoUrl } = useOrgInfo();

  const isActive = (seg: string) => {
    const p = location.pathname;
    if (p === "/driver" && seg === "daily-report") return true;
    return p.endsWith(`/${seg}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("loggedInDriver");
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen text-slate-100 overflow-x-hidden">
      {/* === 背景（ログインと同系のダーク×ネオン） === */}
      <div aria-hidden className="absolute inset-0 bg-[#0b1220] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div aria-hidden className="absolute inset-0 bg-white/[0.06] backdrop-blur-[2px]" />
       <div
  aria-hidden
  className="pointer-events-none fixed top-16 left-0 md:left-72 right-0 bottom-0
             px-3 sm:px-5 lg:px-8 xl:px-12"
>
  <div className="h-full w-full rounded-[28px] ring-8 ring-white/35 ring-inset" />
</div>
       <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-teal-400/25 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      {/* === ヘッダー（左右端にロゴ ←→ 会社名/登録者名＋ログアウト） === */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-slate-900/70 backdrop-blur border-b border-white/10">
        <div className="mx-auto h-full max-w-[1900px] px-0 pr-3 flex items-center justify-between">
  {/* 左端：ロゴを最左。メニューはその右 (SPのみ表示) */}
  <div className="flex items-center gap-3 pl-2">
    <img
      src={logoUrl}
      alt={companyName}
      className="h-9 w-auto"
      onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/logo.png")}
    />
    <button
      className="inline-flex items-center justify-center rounded-lg p-2 md:hidden hover:bg-white/10"
      aria-label="メニュー"
      onClick={() => setSidebarOpen(true)}
    >
      <Menu size={22} />
    </button>
  </div>

          {/* 右端：会社名 / 登録者名 ＋ ログアウト */}
          <div className="flex items-center gap-4">
            <div
              className="hidden sm:block px-2 py-1 rounded text-xs sm:text-sm font-bold text-white/90 bg-white/10 border border-white/20 max-w-[40vw] truncate"
              title={`${companyName} / ${registrant}`}
            >
              {companyName} / {registrant}
            </div>
            <button
              onClick={handleLogout}
              className="text-red-300 hover:text-red-200 font-bold px-3 py-1 rounded hover:bg-white/10"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* === レイアウト（ヘッダーにかぶらない / サイドバー固定幅） === */}
      <div className="pt-16 relative z-10"> 
        {/* オーバーレイ（モバイル時サイドバー開時） */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* サイドバー */}
<aside
  className={[
    // 画面上でヘッダーの下から全高ぴったり
    "fixed z-50 top-16 left-0 h-[calc(100vh-64px)] w-72 transform transition-transform duration-200",
    "bg-white/5 border-r border-white/10 backdrop-blur-xl shadow-2xl",
    // 基本は隠す（モバイル）。md以上は常時表示
    sidebarOpen ? "translate-x-0" : "-translate-x-full",
    "md:translate-x-0",
  ].join(" ")}
>
  {/* モバイル用クローズ */}
  <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/10">
    <span className="text-sm font-semibold text-white/80">メニュー</span>
    <button
      className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-white/10"
      aria-label="閉じる"
      onClick={() => setSidebarOpen(false)}
    >
      <X size={18} />
    </button>
  </div>

  {/* ← ここが空だったのが原因。リンクを復活させます */}
  <nav className="px-3 pb-6 pt-4 space-y-1 overflow-y-auto h-[calc(100%-52px)] md:h-full">
    <SectionLink to="daily-report" icon={<FileText size={18} />} active={isActive("daily-report")} onClick={() => setSidebarOpen(false)}>
      日報提出
    </SectionLink>
    <SectionLink to="chat" icon={<FileText size={18} />} active={isActive("chat")} onClick={() => setSidebarOpen(false)}>
      チャット
    </SectionLink>
    <SectionLink to="files" icon={<FolderOpen size={18} />} active={isActive("files")} onClick={() => setSidebarOpen(false)}>
      ファイル管理
    </SectionLink>
    <SectionLink to="profile" icon={<User size={18} />} active={isActive("profile")} onClick={() => setSidebarOpen(false)}>
      プロフィール
    </SectionLink>
    <SectionLink to="projects" icon={<Truck size={18} />} active={isActive("projects")} onClick={() => setSidebarOpen(false)}>
      案件一覧
    </SectionLink>
    <SectionLink to="submit-documents" icon={<FileText size={18} />} active={isActive("submit-documents")} onClick={() => setSidebarOpen(false)}>
      書類提出
    </SectionLink>
    <SectionLink to="change-password" icon={<User size={18} />} active={isActive("change-password")} onClick={() => setSidebarOpen(false)}>
      パスワード変更
    </SectionLink>
  </nav>
</aside>

        {/* メイン：白枠内で左右5%ずつ内側に（=幅90%） */}
<main
  className="fixed top-16 left-0 md:left-72 right-0 bottom-0
             px-3 sm:px-5 lg:px-8 xl:px-12 py-3
             z-20 overflow-hidden"
>
  {/* ← ここを追加：幅90%＋中央寄せ */}
  <div className="h-full w-[99%] mx-auto">
    {/* ボックス本体（角丸は白枠28pxより小さい24pxのままでOK） */}
    <div className="h-full w-full rounded-[24px] border border-white/10
                    bg-white/5 backdrop-blur-xl shadow-2xl overflow-auto">
      <div className="p-4 sm:p-6 md:p-8 min-h-full">
        <Routes>
          <Route path="/" element={<DriverDailyReport />} />
          <Route path="daily-report" element={<DriverDailyReport />} />
          <Route path="files" element={<DriverFileManager />} />
          <Route path="profile" element={<DriverProfile />} />
          <Route path="projects" element={<DriverProjectList />} />
          <Route path="submit-documents" element={<DriverDocumentUpload />} />
          <Route path="change-password" element={<DriverPasswordChange />} />
          <Route path="/driver/payment/:year/:month" element={<DriverPaymentPreview />} />
          <Route path="invoice" element={<DriverInvoiceCreator />} />
          <Route path="chat" element={<DriverChatPage />} />
        </Routes>
      </div>
    </div>
  </div>
</main>
      </div>
    </div>
  );
};

/** サイドバー用リンク部品（アクティブ強調はネオングロー寄り） */
function SectionLink({
  to,
  icon,
  active,
  onClick,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={[
        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition",
        active
          ? "bg-gradient-to-r from-teal-400/30 to-cyan-400/30 text-white ring-1 ring-cyan-300/40 shadow-[0_0_22px_rgba(34,211,238,.35)]"
          : "text-white/80 hover:text-white hover:bg-white/10"
      ].join(" ")}
    >
      <span className="opacity-90">{icon}</span>
      {children}
    </Link>
  );
}

export default App;
