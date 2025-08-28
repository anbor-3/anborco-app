// src/utils/pdfUtils.ts
import { PDFDocument } from "pdf-lib";

/* --------------------------------------------------
   共通ユーティリティ
-------------------------------------------------- */

/**
 * ① localStorage に保存してある最新テンプレート（AcroForm 付き PDF）
 *    を ArrayBuffer で返す。無ければ null。
 */
export function loadLatestTemplate(
  type: "PO" | "PS" | "INV"
): ArrayBuffer | null {
  // 英語・日本語どちらの保存キーでも拾う
  const prefixes =
    type === "PO"
      ? ["tpl_PO_", "tpl_発注書_"]
      : type === "PS"
      ? ["tpl_PS_", "tpl_支払明細書_"]
      : ["tpl_INV_", "tpl_請求書_"];

  const keys = Object.keys(localStorage)
    .filter((k) => prefixes.some((p) => k.startsWith(p)))
    .sort(); // 時間順に並ぶ

  if (keys.length === 0) return null;

  const raw = localStorage.getItem(keys.at(-1)!);
  if (!raw) return null;

  const meta = JSON.parse(raw);
  const dataUrl: string = meta.dataUrl ?? "";
  // data:URL形式なら先頭を剥がす
  const base64 = dataUrl.startsWith("data:") ? dataUrl.split(",")[1] : dataUrl;
  if (!base64) return null;

  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/**
 * ② ひな型 PDF のフォームフィールドに値を流し込んで
 *    DataURI (data:application/pdf;base64,…) を返す
 */
async function fillTemplate(
  type: "PO" | "PS" | "INV",
  values: Record<string, string | number>
): Promise<string> {
  const tplBuf = loadLatestTemplate(type);
  let pdf: PDFDocument;

  if (tplBuf) {
    pdf = await PDFDocument.load(tplBuf);
  } else {
    // テンプレートが無い場合は白紙 A4 を作成
    pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
  }

  const form = pdf.getForm();

  Object.entries(values).forEach(([k, v]) => {
    try {
      form.getTextField(k).setText(String(v));
    } catch {
      /* フィールド名が無い場合は無視 */
    }
  });

  form.flatten(); // フィールドを固定化

  return pdf.saveAsBase64({ dataUri: true });
}

/* --------------------------------------------------
   1. 発注書（PO）
-------------------------------------------------- */
export async function createPO(
  driverName: string,
  year: number,
  month: number
): Promise<string> {
  return fillTemplate("PO", {
    driverName,
    year,
    month,
  });
}

/* --------------------------------------------------
   2. 支払明細書（PS）
-------------------------------------------------- */
export async function createPS(
  driverName: string,
  year: number,
  month: number,
  hours: number
): Promise<string> {
  return fillTemplate("PS", {
    driverName,
    year,
    month,
    totalHours: hours.toFixed(1),
  });
}

/* --------------------------------------------------
   3. 1 ページ PDF 群を結合してダウンロード
-------------------------------------------------- */
export async function createSinglePDF(
  buffers: ArrayBuffer[],
  fileName: string
) {
  const merged = await PDFDocument.create();

  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const [pg] = await merged.copyPages(src, [0]);
    merged.addPage(pg);
  }

  const bytes = await merged.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
}
/* --------------------------------------------------
   4.  PDF から {{placeholder}} を拾うユーティリティ
       – AcroForm が無くても、単純に {{name}} という
         文字列を検索して返すだけの簡易版
-------------------------------------------------- */
// ▼ 追加：URLでもdata:URLでも扱えるように
async function toDataUrlIfNeeded(src: string): Promise<string> {
  if (src.startsWith("data:application/pdf;base64,")) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch pdf failed: ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// src/utils/pdfUtils.ts（差し替え）
export async function extractPlaceholders(src: string): Promise<string[]> {
  // 1) 必要なら data:URL 化
  const dataUrl = await toDataUrlIfNeeded(src);

  // 2) base64 → バイナリ文字列
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);

  // 3) 見えるASCIIだけ抽出
  let ascii = "";
  for (let i = 0; i < bin.length; i++) {
    const c = bin.charCodeAt(i);
    ascii += c >= 32 && c <= 126 ? bin[i] : " ";
  }

  // 4) {{placeholder}} を収集（スペースは潰す）
  const out = new Set<string>();
  const re = /{{\s*[a-zA-Z0-9_]+\s*}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ascii))) out.add(m[0].replace(/\s+/g, ""));
  return [...out];
}
