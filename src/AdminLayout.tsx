
import React from 'react';
import AdminSidebar from './Sidebar';
import AdminNotifications from './NotificationList';

export default function Layout({ children }) {
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* ヘッダー */}
      <header className="w-full flex items-center justify-between px-6 py-4 shadow bg-[#1e293b] text-white h-16 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center space-x-4">
          <img src="/logo.png" alt="アンボルコ ロゴ" className="h-10" />
          <div>
            <div className="text-xs text-gray-300">株式会社アンボルコ</div>
            <div className="text-base font-semibold">佐藤 太郎</div>
          </div>
        </div>
        
        
        <div className="flex items-center gap-4"><AdminNotifications /></div>
        <button className="text-sm text-white bg-red-500 px-4 py-1 rounded hover:bg-red-600">ログアウト</button>
      </header>

      <div className="flex flex-1 pt-16">
        <AdminSidebar />
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          {children}
        </main>
      </div>

      
    </div>
  );
}
