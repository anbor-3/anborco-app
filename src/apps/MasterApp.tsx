// src/master/App.tsx
import { Link, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { CheckCircle, Minus, Menu, X } from "lucide-react";
import CustomerTable from "../pages/CustomerTable";
import MasterPasswordChange from "../pages/MasterPasswordChange";
import { PLAN_FEATURES } from "../features";

// ★ 追加：ネオンロゴ（パスはあなたの配置に合わせて）
import NeonBrushLogo from "../components/NeonBrushLogo";

const FEATURE_LABELS: { key: keyof typeof PLAN_FEATURES["basic"]; label: string }[] = [
  { key: "adminManager", label: "管理者管理" },
  { key: "drivers",      label: "ドライバー管理" },
  { key: "vehicles",     label: "車両管理" },
  { key: "chat",         label: "チャット" },
  { key: "shift",        label: "シフト登録" },
  { key: "dailyReport",  label: "日報管理" },
  { key: "projects",     label: "案件一覧" },
  { key: "files",        label: "ファイル管理" },
  { key: "map",          label: "位置情報マップ" },
  { key: "payment",      label: "支払集計" },
  { key: "todo",         label: "法改正対応ToDo" },
];

const FEATURE_ORDER_LEFT  = ["adminManager","drivers","vehicles","dailyReport","shift"] as const;
const FEATURE_ORDER_RIGHT = ["chat","files","map","projects","payment","todo"] as const;

export default function App() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pricingPlans = [
    { id: "basic", name: "ベーシック", eng: "Basic", price: 9800, range: "～10名", description: "チャット・シフト管理", maxUsers: 10 },
    { id: "advanced", name: "アドバンス", eng: "Advanced", price: 19800, range: "～30名", description: "チャット・シフト管理・日報管理", maxUsers: 30 },
    { id: "pro", name: "プロ", eng: "Pro", price: 32000, range: "31～50名", description: "チャット・シフト管理・日報管理・車両管理", maxUsers: 50 },
    { id: "elite", name: "エリート", eng: "Elite", price: 42000, range: "51～70名", description: "全機能対応", maxUsers: 70 },
    { id: "premium", name: "プレミアム", eng: "Premium", price: 55000, range: "71～99名", description: "全機能対応", maxUsers: 99 },
    { id: "unlimited", name: "アンリミテッド", eng: "Unlimited", price: 60000, extra: "+1名¥800", range: "100名以上", description: "全機能対応", maxUsers: Infinity },
  ];

  const setupPlans = [
    { id: "basic-setup",     name: "ベーシック",   price:  80000, range: "～30名",    details: "初期設定／管理者1名・1データセット取込（最大150件）＋1時間リモート講習" },
    { id: "standard-setup",  name: "スタンダード", price: 150000, range: "31～70名",  details: "ドライバー＋車両CSV取込（合計500件まで）＋2時間講習＋2週間ハイパーケア＋ロゴ/配色" },
    { id: "premium-setup",   name: "プレミアム",   price: 220000, range: "71～99名",  details: "案件CSV取込＋位置情報/ファイル権限設定＋通知調整＋1か月ハイパーケア" },
    { id: "unlimited-setup", name: "アンリミテッド", price: 300000, range: "100名以上", details: "大規模移行＋監査/セキュリティ強化＋従量(@¥800〜¥1,000/人)" },
  ];

  const pdfRef = useRef<HTMLDivElement>(null);
  const handleDownloadPDF = async () => {
    const input = pdfRef.current;
    if (!input) return;
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("landscape", "mm", "a4");
    const imgWidth = 297;
    const pageHeight = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save("anborco-pricing.pdf");
  };

  return (
    <div className="relative min-h-screen text-slate-100 overflow-hidden">
      {/* 背景（ダーク×ネオン） */}
      <div aria-hidden className="absolute inset-0 bg-[#0b1220] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div aria-hidden className="absolute inset-0 bg-white/[0.06] backdrop-blur-[2px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-teal-400/25 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      {/* 白枠（ヘッダー/サイドバーを避ける） */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-16 left-0 md:left-64 right-0 bottom-0 px-3 sm:px-5 lg:px-8 xl:px-12 z-10"
      >
        <div className="h-full w-full rounded-[28px] ring-8 ring-white/35 ring-inset" />
      </div>

            {/* ヘッダー：管理者画面と同じ並び（ロゴ最左／右側は最右） */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-slate-900/70 backdrop-blur border-b border-white/10">
        {/* ★ フル幅。max-w / mx-auto を使わず、左右端に吸着 */}
        <div className="h-full w-full flex items-center">
          {/* 左：ロゴ最左、SPのみメニュー */}
          <div className="flex items-center gap-3 pl-2">
            <NeonBrushLogo className="h-8 w-auto" />
            <button
              className="inline-flex items-center justify-center rounded-lg p-2 md:hidden hover:bg-white/10"
              aria-label="メニュー"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>

          {/* 右：会社名/権限表示＋ログアウト —— 画面最右に吸着 */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4 pr-2">
            <div className="hidden sm:block px-2 py-1 rounded text-xs sm:text-sm font-bold text-white/90 bg-white/10 border border-white/20">
              株式会社Anbor / マスター
            </div>
            <button
              className="text-sm text-white bg-red-500 px-3 sm:px-4 py-1 rounded hover:bg-red-600"
              onClick={() => {
                localStorage.removeItem("loggedInMaster");
                navigate("/login");
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* レイアウト */}
      <div className="pt-16 relative z-20">
        {/* SPサイドバー用オーバーレイ */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* サイドバー（md以上常時表示 / SPスライド） */}
        <aside
          className={[
            "fixed z-30 top-16 left-0 h-[calc(100vh-64px)] w-64 transform transition-transform duration-200",
            "bg-white/5 border-r border-white/10 backdrop-blur-xl shadow-2xl",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "md:translate-x-0",
          ].join(" ")}
        >
          {/* SP：クローズ */}
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

          <nav className="px-4 py-4 space-y-2 h-[calc(100%-52px)] md:h-full overflow-y-auto">
            <div className="px-2 pb-2 text-left font-bold text-white/90 text-sm border-b border-white/10">メニュー</div>
            <ul className="space-y-2 pt-2">
              <li>
                <Link to="/master/customers" className="block rounded px-3 py-2 hover:bg-white/10">
                  📋 契約顧客一覧
                </Link>
              </li>
              <li>
                <a href="/pdfs/guide.pdf" target="_blank" rel="noopener noreferrer" className="block rounded px-3 py-2 hover:bg-white/10">
                  📁 システム案内資料
                </a>
              </li>
              <li>
                <Link to="/master/pricing" className="block rounded px-3 py-2 hover:bg白/10">
                  💴 料金表
                </Link>
              </li>

              <li className="pt-3 mt-3 border-t border-white/10 text-sm font-bold text-white/80">会社設定</li>
              <li>
                <Link to="/master/settings" className="block rounded px-3 py-2 hover:bg-white/10">
                  ⚙️ 画面構成の設定
                </Link>
              </li>
              <li>
                <Link to="/master/password" className="block rounded px-3 py-2 hover:bg-white/10">
                  🔑 パスワード変更
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* メイン：白枠と同じ inset で固定配置（枠内にピッタリ） */}
        <main className="fixed top-16 left-0 md:left-64 right-0 bottom-0 px-3 sm:px-5 lg:px-8 xl:px-12 py-3 z-20">
          {/* 内側ボックス（枠28 → 角24でフィット / 中だけスクロール） */}
          <div className="h-full w-full rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="h-full w-full overflow-auto p-4 sm:p-6 md:p-8">
              <Routes>
                <Route path="/" element={<Navigate to="/master/customers" replace />} />
                <Route
  path="/customers"
  element={
    <div>
      {/* タイトル：絵文字＋日本語タイトル（白）＋英字サブタイトル（右に） */}
      <div className="px-1 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-3xl" role="img" aria-label="list">📋</span>
          <div className="flex items-baseline gap-3">
            <h1 className="text-white text-2xl md:text-3xl font-bold">契約顧客一覧</h1>
            <span className="text-sm md:text-base text-gray-300">-Customer List-</span>
          </div>
        </div>
      </div>

      {/* テーブル側は黒文字を維持（見出し/セル/リンクも黒に固定） */}
      <div className="text-black [&_th]:!text-black [&_td]:!text-black [&_a]:!text-black">
        <CustomerTable />
      </div>
    </div>
  }
/>
                <Route path="/password" element={<MasterPasswordChange />} />

                {/* 料金表（そのまま流用） */}
                <Route
                  path="/pricing"
                  element={
                    <div
                      ref={pdfRef}
                      className="bg-gradient-to-br from-[#0c0f1a] via-[#0b0d18] to-black text-white flex flex-col items-center py-10 w-full px-10"
                    >
                      <div className="text-center mb-10">
                        <h1 className="text-5xl font-extrabold text-yellow-400 tracking-wide">Anborco 料金プラン</h1>
                        <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 mx-auto my-4 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.7)]" />
                        <p className="text-gray-400 mt-3 text-lg">あなたのチームに最適なプレミアムプランをお選びください</p>
                      </div>

                      <section>
                        <h2 className="text-center text-2xl font-bold text-yellow-400 mb-4">月額料金プラン</h2>
                        <p className="text-center text-gray-400 mb-8">税込価格・プレミアムサービス</p>

                        {/* 上段 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                          {["basic","advanced","pro"].map((id) => {
                            const plan = pricingPlans.find(p => p.id === id)!;
                            const f = PLAN_FEATURES[id as keyof typeof PLAN_FEATURES];
                            return (
                              <div key={plan.id} className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500 rounded-2xl shadow-lg hover:shadow-[0_0_25px_rgba(250,204,21,0.6)] transition-transform p-6">
                                <div className="text-center">
                                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                                  <p className="text-xs text-gray-400">{plan.eng}</p>
                                  <p className="text-3xl font-extrabold text-yellow-400 mt-3">¥{plan.price.toLocaleString()}</p>
                                  {plan.extra && <p className="text-xs text-amber-300">{plan.extra}</p>}
                                  <p className="text-xs text-gray-400 mt-2">対象人数: {plan.range}</p>
                                </div>
                                <div className="my-4 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
                                <div className="grid grid-cols-2 gap-4 text-left">
                                  <ul className="space-y-2">
                                    {FEATURE_ORDER_LEFT.map((k) => (
                                      <li key={k} className="flex items-start gap-2">
                                        {f[k] ? <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> : <Minus className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />}
                                        <span className={f[k] ? "text-gray-100 text-sm" : "text-gray-500 text-sm"}>
                                          {FEATURE_LABELS.find(x => x.key === k)?.label}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                  <ul className="space-y-2">
                                    {FEATURE_ORDER_RIGHT.map((k) => (
                                      <li key={k} className="flex items-start gap-2">
                                        {f[k] ? <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> : <Minus className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />}
                                        <span className={f[k] ? "text-gray-100 text-sm" : "text-gray-500 text-sm"}>
                                          {FEATURE_LABELS.find(x => x.key === k)?.label}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 下段 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {["elite","premium","unlimited"].map((id) => {
                            const plan = pricingPlans.find(p => p.id === id)!;
                            const f = PLAN_FEATURES[id as keyof typeof PLAN_FEATURES];
                            return (
                              <div key={plan.id} className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500 rounded-2xl shadow-lg hover:shadow-[0_0_25px_rgba(250,204,21,0.6)] transition-transform p-6">
                                <div className="text-center">
                                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                                  <p className="text-xs text-gray-400">{plan.eng}</p>
                                  <p className="text-3xl font-extrabold text-yellow-400 mt-3">¥{plan.price.toLocaleString()}</p>
                                  {plan.extra && <p className="text-xs text-amber-300">{plan.extra}</p>}
                                  <p className="text-xs text-gray-400 mt-2">対象人数: {plan.range}</p>
                                </div>
                                <div className="my-4 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
                                <div className="grid grid-cols-2 gap-4 text-left">
                                  <ul className="space-y-2">
                                    {FEATURE_ORDER_LEFT.map((k) => (
                                      <li key={k} className="flex items-start gap-2">
                                        {f[k] ? <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> : <Minus className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />}
                                        <span className={f[k] ? "text-gray-100 text-sm" : "text-gray-500 text-sm"}>
                                          {FEATURE_LABELS.find(x => x.key === k)?.label}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                  <ul className="space-y-2">
                                    {FEATURE_ORDER_RIGHT.map((k) => (
                                      <li key={k} className="flex items-start gap-2">
                                        {f[k] ? <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> : <Minus className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />}
                                        <span className={f[k] ? "text-gray-100 text-sm" : "text-gray-500 text-sm"}>
                                          {FEATURE_LABELS.find(x => x.key === k)?.label}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <section className="mt-10">
                        <h2 className="text-center text-2xl font-bold text-yellow-400 mb-6">導入プラン</h2>
                        <p className="text-center text-gray-400 mb-6">初期費用・税込価格</p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          {setupPlans.map((plan) => (
                            <div key={plan.id} className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 text-center hover:shadow-[0_0_15px_rgba(250,204,21,0.6)] hover:scale-105 transition-transform">
                              <p className="text-amber-400 font-bold">{plan.name}</p>
                              <p className="text-2xl font-extrabold text-yellow-400">¥{plan.price.toLocaleString()}</p>
                              <p className="text-xs text-gray-400">{plan.range}</p>
                              <p className="text-xs text-gray-500">{plan.details}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="text-center mt-10">
                        <p className="text-gray-400">ご不明点がございましたら、お気軽にお問い合わせください。</p>
                        <button className="mt-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">
                          お問い合わせ
                        </button>
                      </section>

                      <div className="mt-10">
                        <button
                          onClick={handleDownloadPDF}
                          className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold px-6 py-3 rounded-lg shadow hover:scale-105 transition"
                        >
                          PDFダウンロード
                        </button>
                      </div>
                    </div>
                  }
                />

                {/* 追加予定: /master/settings などは個別ページ実装次第で */}
                <Route path="/settings" element={<div className="text-white">設定ページ（実装待ち）</div>} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
