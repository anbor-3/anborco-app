import { useEffect, useState } from "react";
import { nanoid } from "nanoid";

type FormState = {
  name: string;
  company: string;
  driverId: string;
  password: string;
  autoGenerate: boolean;
};

const AdminCreateDriver = () => {
  const [form, setForm] = useState<FormState>({
    name: "",
    company: "",
    driverId: "",
    password: "",
    autoGenerate: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generateCredentials = () => {
    const id = `drv_${nanoid(6)}`;        // 例）drv_ab12cd
    const pw = nanoid(12);                // 12桁強め
    setForm((prev) => ({ ...prev, driverId: id, password: pw }));
  };

  useEffect(() => {
    // 初回 or チェックON時に自動発番
    if (form.autoGenerate && (!form.driverId || !form.password)) {
      generateCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.autoGenerate]);

  // 会社名を自動入力しておく（連続登録が楽）
useEffect(() => {
  const cur = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const c1 = localStorage.getItem("company") || "";
  const autoCompany = (cur?.company || c1 || "").trim();
  if (autoCompany) {
    setForm(prev => ({ ...prev, company: prev.company || autoCompany }));
  }
}, []);

  const validate = () => {
    if (!form.name.trim()) return "氏名を入力してください";
    if (!form.company.trim()) return "会社名を入力してください";
    if (!form.driverId.trim()) return "ログインIDを入力してください";
    if (!/^[a-zA-Z0-9_\-]{4,32}$/.test(form.driverId))
      return "ログインIDは英数・-_ で4〜32文字にしてください";
    if (!form.password.trim()) return "パスワードを入力してください";
    if (form.password.length < 8) return "パスワードは8文字以上にしてください";
    return null;
  };

  const handleSubmit = async () => {
    if (loading) return; // ← 追加（多重クリック防止）
    setError(null);
    setSuccess(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      // 本番：HTTPS 経由で自社APIへ送信（サーバ側でハッシュ化＆重複チェック）
      const res = await fetch("/api/drivers/save", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // ← 認証クッキー送信（必須なら）
  body: JSON.stringify({
    id: form.driverId.trim(),
    name: form.name.trim(),
    company: form.company.trim(),
    password: form.password, // ハッシュ化はサーバ側
  }),
});

      if (!res.ok) {
   let message = `登録に失敗しました（${res.status}）`;
   try {
     const data = await res.json();
     message = data?.message || message;
   } catch {
     try { message = await res.text(); } catch {}
   }
   throw new Error(message);
 }

      setSuccess("ドライバー登録が完了しました");
window.dispatchEvent(new Event('drivers:changed'));

// 次回登録用に新しいID/パスワードを即座に発番
setForm(prev => ({
  name: "",
  company: prev.company,               // ← 残す
  driverId: `drv_${nanoid(6)}`,
  password: nanoid(12),
  autoGenerate: true,
}));
    } catch (e: any) {
      setError(e.message ?? "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">👤 ドライバー登録</h1>

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded bg-green-50 text-green-700 text-sm">{success}</div>
      )}

      <label className="block space-y-1">
  <span className="text-sm text-gray-600">氏名</span>
  <input
    className="border p-2 w-full rounded"
    placeholder="例）佐藤 和真"
    value={form.name}
    onChange={(e) => setForm({ ...form, name: e.target.value })}
    required
    autoComplete="name"
  />
</label>

      <label className="block space-y-1">
  <span className="text-sm text-gray-600">会社名</span>
  <input
    className="border p-2 w-full rounded"
    placeholder="例）株式会社トライ物流"
    value={form.company}
    onChange={(e) => setForm({ ...form, company: e.target.value })}
    required
    autoComplete="organization"
  />
</label>

      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={form.autoGenerate}
          onChange={(e) => {
            const auto = e.target.checked;
            setForm((prev) => ({ ...prev, autoGenerate: auto }));
            if (auto) generateCredentials();
          }}
        />
        <span>ID/パスワードを自動発番する</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-gray-600">ログインID</span>
        <input
  className="border p-2 w-full rounded"
  placeholder="例）drv_ab12cd"
  value={form.driverId}
  name="username"
  readOnly={form.autoGenerate}
  autoComplete="username"                 // ← off → username に
  pattern="[A-Za-z0-9_-]{4,32}"
  title="英数字と - _ のみ、4〜32文字"
  onChange={(e) => setForm({ ...form, driverId: e.target.value })}
  required
/>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-gray-600">パスワード</span>
        <input
  type="password"
  className="border p-2 w-full rounded"
  placeholder="8文字以上"
  value={form.password}
  name="new-password"
  readOnly={form.autoGenerate}
  autoComplete="new-password"
  minLength={8}
  onChange={(e) => setForm({ ...form, password: e.target.value })}
  required
/>
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={generateCredentials}
          className="px-3 py-2 bg-gray-200 rounded"
          disabled={loading}
        >
          自動生成
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded shadow disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "登録中..." : "登録する"}
        </button>
      </div>
    </div>
  );
};

export default AdminCreateDriver;
