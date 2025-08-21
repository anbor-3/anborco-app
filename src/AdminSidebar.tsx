import { Link, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Users,
  User,
  Truck,
  MapPin,
  Bell,
  Folder,
  Settings,
  MessageCircle,
  Clock,
  ClipboardCheck,
  ShieldCheck,
  Package
} from 'lucide-react';

export default function Sidebar({ hasUnreadChat = false }) {
  const location = useLocation();

  const menuItems = [
  { path: '/admin/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { path: '/admin/daily-report', label: '日報管理', icon: FileText },
  { path: '/admin/admin-manager', label: '管理者管理', icon: User },
  { path: '/admin/drivers', label: 'ドライバー管理', icon: Users },
  { path: '/admin/vehicles', label: '車両管理', icon: Truck },
  { path: '/admin/projects', label: '案件一覧', icon: ClipboardCheck },
  { path: '/admin/map', label: 'ドライバー位置情報マップ', icon: MapPin },
  { path: '/admin/shift-register', label: 'シフト登録', icon: ClipboardCheck },
  { path: '/admin/notifications', label: '通知一覧', icon: Bell },
  { path: '/admin/files', label: 'ファイル管理', icon: Folder },
  { path: '/admin/system-settings', label: 'システム設定', icon: Settings },
  { path: '/admin/chat', label: 'チャット', icon: MessageCircle, unread: hasUnreadChat },
  { path: '/admin/driver-payment',label: '支払集計', icon: FileText},
  { path: '/admin/todo', label: '法改正対応ToDo', icon: ClipboardCheck },
  { path: '/admin/security', label: 'セキュリティ・契約', icon: ShieldCheck },
  { path: '/admin/plan', label: 'プラン変更', icon: Package },
  { path: '/admin/password-change', label: 'パスワード変更', icon: Lock },
];

  return (
    <aside className="w-64 bg-[#2f3e46] text-white min-h-screen p-4">
      <div className="text-xl font-bold mb-6 tracking-wide text-center">メニュー</div>
      <nav className="space-y-2">
        {menuItems.map(({ path, label, icon: Icon, unread }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center space-x-2 px-4 py-2 rounded hover:bg-green-700 transition ${
              location.pathname === path ? 'bg-green-700' : ''
            }`}
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {unread && location.pathname !== path && <span className="text-red-500 text-xs ml-auto">●</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
