import React, { useState } from "react";
import { provisionCustomer, deleteCustomerByEmail, fixClaims } from "../utils/masterV2";

export default function CustomerTableV2() {
  const [company, setCompany] = useState("DEMO_CO");
  const [loginId, setLoginId] = useState("");
  const [created, setCreated] = useState<{email:string;password:string}|null>(null);

  const [delEmail, setDelEmail] = useState("");
  const [fixEmail, setFixEmail] = useState("");
  const [fixCompany, setFixCompany] = useState("DEMO_CO");

  return (
    <div className="space-y-8">
      {/* 顧客作成 */}
      <section className="rounded-lg border p-4 bg-white">
        <h2 className="font-bold mb-3">顧客（管理者）を作成（会社付き / v2）</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600">会社名</label>
            <input className="border rounded px-2 py-1" value={company} onChange={e=>setCompany(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">ログインID</label>
            <input className="border rounded px-2 py-1" placeholder="admin001 など" value={loginId} onChange={e=>setLoginId(e.target.value)} />
          </div>
          <button
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1"
            onClick={async () => {
              if (!company.trim() || !loginId.trim()) return alert("会社名とログインIDを入力してください");
              try {
                const r = await provisionCustomer(company.trim(), loginId.trim());
                setCreated({ email: r.email, password: r.password });
                alert(`作成OK\nemail: ${r.email}\npassword: ${r.password}`);
              } catch (e:any) {
                console.error(e);
                alert("作成に失敗しました。コンソールを確認してください。");
              }
            }}
          >
            作成
          </button>
        </div>

        {created && (
          <div className="mt-3 text-sm">
            <div>発行メール: <code>{created.email}</code></div>
            <div>初期パスワード: <code>{created.password}</code></div>
            <div className="text-xs text-gray-600 mt-1">※ 初回ログインでパスワード変更を推奨</div>
          </div>
        )}
      </section>

      {/* 顧客削除 */}
      <section className="rounded-lg border p-4 bg-white">
        <h2 className="font-bold mb-3">顧客を削除（再ログイン不可 / v2）</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600">メール（削除対象）</label>
            <input className="border rounded px-2 py-1 w-80" placeholder="xxx@anborco.jp" value={delEmail} onChange={e=>setDelEmail(e.target.value)} />
          </div>
          <button
            className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-1"
            onClick={async ()=>{
              if (!delEmail.trim()) return alert("メールを入力してください");
              if (!confirm(`${delEmail} を完全削除します。よろしいですか？`)) return;
              try {
                await deleteCustomerByEmail(delEmail.trim());
                alert("削除しました（同じ資格情報では再ログインできません）");
              } catch (e) {
                console.error(e);
                alert("削除に失敗しました。コンソールを確認してください。");
              }
            }}
          >
            削除
          </button>
        </div>
      </section>

      {/* 会社未設定ユーザーの救済 */}
      <section className="rounded-lg border p-4 bg-white">
        <h2 className="font-bold mb-3">会社未設定ユーザーを修復（claims付与 / v2）</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600">メール</label>
            <input className="border rounded px-2 py-1 w-80" value={fixEmail} onChange={e=>setFixEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">会社名</label>
            <input className="border rounded px-2 py-1" value={fixCompany} onChange={e=>setFixCompany(e.target.value)} />
          </div>
          <button
            className="bg-sky-600 hover:bg-sky-700 text-white rounded px-3 py-1"
            onClick={async ()=>{
              if (!fixEmail.trim() || !fixCompany.trim()) return alert("メールと会社名を入力してください");
              try {
                await fixClaims(fixEmail.trim(), fixCompany.trim(), "admin");
                alert("修復しました。対象ユーザーは再ログインして company/role を取り込みます。");
              } catch (e) {
                console.error(e);
                alert("修復に失敗しました。メールが存在するか確認してください。");
              }
            }}
          >
            修復
          </button>
        </div>
      </section>
    </div>
  );
}
