import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Vercel Blob を使う場合は有効化（任意）
// import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: { id: string }}) {
  const projectId = Number(ctx.params.id);
  if (!projectId) return NextResponse.json({ error: "invalid project id" }, { status: 400 });

  const form = await req.formData();
  const files = form.getAll("files") as File[];
  if (!files || files.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  // ===== 方式 A: DB にメタデータのみ保存（URL は未確定のため # を入れる） =====
  // 実運用では S3 / Vercel Blob にアップロードし、返却 URL を DB に保存してください。
  const nowISO = new Date().toISOString();
  const out: any[] = [];
  for (const f of files) {
    // // 方式 B: Vercel Blob に保存する例（任意）
    // const blob = await put(`projects/${projectId}/${Date.now()}-${f.name}`, f, { access: "public" });
    const url = "#"; // const url = blob.url;

    const rows = await sql<any[]>`
      INSERT INTO attachments (project_id, name, url, size, type, uploaded_at)
      VALUES (${projectId}, ${f.name}, ${url}, ${Number(f.size)}, ${f.type || ""}, NOW())
      RETURNING name, url, size, type, to_char(uploaded_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as uploaded_at
    `;
    const r = rows[0];
    out.push({ name: r.name, url: r.url, size: Number(r.size||0), type: r.type || "", uploadedAt: r.uploaded_at || nowISO });
  }

  return NextResponse.json(out, { status: 200 });
}
