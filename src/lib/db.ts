import { neon } from "@neondatabase/serverless";

const url =
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (!url) throw new Error("NEON_DATABASE_URL などの接続文字列が未設定です。");

export const sql = neon(url);
