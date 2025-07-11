import React, { useEffect, useState } from "react";

// 通知の型定義
interface Notification {
  id: number;
  type: "warning" | "report" | "shift";
  category: string;
  message: string;
  target: string;
  timestamp: string;
  read: boolean;
}

// ✅ 色分類ロジック
const getColorClass = (type: string) => {
  switch (type) {
    case "warning":
      return "text-red-500 font-semibold";
    case "report":
      return "text-blue-500 font-semibold";
    case "shift":
      return "text-yellow-500 font-semibold";
    default:
      return "text-gray-600";
  }
};

// ✅ 対象の自動判定（ドライバー・車両）
const normalize = (str: string) => str.replace(/\s+/g, "").replace(/　/g, "");

const getMatchedTarget = (message: string): string => {
  const drivers = JSON.parse(localStorage.getItem("driverList") || "[]");
  const vehicles = JSON.parse(localStorage.getItem("vehicleList") || "[]");
  const normalizedMsg = normalize(message);

  for (const d of drivers) {
    if (d.name && normalizedMsg.includes(normalize(d.name))) {
      return d.name;
    }
  }

  for (const v of vehicles) {
    if (v.number && normalizedMsg.includes(normalize(v.number))) {
      return v.number;
    }
  }

  return "対象不明";
};

const AdminNotificationList = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
  // ✅ 1. 先に driverList / vehicleList をセットしておく
  if (!localStorage.getItem("driverList")) {
    localStorage.setItem("driverList", JSON.stringify([
      { id: "driver001", name: "佐藤太郎" },
      { id: "driver002", name: "鈴木花子" }
    ]));
  }

  if (!localStorage.getItem("vehicleList")) {
    localStorage.setItem("vehicleList", JSON.stringify([
      { id: "vehicle001", number: "品川 500 あ 12-34" },
      { id: "vehicle002", number: "多摩 300 い 45-67" }
    ]));
  }

  // ✅ 2. 通知の読み込みと免許証期限通知の両方を必ず行うように整理
const saved = localStorage.getItem("adminNotifications");
let currentNotifications: Notification[] = [];

if (saved) {
  currentNotifications = JSON.parse(saved).map((n: any) => ({
    ...n,
    target: n.target || getMatchedTarget(n.message),
  }));
} else {
  // 初期通知（初回だけ）
  currentNotifications = [
    {
      id: 1,
      type: "report",
      category: "日報提出",
      message: "佐藤太郎さんが6/17の日報を提出しました",
      target: "",
      timestamp: new Date().toLocaleString("ja-JP"),
      read: false,
    },
    {
      id: 2,
      type: "warning",
      category: "免許証期限警告",
      message: "鈴木花子さんの免許証が期限切れ間近です",
      target: "",
      timestamp: new Date().toLocaleString("ja-JP"),
      read: false,
    },
    {
      id: 3,
      type: "warning",
      category: "車検期限警告",
      message: "品川 500 あ 12-34 の車検がまもなく切れます",
      target: "",
      timestamp: new Date().toLocaleString("ja-JP"),
      read: true,
    },
  ].map(n => ({
    ...n,
    target: getMatchedTarget(n.message),
  }));
}

// 🔧 有効期限通知対象日
const notifyDays = [30, 20, 10, 5, 4, 3, 2, 1, 0];

// 🧑‍ Driver一覧を取得
const drivers = JSON.parse(localStorage.getItem("driverList") || "[]");
const today = new Date();

// 🔁 各ドライバーの免許証期限をチェック
drivers.forEach((driver: any) => {
  if (!driver.licenseExpiry) return;

  const expiryDate = new Date(driver.licenseExpiry);
  const diffDays = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (notifyDays.includes(diffDays)) {
    const message = `${driver.name}さんの免許証があと${diffDays === 0 ? '本日' : diffDays + '日'}で期限切れです`;

    const alreadyExists = currentNotifications.some((n: any) => n.message === message);

    if (!alreadyExists) {
      const newNotification: Notification = {
        id: Date.now(), // ユニークID（タイムスタンプ）
        type: "warning",
        category: "免許証期限警告",
        message,
        target: driver.name,
        timestamp: new Date().toLocaleString("ja-JP"),
        read: false,
      };

      currentNotifications.push(newNotification);
    }
  }
});
// ✅ 最終保存・反映
setNotifications(currentNotifications);
localStorage.setItem("adminNotifications", JSON.stringify(currentNotifications));
}, []);

  const markAsRead = (id: number) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    localStorage.setItem("adminNotifications", JSON.stringify(updated));
  };

  const deleteNotification = (id: number) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    localStorage.setItem("adminNotifications", JSON.stringify(updated));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
  📢 通知一覧 <span className="text-base text-gray-600">-Notification List-</span>
</h1>
      <table className="w-full table-fixed border border-gray-300 shadow rounded-lg overflow-hidden text-right">
        <thead>
          <tr className="bg-blue-200 text-gray-800 text-sm font-semibold border border-gray-300">
            <th className="px-3 py-2 border w-[12%] text-center">通知種別</th>
            <th className="px-3 py-2 border w-[20%] text-center">対象</th>
            <th className="px-3 py-2 border w-[35%] text-center">内容</th>
            <th className="px-3 py-2 border w-[18%] text-center">日付</th>
            <th className="px-3 py-2 border w-[15%] text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          {notifications.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-500">
                通知はありません。
              </td>
            </tr>
          ) : (
            notifications.map((n) => (
              <tr
                key={n.id}
                className={`${
                  n.read ? "bg-gray-100" : "bg-yellow-50 font-bold"
                } hover:bg-gray-200`}
              >
                <td className="border px-3 py-2 text-center">{n.category}</td>
                <td className="border px-3 py-2 text-right font-medium text-gray-800">
  {n.target && n.target !== "対象不明" ? n.target : "（不明）"}
</td>
                <td className={`border px-3 py-2 text-right ${getColorClass(n.type)}`}>{n.message}</td>
                <td className="border px-3 py-2 text-sm text-gray-600 text-right">{n.timestamp}</td>
                <td className="border px-3 py-2 space-x-2 text-right">
                  {!n.read && (
                    <button
                      className="text-blue-600 underline text-sm"
                      onClick={() => markAsRead(n.id)}
                    >
                      既読にする
                    </button>
                  )}
                  <button
                    className="text-red-600 underline text-sm"
                    onClick={() => deleteNotification(n.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminNotificationList;
