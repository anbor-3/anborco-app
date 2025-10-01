// src/AdminFileManager.tsx —— 差し替え版（全文）
"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PO_PDF  from "@/assets/発注書テンプレート.pdf?url";
import PS_PDF  from "@/assets/支払明細書テンプレート.pdf?url";
import INV_PDF from "@/assets/請求書テンプレート.pdf?url";
import ConfirmSendModal from "./components/ConfirmSendModal";
import type { Driver } from "./AdminDriverManager";
import { getAuth } from "firebase/auth";
import { apiURL } from "@/lib/apiBase";
import { auth, storage } from "./firebaseClient";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

/** ヘッダーは常にプレーン連想配列に統一（型赤線対策） */
type PlainHeaders = Record<string, string>;

/** JSON フェッチ（415: 非JSON検出・Accept付与・credentials付き） */
async function apiJSON<T>(
  path: string,
  init?: Omit<RequestInit, "headers"> & { headers?: PlainHeaders }
): Promise<T> {
  const res = await fetch(apiURL(path), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status} at ${path}\n${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`Expected JSON but got "${ct || "unknown"}" from ${path}\n${text.slice(0, 200)}`);
    err.status = 415;
    throw err;
  }
  return res.json();
}

/** ID トークンを Authorization に載せる */
async function authHeader(): Promise<PlainHeaders> {
  try {
    const idToken = await getAuth().currentUser?.getIdToken?.();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  } catch {
    return {};
  }
}

/* =================================================================================
   ■ 既定マップ / 同義語・自動推測
================================================================================= */
export type TemplateType = "発注書" | "支払明細書" | "請求書";

interface Template {
  key: string;           // 会社+種別で一意（ローカルは決定キー）
  name: string;
  type: TemplateType;
  date: string;
  dataUrl: string;
  map?: Record<string, string>;
  hash?: string;         // PDF 内容ハッシュ（重複防止用）
}

interface PdfItem {
  key: string;
  driverName: string;
  date: string;
  fileName: string;
  dataUrl: string; // サーバならURLでもOK
}

interface ZipItem {
  key: string;
  driverName: string;
  ym: string;
  dataUrl: string;
}

;(globalThis as any).DEFAULT_MAPS_ALIAS ??= { PO:{}, PS:{}, INV:{} };

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

function getDefaultMapByType(t: TemplateType | "PO" | "PS" | "INV"): Record<string, string> {
  switch (t) {
    case "発注書": case "PO":   return DEFAULT_MAPS["発注書"];
    case "支払明細書": case "PS": return DEFAULT_MAPS["支払明細書"];
    case "請求書": case "INV":  return DEFAULT_MAPS["請求書"];
    default: return {};
  }
}

const SYNONYMS: Record<string, string> = {
  "{{ドライバー名}}": "name",
  "{{name}}": "name",
  "{{会社名}}": "company",
  "{{company}}": "company",
  "{{電話}}": "phone",
  "{{tel}}": "phone",
  "{{住所}}": "address",
  "{{請求先}}": "company",
  "{{請求対象名}}": "name",
  "{{合計配達数}}": "実績_totalDeliveries",
  "{{総稼働時間}}": "実績_totalHours",
  "{{走行距離}}": "実績_totalDistance",
  "{{支払総額}}": "実績_totalPay",
  "{{小計}}": "実績_subtotal",
  "{{税額}}": "実績_tax",
  "{{合計}}": "実績_total",
  "{{today}}": "{{today}}",
  "{{発注No}}": "{{発注No}}",
  "{{担当者}}": "{{担当者}}",
};

function autoGuessMapping(base: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...base };
  for (const ph of Object.keys(out)) {
    if (!out[ph] || String(out[ph]).trim() === "") {
      if (ph in SYNONYMS) out[ph] = SYNONYMS[ph];
    }
  }
  return out;
}

/* =================================================================================
   ■ API helpers（Auth 付き）
================================================================================= */
async function apiGet<T>(path: string): Promise<T> {
  return apiJSON<T>(path, { headers: await authHeader() });
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  return apiJSON<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
}

async function apiDelete(path: string): Promise<void> {
  await apiJSON(path, { method: "DELETE", headers: await authHeader() });
}

/* =================================================================================
   ■ PDF 保存（Storage -> URL -> Neon）
================================================================================= */
async function savePdfToStorageAndNeon(params: {
  dataUrl: string;
  fileName: string;
  company: string;
  driverId: string;
  type: "発注書" | "支払明細書" | "請求書";
}) {
  const { dataUrl, fileName, company, driverId, type } = params;
  const safe = (s: string) => String(s).replace(/[\/#?]/g, "_");

  const storagePath  = `pdfs/${safe(company)}/${safe(driverId)}/${safe(type)}/${safe(fileName)}`;
  const sref         = ref(storage, storagePath);
  await uploadString(sref, dataUrl, "data_url", { contentType: "application/pdf" });
  const url = await getDownloadURL(sref);

  const idToken = await auth.currentUser?.getIdToken?.();
  if (!idToken) throw new Error("未ログインです");

  const r = await fetch(apiURL("/api/pdfs/save"), {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ company, driverId, type, fileName, url, createdAt: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`POST /api/pdfs/save -> ${r.status}`);
}

/* =================================================================================
   ■ ユーティリティ
================================================================================= */
const todayStr = () => new Date().toISOString().split("T")[0];

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "";
  const bstr = atob(arr[1] || "");
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new Blob([u8], { type: mime || "application/pdf" });
}

/** dataUrl/URL → Blob */
async function getBlobFromAnyUrl(src: string): Promise<Blob> {
  if (typeof src === "string" && src.startsWith("data:")) return dataURLtoBlob(src);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return await res.blob();
}

/** PDF dataUrl の SHA-256（サーバ重複/ローカル上書きの判定に使用） */
async function sha256Base64DataUrl(dataUrl: string): Promise<string> {
  try {
    const b = dataURLtoBlob(dataUrl);
    const buf = await b.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return b64;
  } catch {
    // Fallback: 先頭&末尾 1KB から簡易ハッシュ
    const s = dataUrl.slice(0, 1024) + "|" + dataUrl.slice(-1024);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return String(h);
  }
}

/** 同一会社で「種別×ハッシュ」をキーに重複排除（サーバ/ローカル混在でもOK） */
function dedupeTemplates(input: Template[]): Template[] {
  const seen = new Map<string, Template>(); // key: type@hash or type@_nohash (fallback)
  for (const t of input) {
    const k = `${t.type}@${t.hash || "_nohash"}`;
    // 既存が無ければ採用。既存があっても date が新しい方を採用（サーバ優先）
    const prev = seen.get(k);
    if (!prev) {
      seen.set(k, t);
    } else {
      const p = Date.parse(prev.date || "");
   const c = Date.parse(t.date || "");
   if (Number.isFinite(c) && Number.isFinite(p)) {
     if (c >= p) seen.set(k, t);
   }
   // date が空などで比較不能なら既存を維持（＝最初の1件を採用）
    }
  }
  return Array.from(seen.values());
}

/** ローカル保存キー（会社×種別で決定） */
const localTplKey = (company: string, type: TemplateType) => `tpl_${company}_${type}`;

/* =================================================================================
   ■ コンポーネント
================================================================================= */
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
  const [driverList, setDriverList] = useState<Driver[]>([]);

  // PDFプレビュー
  const [pdfPreview, setPdfPreview] =
    useState<{ open: boolean; url: string; title: string } | null>(null);

  const company = (typeof window !== "undefined" ? localStorage.getItem("company") : "") || "default";

  function makeObjectUrlIfDataUrl(src: string): string {
    try {
      if (typeof src === "string" && src.startsWith("data:application/pdf")) {
        return URL.createObjectURL(dataURLtoBlob(src));
      }
      return src;
    } catch { return src; }
  }

  /* ---------------- ドライバー取得（共有） ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const list = await apiGet<Driver[]>(`/api/drivers?company=${encodeURIComponent(company)}`);
        setDriverList(list || []);
      } catch (e) {
        console.warn("drivers API 取得失敗。localStorageへフォールバック", e);
        const raw = localStorage.getItem(`driverList_${company}`);
        if (raw) {
          try { setDriverList(JSON.parse(raw)); } catch {}
        }
      }
    })();
  }, [company]);

  /* ---------------- 画面ロック（モーダル時） ---------------- */
  useEffect(() => {
    const lock = (pdfPreview?.open);
    if (lock) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [pdfPreview]);

  /* ---------------- 初期テンプレ投入（会社単位・重複回避） ---------------- */
  useEffect(() => {
    (async () => {
      const initializedKey = `defaultTemplatesInitialized_${company}`;
      if (localStorage.getItem(initializedKey)) return;

      // すでにサーバに当該会社のテンプレが揃っていれば何もしない
      try {
        const serverTemplates = await apiGet<Template[]>(`/api/templates?company=${encodeURIComponent(company)}`);
        const types = new Set(serverTemplates?.map(t => t.type) || []);
        if (types.has("発注書") && types.has("支払明細書") && types.has("請求書")) {
          localStorage.setItem(initializedKey, "true");
          return;
        }
      } catch {
        // サーバ取れない場合はローカルを確認
        const hasLocalAll =
          !!localStorage.getItem(localTplKey(company, "発注書")) &&
          !!localStorage.getItem(localTplKey(company, "支払明細書")) &&
          !!localStorage.getItem(localTplKey(company, "請求書"));
        if (hasLocalAll) {
          localStorage.setItem(initializedKey, "true");
          return;
        }
      }

      // 会社テンプレとして投入（ハッシュ付き・アップサート）
      const defs = [
        { type: "発注書" as const,     name: "発注書テンプレート.pdf",     url: PO_PDF },
        { type: "支払明細書" as const, name: "支払明細書テンプレート.pdf", url: PS_PDF },
        { type: "請求書" as const,     name: "請求書テンプレート.pdf",     url: INV_PDF },
      ];

      const created: Template[] = [];
      for (const { type, name, url } of defs) {
        // URL → dataUrl
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
        const hash = await sha256Base64DataUrl(dataUrl);
        const map = getDefaultMapByType(type);

        // サーバにアップサート（idempotencyKey で重複防止）
        try {
          const saved = await apiPost<Template>("/api/templates/upload", {
            company,
            type,
            name,
            dataUrl,
            map,
            hash,
            idempotencyKey: `${company}:${type}:${hash}`,
            upsert: true,             // ← サーバ側が対応していれば上書き
          });
          created.push(saved);
        } catch {
          // ローカルは会社×種別をキーに**上書き保存**（重複しない）
          const key = localTplKey(company, type);
          const tpl: Template = { key, name, type, date: todayStr(), dataUrl, map, hash };
          localStorage.setItem(key, JSON.stringify(tpl));
          created.push(tpl);
        }
      }

      // 既存と合流して重複排除
      setTemplates((prev) => dedupeTemplates([...created, ...prev]));
      localStorage.setItem(initializedKey, "true");
    })();
  }, [company]);

  /* ---------------- 一覧リロード（サーバ優先 → ローカル補完） ---------------- */
  const reload = async () => {
    const ymPrefix = new Date().toISOString().slice(0, 7);

    // Templates
    let merged: Template[] = [];
    try {
      const tpl = await apiGet<Template[]>(`/api/templates?company=${encodeURIComponent(company)}`);
      merged = tpl || [];
    } catch {
      // no-op
    }
    // ローカル（決定キー）を合流
    for (const t of ["発注書","支払明細書","請求書"] as const) {
      const raw = localStorage.getItem(localTplKey(company, t));
      if (raw) {
        try { merged.push(JSON.parse(raw)); } catch {}
      }
    }
    // 旧キー（tpl_...）が残っていた場合も拾って後方互換（ただし会社キーが優先）
    Object.entries(localStorage).forEach(([k, v]) => {
      if (/^tpl_(発注書|支払明細書|請求書)/.test(k)) {
        try { merged.push({ key: k, ...JSON.parse(String(v)) } as Template); } catch {}
      }
    });
    // 可能ならハッシュを埋める（無いもののみ）
    for (const t of merged) {
      if (!t.hash && t.dataUrl?.startsWith("data:")) {
        try { t.hash = await sha256Base64DataUrl(t.dataUrl); } catch {}
      }
    }
    setTemplates(dedupeTemplates(merged));

    // PDFs（当月）
    try {
      const arr = await apiGet<PdfItem[]>(`/api/pdfs?company=${encodeURIComponent(company)}&ym=${ymPrefix}`);
      setPdfs(arr || []);
    } catch {
      const arr: PdfItem[] = Object.entries(localStorage)
        .filter(([k]) => (k.startsWith("po_") || k.startsWith("ps_") || k.startsWith("inv_")) && k.includes(ymPrefix))
        .map(([k, v]) => ({ key: k, ...JSON.parse(v as string) }));
      setPdfs(arr);
    }

    // ZIPs
    try {
      const zipArr = await apiGet<ZipItem[]>(`/api/zips?company=${encodeURIComponent(company)}`);
      setZips(zipArr || []);
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
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [company]);

  /* ---------------- テンプレアップロード（会社×種別で上書き・重複防止） ---------------- */
  const handleUpload = () => {
    if (!tplFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        if (!result.startsWith("data:application/pdf;base64,")) {
          alert("無効なPDFファイルです（base64形式でない）");
          return;
        }
        const name = tplFile.name.replace(/\.(pdf)$/i, "");
        const initialMap = getDefaultMapByType(tplType);
        const hash = await sha256Base64DataUrl(result);

        // サーバにアップサート（idempotencyKey で重複防止）
        try {
          const saved = await apiPost<Template>("/api/templates/upload", {
            company, type: tplType, name, dataUrl: result, map: initialMap, hash,
            idempotencyKey: `${company}:${tplType}:${hash}`,
            upsert: true,
          });
          // 最新で置換
          setTemplates(prev => dedupeTemplates([saved, ...prev.filter(t => !(t.type === tplType))]));
        } catch {
          // ローカルは決定キーへ上書き
          const key = localTplKey(company, tplType);
          const newTpl: Template = { key, name, type: tplType, date: todayStr(), dataUrl: result, map: initialMap, hash };
          localStorage.setItem(key, JSON.stringify(newTpl));
          setTemplates(prev => dedupeTemplates([newTpl, ...prev.filter(t => !(t.type === tplType))]));
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

  /* ---------------- ZIP 削除 ---------------- */
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

  /* ---------------- 実績・マッピング ---------------- */
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

    // 発注No（会社単位カウンタ）
    const noKey = `poCounter_${company}`;
    let nextNo: number;
    try {
      const data = await apiGet<{ next: number }>(`/api/counters/next?type=po&company=${encodeURIComponent(company)}`);
      nextNo = data.next;
    } catch {
      const current = parseInt(localStorage.getItem(noKey) || "0");
      nextNo = current + 1;
      localStorage.setItem(noKey, String(nextNo));
    }
    result["{{発注No}}"] = String(nextNo).padStart(4, "0");

    // 担当者・日付
    const adminsA = JSON.parse(localStorage.getItem(`adminList_${company}`) || "[]");
const adminsB = JSON.parse(localStorage.getItem("adminMaster") || "[]");
const admins  = Array.isArray(adminsA) && adminsA.length > 0 ? adminsA : adminsB;

const loggedIn = admins.find((a: any) => a.loginId === localStorage.getItem("loginId"));
    result["{{担当者}}"] = loggedIn?.name || "";
    result["{{today}}"] = todayStr();

    // ドライバー項目
    Object.entries(baseMap).forEach(([placeholder, driverField]) => {
      if (!placeholder.startsWith("{{") || placeholder in result) return;
      if (typeof driverField === "string" && driverField.startsWith("実績_")) return;
      // @ts-ignore
      result[placeholder] = (driver as any)[driverField] ?? "";
    });

    // 実績項目
    const achievements = getDriverAchievements((driver as any).uid, todayStr());
    Object.entries(baseMap).forEach(([placeholder, mappedKey]) => {
      if (typeof mappedKey !== "string" || !mappedKey.startsWith("実績_")) return;
      const key = mappedKey.replace("実績_", "");
      result[placeholder] = achievements[key] ?? "";
    });

    // 金額系
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
    if (!templateDataUrl?.startsWith("data:application/pdf;base64,")) {
      console.warn("invalid template data url");
      return templateDataUrl;
    }
    const base64Body = templateDataUrl.split(",")[1];
    let content = atob(base64Body);
    for (const [placeholder, value] of Object.entries(finalValues)) {
      try {
        content = content.replaceAll(placeholder, String(value ?? ""));
      } catch {
        const re = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
        content = content.replace(re, String(value ?? ""));
      }
    }
    return `data:application/pdf;base64,${btoa(content)}`;
  }

  /* ---------------- マッピング編集モーダル ---------------- */
  const [mapKey,       setMapKey]       = useState<string|null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [mapping,      setMapping]      = useState<Record<string,string>>({});

  function openMappingModal(tpl: Template) {
    const base = (tpl.map && Object.keys(tpl.map).length > 0) ? tpl.map! : getDefaultMapByType(tpl.type);
    setMapKey(tpl.key);
    setPlaceholders(Object.keys(base));
    setMapping(base);
  }

  async function saveMapping() {
    if (!mapKey) return;
    try {
      await apiPost("/api/templates/update-map", { key: mapKey, map: mapping });
    } catch {
      // ローカル上書き
      const raw = localStorage.getItem(mapKey);
      if (raw) {
        const meta = JSON.parse(raw);
        localStorage.setItem(mapKey, JSON.stringify({ ...meta, map: mapping }));
      } else {
        setTemplates(prev => prev.map(t => (t.key === mapKey ? { ...t, map: mapping } : t)));
      }
    }
    setMapKey(null);
    reload();
  }

  /* ---------------- 画面 ---------------- */
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        🖨️ファイル管理<span className="text-sm text-gray-500"> - FileManager -</span>
      </h1>

      {/* ========== テンプレート管理 ========== */}
      <div className="mb-10 border p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-3">📑 テンプレート管理（会社共有・重複防止）</h2>

        <div className="flex items-center gap-2 mb-4">
          <select value={tplType} onChange={e => setTplType(e.target.value as any)} className="border px-2 py-1 rounded">
            <option value="発注書">発注書 (PO)</option>
            <option value="支払明細書">支払明細書 (PS)</option>
            <option value="請求書">請求書 (INV)</option>
          </select>

          <input type="file" accept="application/pdf" onChange={e => setTplFile(e.target.files?.[0] ?? null)} />

          <button
            className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
            disabled={!tplFile}
            onClick={handleUpload}
          >
            アップロード（上書き）
          </button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-gray-600">📌 帳票作成対象のドライバー：</label>
          <select
            className="border px-2 py-1 rounded"
            value={selectedDriver?.uid ?? ""}
            onChange={e => {
              const selected = driverList.find(d => (d as any).uid === e.target.value);
              setSelectedDriver(selected ?? null);
            }}
          >
            <option value="">-- 選択してください --</option>
            {driverList.map(d => (
              <option key={(d as any).uid} value={(d as any).uid}>
                {d.name}（{(d as any).contractType}）
              </option>
            ))}
          </select>

          <select className="border px-2 py-1 rounded" value={currentTab} onChange={e => setCurrentTab(e.target.value as any)}>
            <option value="PO">発注書</option>
            <option value="PS">支払明細書</option>
            <option value="INV">請求書</option>
          </select>

          <button
            className="bg-indigo-600 text-white px-4 py-1 rounded"
            onClick={async () => {
              if (!selectedDriver) { alert("ドライバーを選択してください"); return; }

              // 種別→テンプレ選択（同種別の最新を採用）
              const type = currentTab === "PO" ? "発注書" : currentTab === "PS" ? "支払明細書" : "請求書";
              const candidates = templates.filter(t => t.type === type);
              if (candidates.length === 0) { alert("該当テンプレートが見つかりません"); return; }
              const target = candidates.sort((a,b) => Date.parse(b.date) - Date.parse(a.date))[0];

              const base = (target.map && Object.keys(target.map).length > 0) ? target.map! : getDefaultMapByType(target.type);
              const guessed = autoGuessMapping(base);
              const finalValues = await buildFinalMapping(guessed, selectedDriver);
              await ensureRequiredInputs(target.type, finalValues);

              const filledDataUrl = applyDriverMapping(target.dataUrl, finalValues);

              const fileName = `${todayStr()}_${selectedDriver.name}_${target.type}.pdf`;
              const keyPrefix = currentTab === "PO" ? "po_" : currentTab === "PS" ? "ps_" : "inv_";

              try {
                await savePdfToStorageAndNeon({
                  dataUrl: filledDataUrl,
                  fileName,
                  company,
                  driverId: (selectedDriver as any).uid,
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

                  <button className="text-green-600 underline mr-3" onClick={() => openMappingModal(tpl)}>
                    マッピング編集
                  </button>

                  <button
                    className="text-red-600 underline mr-3"
                    onClick={async () => {
                      if (!window.confirm("本当に削除しますか？")) return;
                      try {
                        await apiDelete(`/api/templates/${encodeURIComponent(tpl.key)}`);
                      } catch {
                        // ローカル決定キーの削除
                        if (tpl.type) localStorage.removeItem(localTplKey(company, tpl.type));
                        // レガシーキーも削除試行
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
          </tbody>
        </table>
      </div>

      {/* ==== 当月 PDF 一覧 ==== */}
      <h2 className="text-lg font-bold mt-8 mb-2 text-slate-900">📄 当月提出 PDF</h2>
<table className="table-auto w-full border mb-8 text-slate-900">
  <thead className="bg-gray-100 text-slate-900">
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
                <a href={p.dataUrl} download={p.fileName} className="text-blue-600 underline">DL</a>
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
                <a href={z.dataUrl} download={`${z.ym}_${z.driverName}.zip`} className="text-blue-600 underline">
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
            <tr><td colSpan={5} className="text-center py-4">過去 ZIP はありません。</td></tr>
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
 <p className="text-sm text-gray-500 mb-4">※年次ZIPの一覧は現在準備中です。</p>

      {/* ==== PDFプレビューモーダル ==== */}
      {pdfPreview?.open && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
          <div className="bg-white w-[92vw] h-[92vh] rounded shadow flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">{pdfPreview.title}</h3>
              <div className="flex gap-3 items-center">
                <a
                  href={pdfPreview.url}
                  download={(pdfPreview.title || "preview").replace(/\.(pdf)?$/i, "") + ".pdf"}
                  className="text-blue-600 underline"
                >
                  ダウンロード
                </a>
                <a href={pdfPreview.url} target="_blank" rel="noreferrer" className="text-gray-600 underline">
                  新しいタブで開く
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
        </div>,
        document.body
      )}

      {/* ==== マッピング編集モーダル ==== */}
      {mapKey && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center">
          <div className="bg-white w-[92vw] max-w-5xl h-[88vh] rounded-xl shadow-2xl flex flex-col">
            <div className="px-4 h-12 border-b flex items-center justify-between">
              <h3 className="font-semibold">マッピング編集</h3>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 bg-gray-200 rounded"
                  onClick={() => {
                    const key = window.prompt("追加するプレースホルダー名（例：{{foo}}）", "");
                    if (!key) return;
                    setPlaceholders(prev => (prev.includes(key) ? prev : [...prev, key]));
                    setMapping(prev => ({ ...prev, [key]: prev[key] ?? "" }));
                  }}
                >
                  ＋ 追加
                </button>

                <button
                  className="px-3 py-1 bg-indigo-600 text-white rounded"
                  onClick={() => setMapping(prev =>
                    autoGuessMapping(Object.fromEntries(placeholders.map(k => [k, prev[k] ?? ""])))
                  )}
                >
                  自動推測で埋める
                </button>

                <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setMapKey(null)}>閉じる</button>
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={saveMapping}>保存</button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1">
              <table className="table-auto w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-1 w-1/2">プレースホルダー（PDF側）</th>
                    <th className="border px-2 py-1">アプリの項目キー（例：name / address / 実績_totalPay など）</th>
                  </tr>
                </thead>
                <tbody>
                  {placeholders.map(ph => (
                    <tr key={ph}>
                      <td className="border px-2 py-1 font-mono text-xs">{ph}</td>
                      <td className="border px-2 py-1">
                        <input
                          className="w-full border rounded px-2 py-1"
                          value={mapping[ph] ?? ""}
                          onChange={e => setMapping(prev => ({ ...prev, [ph]: e.target.value }))}
                          placeholder="例）name / company / 実績_totalPay"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-xs text-gray-500 mt-3">
                ※ 実績系は <code>実績_</code> プレフィックスで紐づけ（例：<code>実績_totalHours</code>）。保存後、「作成」で反映されます。
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
