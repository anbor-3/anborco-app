import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function POST(req: NextRequest) {
  await requireUser(req);
  const { company, type, name, dataUrl, map = {} } = await req.json();

  if (!company || !type || !name || !dataUrl) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const inserted = await sql<
    { id: number; type: string; name: string; data_url: string; map: any; created_at: string }[]
  >`INSERT INTO templates (company, type, name, data_url, map)
     VALUES (${company}, ${type}, ${name}, ${dataUrl}, ${JSON.stringify(map)}::jsonb)
     RETURNING id, type, name, data_url, map, created_at`;

  const r = inserted[0];
  return NextResponse.json({
    key: String(r.id),
    type: r.type,
    name: r.name,
    dataUrl: r.data_url,
    date: r.created_at,
    map: r.map ?? {},
  });
}
