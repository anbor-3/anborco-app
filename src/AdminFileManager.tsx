// src/AdminFileManager.tsx —— 差し替え版（全文）
import { useEffect, useState } from "react";
import PO_PDF  from "@/assets/発注書テンプレート.pdf?url";
import PS_PDF  from "@/assets/支払明細書テンプレート.pdf?url";
import INV_PDF from "@/assets/請求書テンプレート.pdf?url";
import ConfirmSendModal from "./components/ConfirmSendModal";
import type { Driver } from "./AdminDriverManager";
import { getAuth } from "firebase/auth";
import { auth, storage } from "./firebaseClient";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

// ---- API helpers（Authトークン付き）----
async function apiGet<T>(path: string): Promise<T> {
  const idToken = await getAuth().currentUser?.getIdToken();
  if (!idToken) throw new Error("未ログインです");
  const res = await fetch(path, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const idToken = await getAuth().currentUser?.getIdToken();
  if (!idToken) throw new Error("未ログインです");
  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const idToken = await getAuth().currentUser?.getIdToken();
  if (!idToken) throw new Error("未ログインです");
  const res = await fetch(path, { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error(`DELETE ${path} -> ${res.status}`);
}

/* ▼▼ 追加：PDF本体を Storage にアップロード → Neon にメタ保存 ▼▼ */
async function savePdfToStorageAndNeon(params: {
  dataUrl: string;
  fileName: string;
  company: string;
  driverId: string;
  type: "発注書" | "支払明細書" | "請求書";
}) {
  const { dataUrl, fileName, company, driverId, type } = params;

  const safeCompany  = String(company).replace(/[\/#?]/g, "_");
  const safeDriverId = String(driverId).replace(/[\/#?]/g, "_");
  const safeType     = String(type).replace(/[\/#?]/g, "_");
  const safeFileName = String(fileName).replace(/[\/#?]/g, "_");

  const storagePath  = `pdfs/${safeCompany}/${safeDriverId}/${safeType}/${safeFileName}`;
  const sref         = ref(storage, storagePath);
  await uploadString(sref, dataUrl, "data_url", { contentType: "application/pdf" });
  const url = await getDownloadURL(sref);

  const idToken = await auth.currentUser?.getIdToken?.();
  if (!idToken) throw new Error("未ログインです");

  const r = await fetch("/api/pdfs/save", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      company, driverId, type, fileName,
      url, // ← Storage のURL
      createdAt: new Date().toISOString(),
    }),
  });
  if (!r.ok) throw new Error(`POST /api/pdfs/save -> ${r.status}`);
}
/* ▲▲ 追加ここまで ▲▲ */

/* ----------- 型定義 ----------- */
export type TemplateType = "発注書" | "支払明細書" | "請求書";

interface Template {
  key: string;
  name: string;
  type: TemplateType;
  date: string;
  dataUrl: string;
  map?: Record<string, string>;
}

interface PdfItem {
  key: string;
  driverName: string;
  date: string;
  fileName: string;
  dataUrl: string; // サーバがURLでもここに入れる
}

interface ZipItem {
  key: string;
  driverName: string;
  ym: string;
  dataUrl: string;
}

// ★ 既定のマッピング（日本語キー）
const DEFAULT_MAPS: Record<TemplateType, Record<string, string>> = {
  "発注書": {
    "{{発注No}}": "{{発注No}}",
    "{{today}}": "{{today}}",
    "{{担当者}}": "{{担当者}}",
    "{{ドライバー名}}": "name",
    "{{会社名}}": "company",
    "{{電話}}": "phone",
    "{{住所}}": "address",
    "{{item_1_desc}}":  "実績_item1_desc",
    "{{item_1_qty}}":   "実績_item1_qty",
    "{{item_1_price}}": "実績_item1_price",
  },
  "支払明細書": {
    "{{today}}": "{{today}}",
    "{{ドライバー名}}": "name",
    "{{会社名}}": "company",
    "{{合計配達数}}": "実績_totalDeliveries",
    "{{総稼働時間}}": "実績_totalHours",
    "{{走行距離}}": "実績_totalDistance",
    "{{支払総額}}": "実績_totalPay",
  },
  "請求書": {
    "{{today}}": "{{today}}",
    "{{請求先}}": "company",
    "{{担当者}}": "{{担当者}}",
    "{{請求番号}}": "{{発注No}}",
    "{{請求対象名}}": "name",
    "{{小計}}": "実績_subtotal",
    "{{税額}}": "実績_tax",
    "{{合計}}": "実績_total",
  },
};

// ✅ 安全な取得関数（日本語/英字どちらでもOK）
function getDefaultMapByType(t: TemplateType | "PO" | "PS" | "INV"): Record<string, string> {
  switch (t) {
    case "発注書":
    case "PO":  return DEFAULT_MAPS["発注書"];
    case "支払明細書":
    case "PS":  return DEFAULT_MAPS["支払明細書"];
    case "請求書":
    case "INV": return DEFAULT_MAPS["請求書"];
    default:    return {};
  }
}

const todayStr = () => new Date().toISOString().split("T")[0];

export default function AdminFileManager() {
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [zips, setZips] = useState<ZipItem[]>([]);
  const [sendModal, setSendModal] = useState<{
    open: boolean; fileName: string; blob: Blob; to: { uid: string; name: string };
  } | null>(null);
  const [currentTab, setCurrentTab] = useState<"PO" | "PS" | "INV">("PO");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplType , setTplType ]  = useState<Template["type"]>("発注書");
  const [tplFile , setTplFile ]  = useState<File | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // PDFプレビュー
  const [pdfPreview, setPdfPreview] =
    useState<{ open: boolean; url: string; title: string } | null>(null);

  function makeObjectUrlIfDataUrl(src: string): string {
    try {
      if (typeof src === "string" && src.startsWith("data:application/pdf")) {
        const blob = dataURLtoBlob(src);
        return URL.createObjectURL(blob);
      }
      return src;
    } catch { return src; }
  }

  async function getBlobFromAnyUrl(src: string): Promise<Blob> {
    if (typeof src === "string" && src.startsWith("data:")) return dataURLtoBlob(src);
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    return await res.blob();
  }

  const handleUpload = () => {
    if (!tplFile) return;
    const company = localStorage.getItem("company") ?? "default";
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const result = reader.result as string;
        if (!result.startsWith("data:application/pdf;base64,")) {
          alert("無効なPDFファイルです（base64形式でない）");
          return;
        }
        const name = tplFile.name.replace(/\.(pdf)$/i, "");

        // ← ここを安全関数に一本化
        const initialMap = getDefaultMapByType(tplType);

        try {
          const saved = await apiPost<Template>("/api/templates/upload", {
            company, type: tplType, name, dataUrl: result, map: initialMap,
          });
          setTemplates((prev) => [saved, ...prev]);
        } catch {
          const newTpl: Template = {
            key: `tpl_${tplType}_${Date.now()}`,
            name, type: tplType, date: todayStr(), dataUrl: result, map: initialMap,
          };
          localStorage.setItem(newTpl.key, JSON.stringify(newTpl));
          setTemplates((prev) => [newTpl, ...prev]);
        }

        setTplFile(null);
        alert("テンプレートを保存しました。");
        reload();
      } catch (e) {
        console.error(e);
        alert("アップロードに失敗しました");
      }
    };

    reader.readAsDataURL(tplFile);
  };

  const handleZipDelete = async (key: string) => {
    if (!window.confirm("本当に削除しますか？")) return;
    try {
      await apiDelete(`/api/zips/${encodeURIComponent(key)}`);
      setZips(prev => prev.filter(z => z.key !== key));
    } catch {
      localStorage.removeItem(key);
      setZips(prev => prev.filter(z => z.key !== key));
    }
  };

  const reload = async () => {
    const company = localStorage.getItem("company") ?? "default";
    const ymPrefix = new Date().toISOString().slice(0, 7);

    try {
      const tpl = await apiGet<Template[]>(`/api/templates?company=${encodeURIComponent(company)}`);
      setTemplates(tpl);
    } catch {
      const tpl: Template[] = Object.entries(localStorage)
        .filter(([k]) => k.startsWith("tpl_"))
        .map(([k, v]) => ({ key: k, ...JSON.parse(v as string) }));
      setTemplates(tpl);
    }

    try {
      const pdfArr = await apiGet<PdfItem[]>(
        `/api/pdfs?company=${encodeURIComponent(company)}&ym=${ymPrefix}`
      );
      setPdfs(pdfArr);
    } catch {
      const pdfArr: PdfItem[] = Object.entries(localStorage)
        .filter(([k]) =>
          (k.startsWith("po_") || k.startsWith("ps_") || k.startsWith("inv_")) && k.includes(ymPrefix)
        )
        .map(([k, v]) => ({ key: k, ...JSON.parse(v as string) }));
      setPdfs(pdfArr);
    }

    try {
      const zipArr = await apiGet<ZipItem[]>(`/api/zips?company=${encodeURIComponent(company)}`);
      setZips(zipArr);
    } catch {
      const zipArr: ZipItem[] = Object.entries(localStorage)
        .filter(([k]) => k.startsWith("monthlyZip_") || k.startsWith("yearZip_"))
        .map(([k, v]) => {
          const [, ym, driverId] = k.split("_");
          return { key: k, ym, driverName: driverId, dataUrl: v as string };
        });
      setZips(zipArr);
    }
  };

  useEffect(() => { reload(); }, []);

  // 初期テンプレ（内蔵PDF）を一度だけ投入
  useEffect(() => {
    (async () => {
      const company = localStorage.getItem("company") ?? "default";
      const initializedKey = `defaultTemplatesInitialized_${company}`;

      if (localStorage.getItem(initializedKey)) return;

      try {
        const serverTemplates = await apiGet<Template[]>(
          `/api/templates?company=${encodeURIComponent(company)}`
        );
        if (serverTemplates?.length) {
          localStorage.setItem(initializedKey, "true");
          return;
        }
      } catch {
        const existing = Object.keys(localStorage).some((k) =>
          k.startsWith("tpl_発注書") || k.startsWith("tpl_支払明細書") || k.startsWith("tpl_請求書")
        );
        if (existing) {
          localStorage.setItem(initializedKey, "true");
          return;
        }
      }

      const defs = [
        { type: "発注書" as const,     name: "発注書テンプレート.pdf",     url: PO_PDF },
        { type: "支払明細書" as const, name: "支払明細書テンプレート.pdf", url: PS_PDF },
        { type: "請求書" as const,     name: "請求書テンプレート.pdf",     url: INV_PDF },
      ];

      const created: Template[] = [];
      for (const { type, name, url } of defs) {
        const blob = await fetch(url).then((r) => r.blob());
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const str = reader.result as string;
            if (!str.startsWith("data:application/pdf;base64,")) reject(new Error("base64ではない"));
            else resolve(str);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const map = getDefaultMapByType(type); // ← 安全関数

        try {
          const saved = await apiPost<Template>("/api/templates/upload", {
            company, type, name, dataUrl, map,
          });
          created.push(saved);
        } catch {
          const key = `tpl_${type}_${Date.now()}`;
          const tpl: Template = { key, name, type, date: todayStr(), dataUrl, map };
          localStorage.setItem(key, JSON.stringify(tpl));
          created.push(tpl);
        }
      }

      setTemplates((prev) => [...created, ...prev]);
      localStorage.setItem(initializedKey, "true");
      console.log("✅ デフォルトテンプレを投入（DEFAULT_MAPS付き）");
    })();
  }, []);

  function getDriverAchievements(uid: string, date: string): Record<string, string> {
    const key = `achievement_${uid}_${date}`;
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  async function buildFinalMapping(
    baseMap: Record<string, string>,
    driver: Driver
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    const company = driver.company ?? "default";
    const noKey = `poCounter_${company}`;
    let nextNo: number;
    try {
      const data = await apiGet<{ next: number }>(
        `/api/counters/next?type=po&company=${encodeURIComponent(company)}`
      );
      nextNo = data.next;
    } catch {
      const current = parseInt(localStorage.getItem(noKey) || "0");
      nextNo = current + 1;
      localStorage.setItem(noKey, String(nextNo));
    }
    result["{{発注No}}"] = String(nextNo).padStart(4, "0");

    const admins = JSON.parse(localStorage.getItem(`adminList_${company}`) || "[]");
    const loggedIn = admins.find((a: any) => a.loginId === localStorage.getItem("loginId"));
    result["{{担当者}}"] = loggedIn?.name || "";
    result["{{today}}"] = todayStr();

    Object.entries(baseMap).forEach(([placeholder, driverField]) => {
      if (!placeholder.startsWith("{{") || placeholder in result) return;
      if (driverField.startsWith("実績_")) return;
      // @ts-ignore
      result[placeholder] = (driver as any)[driverField] ?? "";
    });

    const achievements = getDriverAchievements(driver.uid, todayStr());
    Object.entries(baseMap).forEach(([placeholder, mappedKey]) => {
      if (!mappedKey.startsWith("実績_")) return;
      const key = mappedKey.replace("実績_", "");
      result[placeholder] = achievements[key] ?? "";
    });

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

  const REQUIRED_KEYS: Record<TemplateType, string[]> = {
    "発注書": ["{{item_1_desc}}","{{item_1_qty}}","{{item_1_price}}"],
    "支払明細書": ["{{合計配達数}}","{{総稼働時間}}","{{走行距離}}","{{支払総額}}"],
    "請求書": ["{{小計}}","{{税額}}","{{合計}}"],
  };

  async function ensureRequiredInputs(type: TemplateType, finalValues: Record<string, string>) {
    const keys = REQUIRED_KEYS[type] || [];
    for (const k of keys) {
      if (!finalValues[k] || String(finalValues[k]).trim() === "") {
        const label = k.replace(/[{}]/g, "");
        const v = window.prompt(`「${label}」の値を入力してください`, "");
        if (v !== null) finalValues[k] = v;
      }
    }
    if (type === "発注書") {
      let total = 0;
      for (let i = 1; i <= 5; i++) {
        const qty = parseFloat(finalValues[`{{item_${i}_qty}}`] ?? "0");
        const price = parseFloat(finalValues[`{{item_${i}_price}}`] ?? "0");
        const amount = qty * price;
        finalValues[`{{item_${i}_amount}}`] = String(amount);
        total += amount;
      }
      finalValues["{{totalAmount}}"] = String(total);
    }
    if (type === "請求書") {
      const sub = parseFloat(finalValues["{{小計}}"] ?? "0");
      const tax = parseFloat(finalValues["{{税額}}"] ?? "0");
      if (!finalValues["{{合計}}"] || finalValues["{{合計}}"] === "0") {
        finalValues["{{合計}}"] = String(sub + tax);
      }
    }
  }

  function applyDriverMapping(templateDataUrl: string, finalValues: Record<string, string>): string {
    const base64Body = templateDataUrl.split(',')[1];
    let content = atob(base64Body);
    Object.entries(finalValues).forEach(([placeholder, value]) => {
      try { content = content.replaceAll(placeholder, String(value ?? "")); }
      catch {
        const re = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
        content = content.replace(re, String(value ?? ""));
      }
    });
    return `data:application/pdf;base64,${btoa(content)}`;
  }

  const [driverList, setDriverList] = useState<Driver[]>([]);
  useEffect(() => {
    (async () => {
      const company = localStorage.getItem("company") ?? "";
      if (!company) { console.warn("⚠️ company が localStorage にありません"); return; }
      try {
        const list = await apiGet<Driver[]>(`/api/drivers?company=${encodeURIComponent(company)}`);
        setDriverList(list);
      } catch (e) {
        console.warn("drivers API 取得失敗。localStorageへフォールバック", e);
        const raw = localStorage.getItem(`driverList_${company}`);
        if (!raw) return;
        try { setDriverList(JSON.parse(raw)); }
        catch (err) { console.error("❌ driverList のパースに失敗:", err); }
      }
    })();
  }, []);

  // ------- マッピング編集モーダル用 -------
  const [mapKey,       setMapKey]       = useState<string|null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [mapping,      setMapping]      = useState<Record<string,string>>({});

  async function openMappingModal(tpl: Template) {
    try {
      const { extractPlaceholders } = await import("@/utils/pdfUtils");
      const ph = await extractPlaceholders(tpl.dataUrl);
      if (!Array.isArray(ph) || ph.length === 0) throw new Error("プレースホルダーが見つかりません");
      setMapKey(tpl.key);
      setPlaceholders(ph);
      setMapping(tpl.map ?? {});
    } catch (e) {
      console.error("❌ PDF読み取り失敗:", e);
      alert("PDFの読み取りに失敗しました（ファイルが破損しているか、形式不明）");
    }
  }

  async function saveMapping() {
    if (!mapKey) return;
    try {
      await apiPost("/api/templates/update-map", { key: mapKey, map: mapping });
    } catch {
      const metaRaw = localStorage.getItem(mapKey);
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        localStorage.setItem(mapKey, JSON.stringify({ ...meta, map: mapping }));
      } else {
        setTemplates(prev => prev.map(t => (t.key === mapKey ? { ...t, map: mapping } : t)));
      }
    }
    setMapKey(null);
    reload();
  }

  /* ---------- JSX ---------- */
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        🖨️ファイル管理<span className="text-sm text-gray-500"> - FileManager -</span>
      </h1>

      {/* ========== テンプレート管理 ========== */}
      <div className="mb-10 border p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-3">📑 テンプレート管理</h2>

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
            onClick={handleUpload}
          >
            アップロード
          </button>
        </div>

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

          <select
            className="border px-2 py-1 rounded"
            value={currentTab}
            onChange={e => setCurrentTab(e.target.value as any)}
          >
            <option value="PO">発注書</option>
            <option value="PS">支払明細書</option>
            <option value="INV">請求書</option>
          </select>

          <button
            className="bg-indigo-600 text-white px-4 py-1 rounded"
            onClick={async () => {
              if (!selectedDriver) { alert("ドライバーを選択してください"); return; }

              const target = templates.find(t => t.type === (
                currentTab === "PO" ? "発注書" :
                currentTab === "PS" ? "支払明細書" : "請求書"
              ));
              if (!target) { alert("該当テンプレートが見つかりません"); return; }

              const finalValues = await buildFinalMapping(target.map ?? {}, selectedDriver);
              await ensureRequiredInputs(target.type, finalValues);
              const filledDataUrl = applyDriverMapping(target.dataUrl, finalValues);

              const fileName = `${todayStr()}_${selectedDriver.name}_${target.type}.pdf`;
              const keyPrefix = currentTab === "PO" ? "po_" : currentTab === "PS" ? "ps_" : "inv_";

              try {
                await savePdfToStorageAndNeon({
                  dataUrl: filledDataUrl,
                  fileName,
                  company: localStorage.getItem("company") ?? "default",
                  driverId: selectedDriver.uid,
                  type: target.type,
                });
              } catch (e) {
                console.error("Storage/Neon 保存に失敗。localStorage にフォールバックします。", e);
                const key = `${keyPrefix}${Date.now()}`;
                localStorage.setItem(key, JSON.stringify({
                  driverName: selectedDriver.name,
                  date: todayStr(),
                  fileName,
                  dataUrl: filledDataUrl,
                }));
              }

              alert("PDFを作成しました");
              reload();
            }}
          >
            作成
          </button>
        </div>

        {/* 一覧（テンプレート） */}
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
                  <button
                    type="button"
                    className="text-blue-600 underline mr-3"
                    onClick={() => {
                      const url = makeObjectUrlIfDataUrl(tpl.dataUrl);
                      setPdfPreview({ open: true, url, title: tpl.name });
                    }}
                  >
                    表示
                  </button>

                  <button
                    className="text-green-600 underline mr-3"
                    onClick={() => openMappingModal(tpl)}
                  >
                    マッピング編集
                  </button>
                  <button
                    className="text-red-600 underline mr-3"
                    onClick={async () => {
                      if (!window.confirm("本当に削除しますか？")) return;
                      try {
                        await apiDelete(`/api/templates/${encodeURIComponent(tpl.key)}`);
                      } catch {
                        localStorage.removeItem(tpl.key);
                      }
                      setTemplates(t => t.filter(tp => tp.key !== tpl.key));
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
                <button
                  type="button"
                  className="text-blue-600 underline ml-2"
                  onClick={() => {
                    const url = makeObjectUrlIfDataUrl(p.dataUrl);
                    setPdfPreview({ open: true, url, title: p.fileName });
                  }}
                >
                  表示
                </button>
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
            <th className="border px-4 py-2">送信</th>
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
                  onClick={async () => {
                    try {
                      const blob = await getBlobFromAnyUrl(z.dataUrl);
                      setSendModal({
                        open: true,
                        fileName: `${z.ym}_${z.driverName}.zip`,
                        blob,
                        to: { uid: "dummy-uid", name: z.driverName },
                      });
                    } catch (e) {
                      console.error(e);
                      alert("ZIPの取得に失敗しました");
                    }
                  }}
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

      {/* ==== PDFプレビューモーダル ==== */}
      {pdfPreview?.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white w-[92vw] h-[92vh] rounded shadow flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">{pdfPreview.title}</h3>
              <div className="flex gap-2">
                <a
                  href={pdfPreview.url}
                  download={pdfPreview.title?.replace(/\.(pdf)?$/i, "") + ".pdf"}
                  className="text-blue-600 underline"
                >
                  ダウンロード
                </a>
                <button
                  className="px-3 py-1 border rounded"
                  onClick={() => {
                    try { if (pdfPreview.url.startsWith("blob:")) URL.revokeObjectURL(pdfPreview.url); } catch {}
                    setPdfPreview(null);
                  }}
                >
                  閉じる
                </button>
              </div>
            </div>
            <iframe src={pdfPreview.url} title="PDF" className="flex-1 w-full" style={{ border: "none" }} />
          </div>
        </div>
      )}
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
