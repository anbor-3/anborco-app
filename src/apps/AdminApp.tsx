// src/admin/App.tsx（ファイルパスはあなたの構成に合わせて）
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
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
import { Bell, Menu, X } from 'lucide-react';
import AdminManager from '../pages/AdminManager';
import AdminPasswordChange from '../pages/AdminPasswordChange';
import SecurityContract from '../pages/SecurityContract';
import AdminPlanChange from '../AdminPlanChange';
import { useEffect, useMemo, useState } from 'react';
import NeonBrushLogo from '../components/NeonBrushLogo';

function useOrgInfo() {
  return useMemo(() => {
    let companyName = '会社未設定';
    let registrant = '未ログイン';

    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      companyName = user?.company || companyName;
      registrant = user?.name || registrant;
    } catch {}

    return { companyName, registrant };
  }, []);
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/admin/login';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { companyName, registrant } = useOrgInfo();

  let hasUnread = false;
  try {
    const groups = JSON.parse(localStorage.getItem('groups') || '[]');
    if (Array.isArray(groups)) {
      hasUnread = groups.some((g) => g.unreadBy && g.unreadBy.includes('admin'));
    }
  } catch (e) {
    console.error('localStorage groups 読み込みエラー:', e);
  }

  useEffect(() => {
    // サイドバーはページ遷移時に閉じておく（SP）
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen text-slate-100 overflow-hidden">
      {/* === 背景（ログインと同系のダーク×ネオン） === */}
      {!isLoginPage && (
        <>
          <div aria-hidden className="absolute inset-0 bg-[#0b1220] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
          <div aria-hidden className="absolute inset-0 bg-white/[0.06] backdrop-blur-[2px]" />
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-teal-400/25 blur-3xl" />
            <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          </div>

          {/* === 白枠（ヘッダー/サイドバーを避ける） === */}
          <div
            aria-hidden
            className="pointer-events-none fixed top-16 left-0 md:left-[240px] right-0 bottom-0
                       px-3 sm:px-5 lg:px-8 xl:px-12 z-10"
          >
            <div className="h-full w-full rounded-[28px] ring-8 ring-white/35 ring-inset" />
          </div>
        </>
      )}

      {/* === ヘッダー（ロゴ最左 / 右端に会社名・登録者名・ログアウト） === */}
{!isLoginPage && (
  <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-slate-900/70 backdrop-blur border-b border-white/10">
    {/* ★ フル幅（max-width / mx-auto を撤去） */}
    <div className="h-full w-full flex items-center">
      {/* 左：ロゴ最左、SPのみメニュー */}
      <div className="flex items-center gap-3 pl-2">
        <NeonBrushLogo text="Anborco" className="h-10 md:h-11 w-auto" />
        <button
          className="inline-flex items-center justify-center rounded-lg p-2 md:hidden hover:bg-white/10"
          aria-label="メニュー"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* 右：通知 / 会社名 / 登録者 / ログアウト —— 画面最右に吸着 */}
      <div className="ml-auto flex items-center gap-3 sm:gap-4 pr-2">
        <button className="text-white/90 hover:text-yellow-300" aria-label="通知">
          <Bell size={20} />
        </button>
        <div
          className="hidden sm:block px-2 py-1 rounded text-xs sm:text-sm font-bold text-white/90 bg-white/10 border border-white/20 max-w-[40vw] truncate"
          title={`${companyName} / ${registrant}`}
        >
          {companyName} / {registrant}
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('loggedInAdmin');
            localStorage.removeItem('currentUser');
            navigate('/');
          }}
          className="text-sm text-white bg-red-500 px-3 sm:px-4 py-1 rounded hover:bg-red-600"
        >
          ログアウト
        </button>
      </div>
    </div>
  </header>
)}

      {/* === レイアウト（ヘッダーにかぶらない / サイドバー固定） === */}
      <div className={!isLoginPage ? 'pt-16 relative z-20' : ''}>
        {/* SPでサイドバー開いた時のオーバーレイ */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* サイドバー：top-16 から下をぴったり、md以上常時表示 */}
        {!isLoginPage && (
          <aside
            className={[
              'fixed z-30 top-16 left-0 h-[calc(100vh-64px)] w-[240px] transform transition-transform duration-200',
              'bg-white/5 border-r border-white/10 backdrop-blur-xl shadow-2xl',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full',
              'md:translate-x-0',
            ].join(' ')}
          >
            {/* SP：クローズボタン */}
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

            <div id="admin-sidebar-container" className="h-[calc(100%-52px)] md:h-full overflow-y-auto">
              <AdminSidebar hasUnreadChat={hasUnread} />
            </div>
          </aside>
        )}

        {/* === メイン：白枠と同じ inset で固定配置（枠の内側にピッタリ） === */}
        <main
  className={[
    !isLoginPage
      ? 'fixed top-16 left-0 md:left-[240px] right-0 bottom-0 px-3 sm:px-5 lg:px-8 xl:px-12 py-3 z-20'
      : 'relative',
  ].join(' ')}
>
  {/* 枠内ボックス：白枠の内側に 1% 余白（左右上下） */}
  {!isLoginPage ? (
    <div className="h-[99%] w-[99%] mx-auto my-auto rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="h-full w-full overflow-auto p-4 sm:p-6 md:p-8">
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
                  <Route path="projects" element={<AdminProjectList />} />
                  <Route path="map" element={<AdminLiveMap />} />
                  <Route path="files" element={<AdminFileManager />} />
                  <Route path="driver-payment" element={<DriverPaymentSummary />} />
                  <Route path="todo" element={<AdminTodoTasks />} />
                  <Route path="system-settings" element={<AdminSystemSettings />} />
                  <Route path="password-change" element={<AdminPasswordChange />} />
                  <Route path="security" element={<SecurityContract />} />
                  <Route path="plan" element={<AdminPlanChange />} />
                  <Route path="*" element={<Navigate to="dashboard" />} />
                </Routes>
              </div>
            </div>
          ) : (
            // ログインページ用：通常フロー（お好みで）
            <div className="p-4">
              <Routes>
                <Route path="*" element={<Navigate to="/admin/login" />} />
              </Routes>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function AdminApp() {
  return <AppLayout />;
}
