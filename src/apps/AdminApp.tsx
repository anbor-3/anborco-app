import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import DriverPaymentSummary from '../pages/DriverPaymentSummary';
import AdminShiftRegister from '../pages/AdminShiftRegister';
import AdminNotificationList from '../pages/AdminNotificationList';
import Chat from '../components/ChatBox';
import AdminProjectList from '../AdminProjectList';
import AdminSidebar from '../AdminSidebar';
import AdminDashboard from '../AdminDashboard';
import AdminDailyReport from '../AdminDailyReport';
import AdminDriverManager from '../AdminDriverManager';
import AdminVehicleManager from '../AdminVehicleManager';
import AdminLiveMap from '../AdminLiveMap';
import AdminFileManager from '../AdminFileManager';
import AdminTodoTasks from '../AdminToDoTasks';
import AdminSystemSettings from '../AdminSystemSettings';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminManager from '../pages/AdminManager';
import AdminPasswordChange from '../pages/AdminPasswordChange';
import SecurityContract from '../pages/SecurityContract';

function AppLayout() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/admin/login';
  const navigate = useNavigate();

  let hasUnread = false;
  try {
    const groups = JSON.parse(localStorage.getItem('groups') || '[]');
    if (Array.isArray(groups)) {
      hasUnread = groups.some(g => g.unreadBy && g.unreadBy.includes('admin'));
    }
  } catch (e) {
    console.error('localStorage groups 読み込みエラー:', e);
  }

  return (
    <div className="w-full max-w-[1280px] mx-auto bg-white">
      {/* ✅ 完全固定幅コンテナ */}
      <div className="min-h-screen flex flex-col">
        {!isLoginPage && (
          <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-[#1e293b] text-white shadow px-6 py-3 h-16">
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="アンボルコ ロゴ" className="h-12 w-auto object-contain" />
              <div className="flex flex-col">
                {(() => {
                  const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
                  const company = user.company ?? "会社未設定";
                  const name = user.name ?? "名無し";
                  return (
                    <>
                      <span className="text-xs text-gray-300">{company}</span>
                      <span className="text-base font-semibold text-white">{name}</span>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-white hover:text-yellow-300">
                <Bell size={20} />
              </button>
              <button
                className="text-sm text-white bg-red-500 px-4 py-1 rounded hover:bg-red-600"
                onClick={() => {
                  localStorage.removeItem('loggedInAdmin');
                  localStorage.removeItem('currentUser');
                  navigate('/');
                }}
              >
                ログアウト
              </button>
            </div>
          </header>
        )}

        <div className="flex">
          {!isLoginPage && (
            <div className="fixed top-16 left-0 h-[calc(100vh-4rem)] z-50">
              <AdminSidebar hasUnreadChat={hasUnread} />
            </div>
          )}
          <main
  className={`bg-[#f1f5f9] p-4 md:p-6 overflow-x-auto overflow-y-auto z-10 ${
    !isLoginPage ? 'ml-[240px] mt-16' : ''
  } w-full`}
>
            <Routes>
              <Route path="/" element={<Navigate to="dashboard" />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="shift-register" element={<AdminShiftRegister />} />
              <Route path="admin-manager" element={<AdminManager />} />
              <Route path="notifications" element={<AdminNotificationList />} />
              <Route path="chat" element={<Chat />} />
              <Route path="daily-report" element={<AdminDailyReport />} />
              <Route path="drivers" element={<AdminDriverManager />} />
              <Route path="vehicles" element={<AdminVehicleManager />} />
              <Route path="project-list" element={<AdminProjectList />} />
              <Route path="projects" element={<AdminProjectList />} />
              <Route path="map" element={<AdminLiveMap />} />
              <Route path="files" element={<AdminFileManager />} />
              <Route path="/admin/driver-payment" element={<DriverPaymentSummary />} />
              <Route path="todo" element={<AdminTodoTasks />} />
              <Route path="system-settings" element={<AdminSystemSettings />} />
              <Route path="password-change" element={<AdminPasswordChange />} />
              <Route path="security" element={<SecurityContract />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  return <AppLayout />;
}
