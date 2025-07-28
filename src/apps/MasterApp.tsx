import { Link, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import CustomerTable from "../pages/CustomerTable";
import MasterPasswordChange from "../pages/MasterPasswordChange";
import  { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
    price: 50000,
    range: "～30名",
    details: "初期設定＋簡易レクチャー"
  },
  {
    id: "standard-setup",
    name: "スタンダード",
    price: 100000,
    range: "31～70名",
    details: "管理者研修＋ドライバーCSV取込"
  },
  {
    id: "premium-setup",
    name: "プレミアム",
    price: 150000,
    range: "71～99名",
    details: "車両・案件CSV取込＋セキュリティ設定＋1か月サポート"
  },
  {
    id: "unlimited-setup",
    name: "アンリミテッド",
    price: 150000,
    range: "100名以上",
    details: "大規模専用研修（+1名¥1,000）"
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

      <div className="flex flex-1">
        {/* サイドバー */}
        <aside className="bg-green-800 text-white w-64 pt-4">
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
        <main className="flex-1 bg-gray-100 p-6 overflow-y-auto overflow-x-auto">
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

        {/* ✅ 月額料金プラン */}
        <section>
          <h2 className="text-center text-2xl font-bold text-yellow-400 mb-4">
            月額料金プラン
          </h2>
          <p className="text-center text-gray-400 mb-8">
            税込価格・プレミアムサービス
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {pricingPlans.map((plan) => (
              <div
  key={plan.id}
  className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500 rounded-xl shadow-lg hover:shadow-[0_0_25px_rgba(250,204,21,0.8)] hover:scale-105 transition-transform p-6 text-center"
>
  {/* ✅ POPULARタグ */}
  {plan.popular && (
    <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full shadow-md">
      POPULAR
    </span>
  )}
  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
  <p className="text-xs text-gray-400">{plan.eng}</p>
  <p className="text-sm text-gray-400 mt-2">{plan.description}</p>
  <p className="text-3xl font-extrabold text-yellow-400 mt-3">
    ¥{plan.price.toLocaleString()}
  </p>
  {plan.extra && (<p className="text-xs text-amber-300">{plan.extra}</p>)}
  <p className="text-xs text-gray-400 mt-2">対象人数: {plan.range}</p>
</div>
            ))}
          </div>
        </section>

        {/* ✅ 導入プラン */}
        <section>
          <h2 className="text-center text-2xl font-bold text-yellow-400 mb-6">
            導入プラン
          </h2>
          <p className="text-center text-gray-400 mb-6">初期費用・税込価格</p>

          <div className="grid grid-cols-4 gap-6">
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
