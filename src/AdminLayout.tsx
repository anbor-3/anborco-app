import React, { PropsWithChildren, useMemo } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminNotifications from "./pages/AdminNotificationList";

type LayoutProps = PropsWithChildren<{}>;

export default function Layout({ children }: LayoutProps) {
  // ✅ JSX の外で currentUser を読み出す
  const cur = useMemo(() => {
    if (typeof window === "undefined") return null; // SSR 安全策（SPAなら実質無視）
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch {
      return null;
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ヘッダー */}
      <header className="w-full flex items-center justify-between px-6 py-4 shadow bg-[#1e293b] text-white h-16 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center space-x-4">
          <img src="/logo.png" alt="アンボルコ ロゴ" className="h-10" />
          <div className="leading-tight">
            <div className="text-xs text-gray-300">株式会社アンボルコ</div>
            <div className="text-base font-semibold">
              {cur?.name || "管理者"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <AdminNotifications />
          <button
            className="text-sm text-white bg-red-500 px-4 py-1 rounded hover:bg-red-600"
            onClick={() => {
              // 任意: ログアウト処理の雛形
              localStorage.removeItem("currentUser");
              localStorage.removeItem("company");
              location.href = "/"; // ルートへ戻す
            }}
          >
            ログアウト
          </button>
        </div>
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
