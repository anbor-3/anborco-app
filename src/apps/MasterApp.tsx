import { Link, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import CustomerTable from "../pages/CustomerTable";
import MasterPasswordChange from "../pages/MasterPasswordChange";
import  { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
// 追加の import（パスは配置に合わせて調整）
import { CheckCircle, Minus } from "lucide-react";
import { PLAN_FEATURES } from "../features"; // ← AdminPlanChange と同じ features.ts を使い回し

// 機能ラベル（AdminPlanChange と同じ順）
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

// 左列・右列のキー配列（左右でほぼ同数になるよう固定）
const FEATURE_ORDER_LEFT  = ["adminManager","drivers","vehicles","dailyReport","shift"] as const;
const FEATURE_ORDER_RIGHT = ["chat","files","map","projects","payment","todo"] as const;

export default function App() {
 const pricingPlans = [
  { id: "basic", name: "ベーシック", eng: "Basic", price: 9800, range: "～10名", description: "チャット・シフト管理", maxUsers: 10 },
  { id: "advanced", name: "アドバンス", eng: "Advanced", price: 19800, range: "～30名", description: "チャット・シフト管理・日報管理", maxUsers: 30 },
  { id: "pro", name: "プロ", eng: "Pro", price: 32000, range: "31～50名", description: "チャット・シフト管理・日報管理・車両管理", maxUsers: 50 },
  { id: "elite", name: "エリート", eng: "Elite", price: 42000, range: "51～70名", description: "全機能対応", maxUsers: 70 },
  { id: "premium", name: "プレミアム", eng: "Premium", price: 55000, range: "71～99名", description: "全機能対応", maxUsers: 99 },
  { id: "unlimited", name: "アンリミテッド", eng: "Unlimited", price: 60000, extra: "+1名¥800", range: "100名以上", description: "全機能対応", maxUsers: Infinity }
];

  const pdfRef = useRef<HTMLDivElement>(null);

const handleDownloadPDF = async () => {
  const input = pdfRef.current;
  if (input) {
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
  }
};

  const navigate = useNavigate();

const setupPlans = [
  {
    id: "basic-setup",
    name: "ベーシック",
    price: 80000,
    range: "～30名",
    details: "初期設定／管理者1名・1データセット取込（最大150件）＋1時間リモート講習"
  },
  {
    id: "standard-setup",
    name: "スタンダード",
    price: 150000,
    range: "31～70名",
    details: "ドライバー＋車両CSV取込（合計500件まで）＋2時間講習＋2週間ハイパーケア＋ロゴ/配色"
  },
  {
    id: "premium-setup",
    name: "プレミアム",
    price: 220000,
    range: "71～99名",
    details: "案件CSV取込＋位置情報/ファイル権限設定＋通知調整＋1か月ハイパーケア"
  },
  {
    id: "unlimited-setup",
    name: "アンリミテッド",
    price: 300000,
    range: "100名以上",
    details: "大規模移行＋監査/セキュリティ強化＋従量(@¥800〜¥1,000/人)"
  }
];

  return (
    <div className="master-container flex flex-col h-screen">
      {/* 共通ヘッダー */}
      <header className="bg-green-100 flex items-center justify-between px-4 py-2 w-full">
        <img
          src="/logo.png"
          alt="ロゴ"
          className="h-full object-contain ml-4"
          style={{ maxHeight: "48px" }}
        />
        <div className="flex items-center gap-4 mr-4">
          <div className="border border-white bg-white px-2 py-1 rounded font-bold text-black flex items-center gap-2">
            <span className="text-xs">株式会社Anbor</span>
            <span className="text-base">マスター</span>
          </div>
          <button
            className="text-sm text-red-500 hover:text-red-700"
            onClick={() => {
  localStorage.removeItem("loggedInMaster");
  navigate("/login"); // ← これが正しい遷移先
}}
          >
            ログアウト
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* サイドバー */}
        <aside className="bg-green-800 text-white w-64 pt-4 h-full overflow-y-auto overscroll-contain">
          <div className="px-4 pb-2 text-left font-bold text-white text-sm border-b border-white">
            メニュー
          </div>
          <ul className="space-y-2 p-4 text-center">
            <li className="flex items-center justify-start gap-2 pl-4">
              <span>📋</span>
              <Link to="/master/customers" className="hover:underline">
                契約顧客一覧
              </Link>
            </li>
            <li className="flex items-center justify-start gap-2 pl-4">
              <span>📁</span>
              <a
                href="/pdfs/guide.pdf"
                target="_blank"
                className="hover:underline"
                rel="noopener noreferrer"
              >
                システム案内資料
              </a>
            </li>
            <li className="flex items-center justify-start gap-2 pl-4">
  <span>💴</span>
  <Link to="/master/pricing" className="hover:underline">
    料金表
  </Link>
</li>

            <li className="text-left font-bold text-white text-sm border-t border-white pt-4 pl-4">
              会計管理
            </li>
            <li className="flex items-center justify-start gap-2 pl-4">
              <span>💰</span>
              <Link to="/master/payment" className="hover:underline">
                支払管理
              </Link>
            </li>
            <li className="mt-8 border-t border-white pt-4">
              <div className="text-left font-bold text-white text-sm mb-2">
                会社設定
              </div>
              <div className="flex items-center justify-start gap-2 pl-4">
                <span>⚙️</span>
                <Link to="/master/settings" className="hover:underline">
                  画面構成の設定
                </Link>
              </div>
              <div className="flex items-center justify-start gap-2 pl-4 mt-2">
                <span>🔑</span>
                <Link to="/master/password" className="hover:underline">
                  パスワード変更
                </Link>
              </div>
            </li>
          </ul>
        </aside>

        {/* 🔄 ここだけルートに応じて切り替え */}
        <main className="flex-1 bg-gray-100 p-6 min-h-0 overflow-y-auto overflow-x-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/master/customers" replace />} />
            <Route path="/customers" element={<CustomerTable />} />
            <Route path="/password" element={<MasterPasswordChange />} />
            <Route
  path="/pricing"
  element={
    <div
      ref={pdfRef}
      className="bg-gradient-to-br from-[#0c0f1a] via-[#0b0d18] to-black text-white flex flex-col items-center py-10 w-full px-10"
    >
      {/* タイトル */}
      <div className="text-center mb-10">
  <h1 className="text-5xl font-extrabold text-yellow-400 tracking-wide">
    Anborco 料金プラン
  </h1>
  {/* ✅ ゴールドライン */}
  <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 mx-auto my-4 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.7)]"></div>
  <p className="text-gray-400 mt-3 text-lg">
    あなたのチームに最適なプレミアムプランをお選びください
  </p>
</div>

        {/* ✅ 月額料金プラン（上段：ベーシック〜プロ／下段：エリート〜アンリミテッド） */}
<section>
  <h2 className="text-center text-2xl font-bold text-yellow-400 mb-4">
    月額料金プラン
  </h2>
  <p className="text-center text-gray-400 mb-8">
    税込価格・プレミアムサービス
  </p>

  {/* 上段：basic / advanced / pro */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
    {["basic","advanced","pro"].map((id) => {
      const plan = pricingPlans.find(p => p.id === id)!;
      const f = PLAN_FEATURES[id as keyof typeof PLAN_FEATURES];
      return (
        <div
          key={plan.id}
          className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500 rounded-2xl shadow-lg hover:shadow-[0_0_25px_rgba(250,204,21,0.6)] transition-transform p-6"
        >
          {/* ヘッダー（名前・英字・価格） */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
            <p className="text-xs text-gray-400">{plan.eng}</p>
            <p className="text-3xl font-extrabold text-yellow-400 mt-3">
              ¥{plan.price.toLocaleString()}
            </p>
            {plan.extra && <p className="text-xs text-amber-300">{plan.extra}</p>}
            <p className="text-xs text-gray-400 mt-2">対象人数: {plan.range}</p>
          </div>

          {/* 区切り */}
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />

          {/* 機能（左右） */}
          <div className="grid grid-cols-2 gap-4 text-left">
            <ul className="space-y-2">
              {FEATURE_ORDER_LEFT.map((k) => (
                <li key={k} className="flex items-start gap-2">
                  {f[k] ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Minus className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                  )}
                  <span className={f[k] ? "text-gray-100 text-sm" : "text-gray-500 text-sm"}>
                    {FEATURE_LABELS.find(x => x.key === k)?.label}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="space-y-2">
              {FEATURE_ORDER_RIGHT.map((k) => (
                <li key={k} className="flex items-start gap-2">
                  {f[k] ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Minus className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                  )}
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

  {/* 下段：elite / premium / unlimited */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {["elite","premium","unlimited"].map((id) => {
      const plan = pricingPlans.find(p => p.id === id)!;
      const f = PLAN_FEATURES[id as keyof typeof PLAN_FEATURES];
      return (
        <div
          key={plan.id}
          className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500 rounded-2xl shadow-lg hover:shadow-[0_0_25px_rgba(250,204,21,0.6)] transition-transform p-6"
        >
          <div className="text-center">
            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
            <p className="text-xs text-gray-400">{plan.eng}</p>
            <p className="text-3xl font-extrabold text-yellow-400 mt-3">
              ¥{plan.price.toLocaleString()}
            </p>
            {plan.extra && <p className="text-xs text-amber-300">{plan.extra}</p>}
            <p className="text-xs text-gray-400 mt-2">対象人数: {plan.range}</p>
          </div>

          <div className="my-4 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />

          <div className="grid grid-cols-2 gap-4 text-left">
            <ul className="space-y-2">
              {FEATURE_ORDER_LEFT.map((k) => (
                <li key={k} className="flex items-start gap-2">
                  {f[k] ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Minus className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                  )}
                  <span className={f[k] ? "text-gray-100 text-sm" : "text-gray-500 text-sm"}>
                    {FEATURE_LABELS.find(x => x.key === k)?.label}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="space-y-2">
              {FEATURE_ORDER_RIGHT.map((k) => (
                <li key={k} className="flex items-start gap-2">
                  {f[k] ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Minus className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                  )}
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

{/* ✅ 導入プラン（初期費用） */}
<section>
  <h2 className="text-center text-2xl font-bold text-yellow-400 mb-6">
    導入プラン
  </h2>
  <p className="text-center text-gray-400 mb-6">初期費用・税込価格</p>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
    {setupPlans.map((plan) => (
      <div
        key={plan.id}
        className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 text-center hover:shadow-[0_0_15px_rgba(250,204,21,0.6)] hover:scale-105 transition-transform"
      >
        <p className="text-amber-400 font-bold">{plan.name}</p>
        <p className="text-2xl font-extrabold text-yellow-400">
          ¥{plan.price.toLocaleString()}
        </p>
        <p className="text-xs text-gray-400">{plan.range}</p>
        <p className="text-xs text-gray-500">{plan.details}</p>
      </div>
    ))}
  </div>
</section>

         {/* ✅ お問い合わせ */}
        <section className="text-center mt-10">
          <p className="text-gray-400">
            ご不明点がございましたら、お気軽にお問い合わせください。
          </p>
          <button className="mt-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">
            お問い合わせ
          </button>
        </section>

        {/* ✅ PDFダウンロード */}
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
</Routes>
        </main>
      </div>
    </div>
  );
}
