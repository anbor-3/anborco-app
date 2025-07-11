// src/utils/pdfUtils.ts
import { PDFDocument, StandardFonts } from "pdf-lib";

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
  const keys = Object.keys(localStorage)
    .filter((k) => k.startsWith(`tpl_${type}_`))
    .sort(); // 時間順に並ぶ

  if (keys.length === 0) return null;

  const meta = JSON.parse(localStorage.getItem(keys.at(-1)!)!); // 最新
  const byteString = atob(meta.dataUrl.split(",")[1]);
  const buf = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) buf[i] = byteString.charCodeAt(i);
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
export async function extractPlaceholders(dataUrl: string): Promise<string[]> {
  // DataURL → ArrayBuffer
  const byteString = atob(dataUrl.split(',')[1]);
  const uint8      = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) uint8[i] = byteString.charCodeAt(i);

  // pdf-lib でテキスト抽出
  const pdf = await PDFDocument.load(uint8.buffer);
  const pages = await Promise.all(
    pdf.getPages().map(async p => (await p.getTextContent()).items.map(i => (i as any).str).join(' '))
  );
  const text = pages.join(' ');

  // {{placeholder}} を全部拾う
  const set = new Set<string>();
  const re  = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) set.add(m[1]);

  return [...set];
}
