import { Routes, Route, Link, useLocation } from "react-router-dom";
import { FileText, Clock, User, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DriverDashboard from "../pages/DriverDashboard";
import DriverProfile from "../pages/DriverProfile";
import DriverProjectList from "../pages/DriverProjectList";
import DriverWorkHistory from "../pages/DriverWorkHistory";
import DriverDocumentUpload from "../pages/DriverDocumentUpload";
import DriverPasswordChange from "../pages/DriverPasswordChange";
import DriverPaymentPreview from "../pages/DriverPaymentPreview";
import DriverInvoiceCreator from "../pages/DriverInvoiceCreator";
import DriverChatPage from "../pages/DriverChatPage";

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("loggedInDriver");
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  return (
    <div className="w-full driver-container flex flex-col min-h-screen bg-white">
      {/* ✅ ヘッダー */}
      <header className="bg-orange-300 flex justify-between items-center px-6 py-3 shadow fixed top-0 left-0 right-0 h-16 z-10">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="ロゴ" className="h-10" />
          <div className="px-2 py-1 rounded text-sm font-bold text-black bg-white border border-white">
            {(() => {
              const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
              const company = user.company ?? "会社未設定";
              const name = user.name ?? "名無し";
              return `${company} / ${name}`;
            })()}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleLogout} className="text-red-600 font-bold">
            ログアウト
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ✅ サイドバー */}
        <aside className="w-64 bg-orange-100 p-4 shadow-md flex flex-col justify-between fixed top-16 left-0 h-[calc(100vh-64px)] z-10">
          <div>
            <div className="text-sm font-bold mb-2 text-left text-black">メニュー</div>
            <hr className="border-orange-400 mb-4" />
            <nav className="flex flex-col space-y-6 text-center text-black">
              <Link to="daily-report" className="flex items-center justify-center gap-2 hover:underline">
                <FileText className="text-blue-500" size={18} />
                日報提出
              </Link>
              <Link to="chat" className="flex items-center justify-center gap-2 hover:underline">
                <FileText className="text-blue-400" size={18} />
                チャット
              </Link>
              <Link to="history" className="flex items-center justify-center gap-2 hover:underline">
                <Clock className="text-purple-500" size={18} />
                稼働履歴
              </Link>
              <Link to="profile" className="flex items-center justify-center gap-2 hover:underline">
                <User className="text-green-500" size={18} />
                プロフィール
              </Link>
              <Link to="projects" className="flex items-center justify-center gap-2 hover:underline">
                <Truck className="text-yellow-600" size={18} />
                案件一覧
              </Link>
              <Link to="submit-documents" className="flex items-center justify-center gap-2 hover:underline">
                <FileText className="text-pink-500" size={18} />
                書類提出
              </Link>
              <Link to="change-password" className="flex items-center justify-center gap-2 hover:underline">
                <User className="text-red-500" size={18} />
                パスワード変更
              </Link>
            </nav>
          </div>
        </aside>

        {/* ✅ メイン */}
        <main className="flex-1 bg-orange-50 p-6 ml-64 mt-16 overflow-y-auto overflow-x-auto" style={{ minWidth: "1040px" }}>
          <Routes>
            <Route path="/" element={<DriverDashboard />} />
            <Route path="daily-report" element={<DriverDashboard />} />
            <Route path="history" element={<DriverWorkHistory />} />
            <Route path="profile" element={<DriverProfile />} />
            <Route path="projects" element={<DriverProjectList />} />
            <Route path="submit-documents" element={<DriverDocumentUpload />} />
            <Route path="change-password" element={<DriverPasswordChange />} />
            <Route path="/driver/payment/:year/:month" element={<DriverPaymentPreview />} />
            <Route path="invoice" element={<DriverInvoiceCreator />} />
            <Route path="chat" element={<DriverChatPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;
