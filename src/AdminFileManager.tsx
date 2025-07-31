import  {useEffect, useState } from "react";
import PO_PDF  from "@/assets/発注書テンプレート.pdf?url";
import PS_PDF  from "@/assets/支払明細書テンプレート.pdf?url";
import INV_PDF from "@/assets/請求書テンプレート.pdf?url";
import ConfirmSendModal from "./components/ConfirmSendModal";
import type { Driver } from "./AdminDriverManager";

/* ----------- 型定義 ----------- */
// テンプレートの種類
export type TemplateType = "発注書" | "支払明細書" | "請求書";

// テンプレート（固定ファイル）
interface Template {
  key: string;          // localStorageキー (tpl_TYPE_...)
  name: string;         // ファイル名
  type: TemplateType;   // 種別
  date: string;         // 登録日 (YYYY-MM-DD)
  dataUrl: string;      // base64 Data URL
  map?: Record<string, string>;
}

// 日報・発注書など毎日生成されるPDF
interface PdfItem {
  key: string;          // localStorageキー (pdf_...)
  driverName: string;   // ドライバー名
  date: string;         // 2025-07-01
  fileName: string;     // 日付_氏名_日報.pdf
  dataUrl: string;      // base64
}

// ZIP (月別 or 年別)
interface ZipItem {
  key: string;          // localStorageキー (zip_...)
  driverName: string;   // ドライバー名 or "全ドライバー"
  ym: string;           // 2025-06 もしくは 2024
  dataUrl: string;      // base64
}

const todayStr = () => new Date().toISOString().split("T")[0];

/* ---------- コンポーネント ---------- */
export default function AdminFileManager() {
  // 当月 PDF & 過去 ZIP
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [zips, setZips] = useState<ZipItem[]>([]);
  const [sendModal, setSendModal] = useState<{
  open: boolean;
  fileName: string;
  blob: Blob;
  to: { uid: string; name: string };
} | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState<'PO' | 'PS' | 'INV'>('PO');
  const [tab, setTab] = useState<"template" | "pdf" | "zip">("template");   // ★←追加
  
  // === テンプレートアップロード用 ===
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplType , setTplType ]  = useState<Template["type"]>("発注書");
  const [tplFile , setTplFile ]  = useState<File | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
 // ✅ テンプレートアップロード処理
const handleUpload = () => {
  if (!tplFile) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    if (!result.startsWith("data:application/pdf;base64,")) {
      alert("無効なPDFファイルです（base64形式でない）");
      return;
    }

    const name = tplFile.name.replace(/\.(pdf)$/i, "");
    const newTpl = {
      key: `tpl_${tplType}_${Date.now()}`,
      name,
      type: tplType,
      date: todayStr(),
      dataUrl: result,
      map: {},
    };
    localStorage.setItem(newTpl.key, JSON.stringify(newTpl));
    setTplFile(null);
    alert("テンプレートを保存しました。");
    reload();
  };
  reader.readAsDataURL(tplFile);
};

 useEffect(() => {
  const tmpPdfs: PdfItem[] = [];
  const tmpZips: ZipItem[] = [];

  for (const [key, value] of Object.entries(localStorage)) {
    if (key.startsWith("po_") || key.startsWith("ps_") || key.startsWith("inv_")) {
      const pdf = JSON.parse(value);
      tmpPdfs.push({ key, ...pdf });
    }

    if (key.startsWith("monthlyZip_") || key.startsWith("yearZip_")) {
      const [, ym, driverId] = key.split("_"); // ym = "2025-05" or "2024"
      tmpZips.push({
        key,
        ym,
        driverName: driverId,
        dataUrl: value,
      });
    }
  }

  setPdfs(tmpPdfs);
  setZips(tmpZips);
}, []);
   
  /* ZIP削除 */
  const handleZipDelete = (key: string) => {
    if (window.confirm("本当に削除しますか？")) {
      localStorage.removeItem(key);
      setZips(prev => prev.filter(z => z.key !== key));
    }
  };
/* ---------------- 一括リロード ---------------- */
const reload = () => {
  /* Templates */
  const tpl: Template[] = Object.entries(localStorage)
    .filter(([k]) => k.startsWith("tpl_"))
    .map(([k, v]) => ({ key: k, ...JSON.parse(v) }));
  setTemplates(tpl);

  /* PDFs（今月分）*/
  const ymPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const pdfArr: PdfItem[] = Object.entries(localStorage)
    .filter(([k]) =>
      (k.startsWith("po_") || k.startsWith("ps_") || k.startsWith("inv_")) &&
      k.includes(ymPrefix)
    )
    .map(([k, v]) => ({ key: k, ...JSON.parse(v) }));
  setPdfs(pdfArr);

  /* ZIPs */
  const zipArr: ZipItem[] = Object.entries(localStorage)
    .filter(([k]) => k.startsWith("monthlyZip_") || k.startsWith("yearZip_"))
    .map(([k, v]) => {
      const [, ym, driverId] = k.split("_");
      return { key: k, ym, driverName: driverId, dataUrl: v as string };
    });
  setZips(zipArr);
};

useEffect(reload, []);
// === ドライバー情報をプレースホルダーに差し込む関数 ===
function getDriverAchievements(uid: string, date: string): Record<string, string> {
  const key = `achievement_${uid}_${date}`;
  const raw = localStorage.getItem(key);
  if (!raw) return {};
  try {
    return JSON.parse(raw); // 例: { totalDeliveries: "24", totalHours: "6.5" }
  } catch {
    return {};
  }
}
// 🔧 プレースホルダーとドライバー・実績情報を合成する関数
function buildFinalMapping(
  baseMap: Record<string, string>,
  driver: Driver
): Record<string, string> {
  const result: Record<string, string> = {};

  // 🔸発注No（管理会社単位でインクリメント）
  const company = driver.company ?? "default";
  const noKey = `poCounter_${company}`;
  const current = parseInt(localStorage.getItem(noKey) || "0");
  const nextNo = current + 1;
  localStorage.setItem(noKey, String(nextNo));
  result["{{発注No}}"] = String(nextNo).padStart(4, "0");

  // 🔸担当者名（ログインユーザー）
  const admins = JSON.parse(localStorage.getItem(`adminList_${company}`) || "[]");
  const loggedIn = admins.find((a: any) => a.loginId === localStorage.getItem("loginId"));
  result["{{担当者}}"] = loggedIn?.name || "";

  // 🔸今日の日付
  result["{{today}}"] = todayStr();

  // 🔸ドライバー情報
  Object.entries(baseMap).forEach(([placeholder, driverField]) => {
    if (!placeholder.startsWith("{{") || placeholder in result) return;
    if (driverField.startsWith("実績_")) return;
    result[placeholder] = driver[driverField] ?? "";
  });

  // 🔸実績データ
  const achievements = getDriverAchievements(driver.uid, todayStr());
  Object.entries(baseMap).forEach(([placeholder, mappedKey]) => {
    if (!mappedKey.startsWith("実績_")) return;
    const key = mappedKey.replace("実績_", "");
    result[placeholder] = achievements[key] ?? "";
  });

  // 🔸金額の自動計算（数量×単価）
  let total = 0;
  for (let i = 1; i <= 5; i++) {
    const qty = parseFloat(result[`{{item_${i}_qty}}`] ?? "0");
    const price = parseFloat(result[`{{item_${i}_price}}`] ?? "0");
    const amount = qty * price;
    result[`{{item_${i}_amount}}`] = String(amount);
    total += amount;
  }
  result["{{totalAmount}}"] = String(total);

  return result;
}

function applyDriverMapping(
  templateDataUrl: string,
  mapping: Record<string, string>,
  driver: Driver
): string {
  const base64Body = templateDataUrl.split(',')[1];
  let content = atob(base64Body);

  // ✅ ドライバー情報の差し込み
  Object.entries(mapping).forEach(([placeholder, driverField]) => {
    if (driverField.startsWith("実績_")) return; // 実績項目は後で処理
    const value = driver[driverField] ?? "";
    content = content.replaceAll(placeholder, value);
  });

  // ✅ 実績データの差し込み
  const achievements = getDriverAchievements(driver.uid, todayStr());
  Object.entries(mapping).forEach(([placeholder, mappedKey]) => {
    if (!mappedKey.startsWith("実績_")) return;
    const key = mappedKey.replace("実績_", "");
    const value = achievements[key] ?? "";
    content = content.replaceAll(placeholder, value);
  });

  return `data:application/pdf;base64,${btoa(content)}`;
}

const [driverList, setDriverList] = useState<Driver[]>([]);

useEffect(() => {
  const company = localStorage.getItem("company") ?? "default";
  const initializedKey = `defaultTemplatesInitialized_${company}`;

  // ✅ 実際にテンプレートが既に存在するかチェック
  const existing = Object.entries(localStorage).filter(([k]) =>
    k.startsWith("tpl_発注書") || k.startsWith("tpl_支払明細書") || k.startsWith("tpl_請求書")
  );
  if (existing.length >= 3) {
    console.log("⏭ 既にテンプレートが3件以上あるため初期登録スキップ");
    return;
  }

  if (localStorage.getItem(initializedKey)) {
    console.log("⏭ 初期化キーあり。スキップ");
    return;
  }

  const defs = [
    { type: "発注書" as const, name: "発注書テンプレート.pdf", url: PO_PDF },
    { type: "支払明細書" as const, name: "支払明細書テンプレート.pdf", url: PS_PDF },
    { type: "請求書" as const, name: "請求書テンプレート.pdf", url: INV_PDF },
  ];

  Promise.all(
    defs.map(({ type, name, url }) =>
      fetch(url)
        .then(res => res.blob())
        .then(blob => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            if (!result.startsWith("data:application/pdf;base64,")) {
              reject(new Error("base64 PDF形式ではありません"));
            } else {
              resolve(result);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }))
        .then(dataUrl => {
          const key = `tpl_${type}_${Date.now()}`;
          const tpl: Template = {
            key,
            name,
            type,
            date: todayStr(),
            dataUrl,
            map: {},
          };
          localStorage.setItem(key, JSON.stringify(tpl));
        })
    )
  ).then(() => {
    localStorage.setItem(initializedKey, "true");
    console.log("✅ 初期テンプレート登録完了");
    reload();
  }).catch(err => {
    console.error("❌ 初期テンプレート登録エラー:", err);
  });
}, []);

useEffect(() => {
  const company = localStorage.getItem("company");
  if (!company) {
    console.warn("⚠️ company が localStorage にありません");
    return;
  }

  const raw = localStorage.getItem(`driverList_${company}`);
  if (!raw) {
    console.warn(`⚠️ driverList_${company} が見つかりません`);
    return;
  }

  try {
    const list = JSON.parse(raw);
    console.log("✅ driverList を取得しました:", list);
    setDriverList(list);
  } catch (e) {
    console.error("❌ driverList のパースに失敗:", e);
  }
}, []);

// ------- マッピング編集モーダル用 -------
const [mapKey,        setMapKey]        = useState<string|null>(null);          // 編集中の localStorage キー
const [placeholders,  setPlaceholders]  = useState<string[]>([]);               // {{ph}} 一覧
const [mapping,       setMapping]       = useState<Record<string,string>>({});  // 入力値

/** モーダルを開く */
async function openMappingModal(storageKey: string) {
  const metaRaw = localStorage.getItem(storageKey);
  if (!metaRaw) {
    console.warn(`テンプレート ${storageKey} が見つかりません`);
    return;
  }

  const meta = JSON.parse(metaRaw);
  const dataUrl = meta.dataUrl;
  if (!dataUrl || !dataUrl.startsWith("data:application/pdf;base64,")) {
    alert("このテンプレートは破損しています（base64 PDFではありません）");
    return;
  }

  try {
    const { extractPlaceholders } = await import("./utils/pdfUtils");
    const ph = await extractPlaceholders(dataUrl);

    if (!Array.isArray(ph) || ph.length === 0) {
      throw new Error("プレースホルダーが見つかりません");
    }

    setMapKey(storageKey);
    setPlaceholders(ph);
    setMapping(meta.map ?? {});
  } catch (e) {
    console.error("❌ PDF読み取り失敗:", e);
    alert("PDFの読み取りに失敗しました（ファイルが破損しているか、形式不明）");
  }
}

/** 保存ボタン */
function saveMapping() {
  if (!mapKey) return;
  const meta = JSON.parse(localStorage.getItem(mapKey)!);
  localStorage.setItem(mapKey, JSON.stringify({ ...meta, map: mapping }));
  setMapKey(null);                     // モーダルを閉じる
}

  /* ---------- JSX ---------- */
  return (
    
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        🖨️ファイル管理<span className="text-sm text-gray-500"> - FileManager -</span>
      </h1>
{/* ========== 📑 テンプレート管理 ========== */}
<div className="mb-10 border p-4 rounded shadow">
  <h2 className="text-lg font-bold mb-3">📑 テンプレート管理</h2>
{/* 🔁 アップロード欄を先に表示 */}
<div className="flex items-center gap-2 mb-4">
  <select
    value={tplType}
    onChange={e => setTplType(e.target.value as any)}
    className="border px-2 py-1 rounded"
  >
    <option value="発注書">発注書 (PO)</option>
    <option value="支払明細書">支払明細書 (PS)</option>
    <option value="請求書">請求書 (INV)</option>
  </select>

  <input
    type="file"
    accept="application/pdf"
    onChange={e => setTplFile(e.target.files?.[0] ?? null)}
  />

  <button
  className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
  disabled={!tplFile}
  onClick={handleUpload}  // ✅ 正しい関数名に置換
>
  アップロード
</button>
</div>

{/* 📌 帳票作成セクション */}
<div className="flex items-center gap-4 mb-4">
  <label className="text-sm text-gray-600">📌 帳票作成対象のドライバー：</label>
  <select
    className="border px-2 py-1 rounded"
    value={selectedDriver?.uid ?? ""}
    onChange={e => {
      const selected = driverList.find(d => d.uid === e.target.value);
      setSelectedDriver(selected ?? null);
    }}
  >
    <option value="">-- 選択してください --</option>
    {driverList.map(d => (
      <option key={d.uid} value={d.uid}>
        {d.name}（{d.contractType}）
      </option>
    ))}
  </select>

  {/* 種別選択 */}
  <select
    className="border px-2 py-1 rounded"
    value={currentTab}
    onChange={e => setCurrentTab(e.target.value as any)}
  >
    <option value="PO">発注書</option>
    <option value="PS">支払明細書</option>
    <option value="INV">請求書</option>
  </select>

  {/* 🆕 作成ボタン */}
  <button
    className="bg-indigo-600 text-white px-4 py-1 rounded"
    onClick={async () => {
      if (!selectedDriver) {
        alert("ドライバーを選択してください");
        return;
      }

      const target = templates.find(t => t.type === (
        currentTab === "PO" ? "発注書" :
        currentTab === "PS" ? "支払明細書" : "請求書"
      ));
      if (!target) {
        alert("該当テンプレートが見つかりません");
        return;
      }

      const map = target.map ?? {};
      const filledDataUrl = applyDriverMapping(
        target.dataUrl,
        buildFinalMapping(map, selectedDriver),
        selectedDriver
      );

      const fileName = `${todayStr()}_${selectedDriver.name}_${target.type}.pdf`;
      const keyPrefix = currentTab === "PO" ? "po_" : currentTab === "PS" ? "ps_" : "inv_";
      const key = `${keyPrefix}${Date.now()}`;

      localStorage.setItem(key, JSON.stringify({
        driverName: selectedDriver.name,
        date: todayStr(),
        fileName,
        dataUrl: filledDataUrl,
      }));

      alert("PDFを作成しました");
      reload();
    }}
  >
    作成
  </button>
</div>

  {/* 一覧 */}
  <table className="table-auto w-full border">
    <thead className="bg-gray-100">
      <tr>
        <th className="border px-2 py-1">種別</th>
        <th className="border px-2 py-1">ファイル名</th>
        <th className="border px-2 py-1">登録日時</th>
        <th className="border px-2 py-1">操作</th>
      </tr>
    </thead>
    <tbody>
      {templates.map(tpl => (
  <tr key={tpl.key}>
    <td className="border px-2 py-1">{tpl.type}</td>
    <td className="border px-2 py-1">{tpl.name}</td>
    <td className="border px-2 py-1">{tpl.date}</td>
    <td className="border px-2 py-1">
  <a
  href={tpl.dataUrl.startsWith("data:application/pdf;base64,") ? tpl.dataUrl : "#"}
  target="_blank"
  rel="noopener noreferrer"
  className="text-blue-600 underline mr-3"
  onClick={(e) => {
    if (!tpl.dataUrl.startsWith("data:application/pdf;base64,")) {
      e.preventDefault();
      alert("このテンプレートは正しいPDF形式ではありません");
    }
  }}
>
  表示
</a>
  <button
    className="text-green-600 underline mr-3"
    onClick={() => openMappingModal(tpl.key)}
  >
    マッピング編集
  </button>
  <button
    className="text-red-600 underline mr-3"
    onClick={() => {
      if (window.confirm("本当に削除しますか？")) {
        localStorage.removeItem(tpl.key);
        setTemplates(t => t.filter(tp => tp.key !== tpl.key));
      }
    }}
  >
    削除
  </button>
</td>

  </tr>
))}
{templates.length === 0 && (
  <tr><td colSpan={4} className="text-center py-3">まだ何もありません</td></tr>
)}
      {Object.keys(localStorage).filter(k => k.startsWith("tpl_")).length === 0 && (
        <tr><td colSpan={4} className="text-center py-3">まだ何もありません</td></tr>
      )}
    </tbody>
  </table>
</div>
{/* ===== マッピング編集モーダル ===== */}
{mapKey && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white w-[420px] max-h-[80vh] overflow-y-auto rounded shadow p-6">
      <h3 className="text-lg font-bold mb-4">フィールドマッピング</h3>

      {placeholders.map(ph => (
        <div key={ph} className="flex items-center mb-3">
          <span className="w-1/3 text-sm text-gray-700 break-all">{ph}</span>
          <input
            className="flex-1 border rounded px-2 py-1 text-sm"
            placeholder="例）driverName"
            value={mapping[ph] ?? ""}
            onChange={e => setMapping(prev => ({ ...prev, [ph]: e.target.value }))}
          />
        </div>
      ))}

      <div className="text-right mt-6">
        <button
          className="mr-4 px-3 py-1 text-sm"
          onClick={() => setMapKey(null)}
        >キャンセル</button>

        <button
          className="bg-blue-600 text-white px-4 py-1 text-sm rounded"
          onClick={saveMapping}
        >保存</button>
      </div>
    </div>
  </div>
)}

      {/* ==== アップロード UI ==== */}
      {/* …（ここはあなたの元コードをそのまま）… */}

      {/* ==== 当月 PDF 一覧 ==== */}
      <h2 className="text-lg font-bold mt-8 mb-2">📄 当月提出 PDF</h2>
      <table className="table-auto w-full border mb-8">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2">日付</th>
            <th className="border px-4 py-2">ドライバー</th>
            <th className="border px-4 py-2">ファイル名</th>
            <th className="border px-4 py-2">DL</th>
          </tr>
        </thead>
        <tbody>
          {pdfs.map(p => (
            <tr key={p.key}>
              <td className="border px-4 py-2">{p.date}</td>
              <td className="border px-4 py-2">{p.driverName}</td>
              <td className="border px-4 py-2">{p.fileName}</td>
              <td className="border px-4 py-2">
                <a href={p.dataUrl} download={p.fileName} className="text-blue-600 underline">
                  DL
                </a>
              </td>
            </tr>
          ))}
          {pdfs.length === 0 && (
            <tr><td colSpan={4} className="text-center py-4">当月の提出はまだありません。</td></tr>
          )}
        </tbody>
      </table>

      {/* ==== 過去 ZIP 一覧 ==== */}
      <h2 className="text-lg font-bold mb-2">📦 過去 ZIP（前月以前）</h2>
      <table className="table-auto w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2">対象</th>
            <th className="border px-4 py-2">ドライバー</th>
            <th className="border px-4 py-2">DL</th>
            <th className="border px-4 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {zips.map(z => (
            <tr key={z.key}>
              <td className="border px-4 py-2">{z.ym}</td>
              <td className="border px-4 py-2">{z.driverName}</td>
              <td className="border px-4 py-2">
                <a
                  href={z.dataUrl}
                  download={`${z.ym}_${z.driverName}.zip`}
                  className="text-blue-600 underline"
                >
                  DL
                </a>
              </td>
              <td className="border px-4 py-2">
                <button onClick={() => handleZipDelete(z.key)} className="text-red-600 underline">
                  削除
                </button>
              </td>
             <td className="px-2 py-1 text-center">
  <button
    className="text-blue-600 underline"
    onClick={() =>
      setSendModal({
        open: true,
        fileName: `${z.ym}_${z.driverName}.zip`,
            blob: dataURLtoBlob(z.dataUrl),
            to: { uid: "dummy-uid", name: z.driverName }, // これらはpdfオブジェクトに必要
      })
    }
  >
    送信
  </button>
</td> 
            </tr>
          ))}
          {zips.length === 0 && (
            <tr><td colSpan={4} className="text-center py-4">過去 ZIP はありません。</td></tr>
          )}
        </tbody>
      </table>
{sendModal && (
  <ConfirmSendModal
    open={sendModal.open}
    onClose={() => setSendModal(null)}
    fileName={sendModal.fileName}
    pdfBlob={sendModal.blob}
    to={sendModal.to}
    onSent={() => alert("送信しました！")}
  />
)}
      <h2 className="text-lg font-bold mt-8 mb-2">📦 年次 ZIP</h2>
    </div>
  );
}

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}
