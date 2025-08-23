// 強制反映：SWの解除＋Cache削除 → リロード（1回だけ）
export async function hardRefreshOnce() {
  try {
    // 1) Service Worker を全解除
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    // 2) Cache API を全削除
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn("[hardRefreshOnce] cleanup failed", e);
  }

  // 3) 1回だけ実行するためセッションフラグ
  sessionStorage.setItem("__hard_refreshed__", "1");

  // 4) キャッシュバスター付きでリロード
  const u = new URL(window.location.href);
  u.searchParams.set("__bust", String(Date.now()));
  window.location.replace(u.toString());
}
