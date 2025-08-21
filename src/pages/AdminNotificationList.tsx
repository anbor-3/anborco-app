"use client";
import  { useEffect, useState } from "react";

// ✅ APIの基点（basePathとは切り離す）
// - NEXT_PUBLIC_API_BASE_URL があればそれを使う（例: https://api.anbor.co.jp）
// - 無ければ同一オリジンの /api を使う
const API_BASE_URL =
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_API_BASE_URL)
    ? String((process as any).env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "")
    : "";

const api = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

// ユーティリティ
const toMs = (s?: string) => (s ? new Date(s).getTime() : 0);

// JSTで短い日付表示
const fmtJST = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(d);
};

// ★ 追加: JSON専用フェッチ（HTMLが返ってきたら本文先頭をエラー表示）
async function safeFetchJSON(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text(); // 先にテキストで読む（jsonに失敗したとき中身を出せる）

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} : ${body.slice(0, 200)}`);
  }
  if (!/application\/(problem\+)?json/i.test(ct)) {
    throw new Error(`非JSON応答（content-type: ${ct || "unknown"}）: ${body.slice(0, 200)}`);
  }
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error(`JSONパース失敗: ${String(e)} : ${body.slice(0, 200)}`);
  }
}

// 通知の型定義
interface Notification {
  id: string; // UUID（サーバ発行）
  type: "warning" | "report" | "shift";
  category: string;
  message: string;
  target: string | null;
  createdAt: string; // ISO
  read: boolean;
}

// ✅ 色分類ロジック
const getColorClass = (type: Notification["type"]) => {
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

// ★ 追加：localStorage JSONが壊れていても落ちないようにする
const safeParse = <T,>(s: string | null, fallback: T): T => {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
};

const getMatchedTarget = (message: string): string => {
  const drivers = safeParse<any[]>(localStorage.getItem("driverList"), []);
  const vehicles = safeParse<any[]>(localStorage.getItem("vehicleList"), []);
  const normalizedMsg = normalize(message);

  for (const d of drivers) {
    if (d?.name && normalizedMsg.includes(normalize(String(d.name)))) {
      return d.name;
    }
  }

  for (const v of vehicles) {
    if (v?.number && normalizedMsg.includes(normalize(String(v.number)))) {
      return v.number;
    }
  }

  return "対象不明";
};

const AdminNotificationList = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 未読件数
  const unreadCount = notifications.filter(n => !n.read).length;

  // 一覧取得（共通化＆日付降順）
  const reload = async (ac?: AbortController) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(api("/api/notifications"), {
  credentials: "include",
  signal: ac?.signal,
  headers: { Accept: "application/json" },
});

// 404 → “通知なし”として扱う（赤いエラーは出さない）
if (res.status === 404) {
  setNotifications([]);
  return;
}
if (!res.ok) {
  throw new Error(`HTTP ${res.status}`);
}

const data: Notification[] = await res.json();
data.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
setNotifications(data);

    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        setError(e?.message || "通知の取得に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  // 初回取得 + 15秒ポーリング
  useEffect(() => {
    const ac = new AbortController();
    reload(ac);
    const timer = setInterval(() => reload(), 15_000);
    return () => { ac.abort(); clearInterval(timer); };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(api(`/api/notifications/${id}/read`), {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error();
      await reload(); // 即時反映
    } catch {
      alert("既読に失敗しました");
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(api(`/api/notifications/${id}`), {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error();
      await reload(); // 即時反映
    } catch {
      alert("削除に失敗しました");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-3">
        📢 通知一覧 <span className="text-base text-gray-600">-Notification List-</span>
        {/* 未読バッジ */}
        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-2 py-0.5">
          未読 {unreadCount}
        </span>
        {/* 手動再読込 */}
        <button
          onClick={() => reload()}
          className="ml-auto text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
        >
          再読込
        </button>
      </h1>

      {loading && <div className="mb-3 text-gray-600">読み込み中...</div>}
      {error && <div className="mb-3 text-red-600">{error}</div>}

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
          {!loading && notifications.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-500">
                通知はありません。
              </td>
            </tr>
          ) : (
            notifications.map((n) => (
              <tr
                key={n.id}
                className={`${n.read ? "bg-gray-100" : "bg-yellow-50 font-bold"} hover:bg-gray-200`}
              >
                <td className="border px-3 py-2 text-center">{n.category}</td>
                <td className="border px-3 py-2 text-right font-medium text-gray-800">
                  {n.target && n.target !== "対象不明" ? n.target : getMatchedTarget(n.message)}
                </td>
                <td className={`border px-3 py-2 text-right ${getColorClass(n.type)}`}>{n.message}</td>
                <td className="border px-3 py-2 text-sm text-gray-600 text-right">
                  {fmtJST(n.createdAt)}
                </td>
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
