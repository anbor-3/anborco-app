import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  await requireUser(req);
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";
  if (!company) return NextResponse.json([], { status: 200 });

  const rows = await sql<
    { id: number; type: string; name: string; data_url: string; map: any; created_at: string }[]
  >`SELECT id, type, name, data_url, map, created_at
     FROM templates
     WHERE company = ${company}
     ORDER BY created_at DESC`;

  const payload = rows.map(r => ({
    key: String(r.id),
    type: r.type,
    name: r.name,
    dataUrl: r.data_url,
    date: r.created_at,
    map: r.map ?? {},
  }));

  return NextResponse.json(payload);
}
