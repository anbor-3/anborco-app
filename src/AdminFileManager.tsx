import React, { ChangeEvent, useEffect, useState } from "react";
import { saveAs } from "file-saver";
import { Download, Eye, Trash2, Upload } from "lucide-react";
import PO_PDF  from "@/assets/発注書テンプレート.pdf?url";
import PS_PDF  from "@/assets/支払明細書テンプレート.pdf?url";
import INV_PDF from "@/assets/請求書テンプレート.pdf?url";
import ConfirmSendModal from "@/components/ConfirmSendModal";

/* ---------- デフォルトテンプレートの初期登録 ---------- */
// 1度でも登録されていればスキップする
(function storeDefaults() {
  const defs = [
    { type: "発注書" as const,     name: "発注書テンプレート.pdf",       url: PO_PDF  },
    { type: "支払明細書" as const, name: "支払明細書テンプレート.pdf",   url: PS_PDF  },
    { type: "請求書" as const,     name: "請求書テンプレート.pdf",       url: INV_PDF },
  ];

  defs.forEach(({ type, name, url }) => {
    const exists = Object.keys(localStorage).some(k => k.startsWith(`tpl_${type}_`));
    if (exists) return;

    // BLOB→base64 変換して保存
    fetch(url)
      .then(res => res.blob())
      .then(blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror   = reject;
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => {
        const today = new Date().toISOString().split("T")[0];
        const key = `tpl_${type}_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify({ name, type, date: today, dataUrl }));
      });
  });
})();

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

// ------- マッピング編集モーダル用 -------
const [mapKey,        setMapKey]        = useState<string|null>(null);          // 編集中の localStorage キー
const [placeholders,  setPlaceholders]  = useState<string[]>([]);               // {{ph}} 一覧
const [mapping,       setMapping]       = useState<Record<string,string>>({});  // 入力値

/** モーダルを開く */
async function openMappingModal(storageKey: string) {
  const meta = JSON.parse(localStorage.getItem(storageKey)!);

  // pdf から {{placeholder}} を抽出
  const { extractPlaceholders } = await import("@/utils/pdfUtils");
  const ph = await extractPlaceholders(meta.dataUrl);

  setMapKey(storageKey);
  setPlaceholders(ph);
  setMapping(meta.map ?? {});          // 既に保存してあれば読み込む
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

  {/* アップロード */}
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
      onClick={async () => {
  if (!tplFile) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    const dateStr = new Date().toISOString().split("T")[0];
    const key = `tpl_${tplType === "発注書" ? "PO" : tplType === "支払明細書" ? "PS" : "INV"}_${Date.now()}`;
    
    localStorage.setItem(key, JSON.stringify({
      name: tplFile.name,
      type: tplType,
      date: dateStr,
      dataUrl,
    }));

    setTemplates(prev => [
      ...prev,
      {
        key,
        name: tplFile.name,
        type: tplType,
        date: dateStr,
        dataUrl,
      },
    ]);

    setTplFile(null);
  };
  reader.readAsDataURL(tplFile);
}}
    >
      アップロード
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
      <a href={tpl.dataUrl} target="_blank" className="text-blue-600 underline mr-3">表示</a>
      <button
        className="text-green-600 underline mr-3"
        onClick={() => openMappingModal(tpl.key)}
      >
        マッピング編集
      </button>
      <button
        className="text-red-600 underline"
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
        fileName: pdf.fileName,
        blob: dataURLtoBlob(pdf.dataUrl),
        to: { uid: pdf.driverUid, name: pdf.driverName }, // これらはpdfオブジェクトに必要
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
