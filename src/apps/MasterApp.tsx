import { Link, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import CustomerTable from "../pages/CustomerTable";
import MasterPasswordChange from "../pages/MasterPasswordChange";

export default function App() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen">
      {/* 共通ヘッダー */}
      <header className="bg-green-100 flex items-center justify-between px-4 py-2 w-full">
        <img
          src="/logo.png"
          alt="ロゴ"
          className="h-full object-contain ml-4"
          style={{ maxHeight: "48px" }}
        />
        <div className="flex items-center gap-4 mr-4">
          <div className="border border-white bg-white px-2 py-1 rounded font-bold text-black flex items-center gap-2">
            <span className="text-xs">株式会社Anbor</span>
            <span className="text-base">山田太郎</span>
          </div>
          <button
            className="text-sm text-red-500 hover:text-red-700"
            onClick={() => {
  localStorage.removeItem("loggedInMaster");
  navigate("/login"); // ← これが正しい遷移先
}}
          >
            ログアウト
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* サイドバー */}
        <aside className="bg-green-800 text-white w-64 pt-4">
          <div className="px-4 pb-2 text-left font-bold text-white text-sm border-b border-white">
            メニュー
          </div>
          <ul className="space-y-2 p-4 text-center">
            <li className="flex items-center justify-start gap-2 pl-4">
              <span>📋</span>
              <Link to="/master/customers" className="hover:underline">
                契約顧客一覧
              </Link>
            </li>
            <li className="flex items-center justify-start gap-2 pl-4">
              <span>📁</span>
              <a
                href="/pdfs/guide.pdf"
                target="_blank"
                className="hover:underline"
                rel="noopener noreferrer"
              >
                システム案内資料
              </a>
            </li>
            <li className="flex items-center justify-start gap-2 pl-4">
              <span>💴</span>
              <a
                href="/pdfs/pricing.pdf"
                target="_blank"
                className="hover:underline"
                rel="noopener noreferrer"
              >
                料金表
              </a>
            </li>
            <li className="text-left font-bold text-white text-sm border-t border-white pt-4 pl-4">
              会計管理
            </li>
            <li className="flex items-center justify-start gap-2 pl-4">
              <span>💰</span>
              <Link to="/master/payment" className="hover:underline">
                支払管理
              </Link>
            </li>
            <li className="mt-8 border-t border-white pt-4">
              <div className="text-left font-bold text-white text-sm mb-2">
                会社設定
              </div>
              <div className="flex items-center justify-start gap-2 pl-4">
                <span>⚙️</span>
                <Link to="/master/settings" className="hover:underline">
                  画面構成の設定
                </Link>
              </div>
              <div className="flex items-center justify-start gap-2 pl-4 mt-2">
                <span>🔑</span>
                <Link to="/master/password" className="hover:underline">
                  パスワード変更
                </Link>
              </div>
            </li>
          </ul>
        </aside>

        {/* 🔄 ここだけルートに応じて切り替え */}
        <main className="flex-1 bg-gray-100 p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/master/customers" replace />} />
            <Route path="/customers" element={<CustomerTable />} />
            <Route path="/password" element={<MasterPasswordChange />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
