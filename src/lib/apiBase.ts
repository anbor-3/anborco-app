// src/lib/apiBase.ts
/* 共通の API 基点 & URL ユーティリティ（Next / Vite 両対応） */

type AnyEnv = Record<string, any>;

const fromNext =
  (typeof process !== "undefined" &&
    (process as AnyEnv)?.env?.NEXT_PUBLIC_API_BASE) ||
  "";

const fromVite =
  (typeof import.meta !== "undefined" &&
    (import.meta as AnyEnv)?.env?.VITE_API_BASE_URL) ||
  "";

/** .env の値を正規化（末尾スラッシュ除去） */
function normalizeBase(s: string) {
  return String(s || "").trim().replace(/\/+$/, "");
}

/** もっとも優先される API 基点（空文字可） */
export const API_BASE = normalizeBase(fromNext || fromVite);

/** base と path を安全結合（スラッシュ重複/欠落を吸収） */
export function joinURL(base: string, path: string) {
  if (!base) {
    // base 未設定なら、そのまま相対パスを返す（ローカル/Previewでも使える）
    return path.startsWith("/") ? path : `/${path}`;
  }
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

/**
 * 最終的に叩く URL を作る。
 * - Production で base が空なら throw（相対 URL で別オリジンに飛ぶ事故を防止）
 * - Development/Preview は base 未設定でも相対で許容
 */
export function apiURL(path: string) {
  const isProd =
    (typeof process !== "undefined" &&
      (process as AnyEnv)?.env?.NODE_ENV === "production") ||
    (typeof import.meta !== "undefined" &&
      (import.meta as AnyEnv)?.env?.MODE === "production");

  if (isProd && typeof window !== "undefined" && !API_BASE) {
    // ここで 1 回だけ明確に止める
    throw new Error(
      "NEXT_PUBLIC_API_BASE / VITE_API_BASE_URL が本番で未設定です"
    );
  }
  return joinURL(API_BASE, path);
}
