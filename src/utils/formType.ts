// src/utils/formType.ts
export type JpType = "発注書" | "支払明細書" | "請求書";
export type EnType = "PO" | "PS" | "INV";

/** PO/PS/INV を日本語へ正規化（すでに日本語ならそのまま返す） */
export function toJpType(t: JpType | EnType): JpType {
  switch (t) {
    case "PO":  return "発注書";
    case "PS":  return "支払明細書";
    case "INV": return "請求書";
    default:    return t as JpType;
  }
}

/** インデックス可能な辞書型 */
type Dict = Record<string, unknown>;

/** 安全にオブジェクトをインデックス（未定義でも落ちない） */
export function safeGet(obj: Dict | undefined | null, t: JpType | EnType): unknown {
  const rec: Dict = obj ?? {};
  return rec[toJpType(t)];
}

/** 数値を安全取得（未定義・非数値なら 0） */
export function safeGetNumber(
  obj: Dict | undefined | null,
  t: JpType | EnType
): number {
  const v = safeGet(obj, t);
  const n =
    typeof v === "number" ? v :
    typeof v === "string" ? Number(v) :
    NaN;
  return Number.isFinite(n) ? n : 0;
}

/** 文字列を安全取得（未定義なら空文字）※必要なら */
export function safeGetString(
  obj: Dict | undefined | null,
  t: JpType | EnType
): string {
  const v = safeGet(obj, t);
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
