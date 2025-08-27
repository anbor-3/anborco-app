import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  await requireUser(req);
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";
  const ym = searchParams.get("ym"); // 'YYYY-MM'

  if (!company) return NextResponse.json([], { status: 200 });

  const rows = await sql<{
    id: number;
    file_name: string;
    url: string;
    created_at: string;
    driver_name: string | null;
  }[]>`
    SELECT p.id, p.file_name, p.url, p.created_at,
           COALESCE(d.name, au.name, '') AS driver_name
      FROM pdfs p
 LEFT JOIN drivers d   ON d.id::text = p.driver_id
 LEFT JOIN app_users au ON au.firebase_uid = p.driver_id
     WHERE p.company = ${company}
       ${ym ? sql`AND to_char(p.created_at,'YYYY-MM') = ${ym}` : sql``}
  ORDER BY p.created_at DESC`;

  const payload = rows.map(r => ({
    key: String(r.id),
    driverName: r.driver_name || "",
    date: r.created_at.substring(0, 10),
    fileName: r.file_name,
    dataUrl: r.url, // front expects the field name `dataUrl`
  }));

  return NextResponse.json(payload);
}
