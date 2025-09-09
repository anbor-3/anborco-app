import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const bucket = process.env.SUPABASE_BUCKET || "project-files";

export const supa = createClient(url, key, { auth: { persistSession: false } });

export async function uploadBufferToStorage(path: string, buf: Buffer, contentType?: string) {
  const { data, error } = await supa.storage.from(bucket).upload(path, buf, {
    contentType,
    cacheControl: "3600",
    upsert: true
  });
  if (error) throw error;

  const { data: pub } = supa.storage.from(bucket).getPublicUrl(path);
  return pub.publicUrl;
}
