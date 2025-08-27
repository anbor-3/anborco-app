import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  await requireUser(req);
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";
  if (!company) return NextResponse.json([], { status: 200 });

  const rows = await sql<{
    id: number; ym: string; url: string; file_name: string; driver_name: string | null;
  }[]>`
    SELECT z.id, z.ym, z.url, z.file_name,
           COALESCE(d.name, au.name, '') AS driver_name
      FROM zips z
 LEFT JOIN drivers d   ON d.id::text = z.driver_id
 LEFT JOIN app_users au ON au.firebase_uid = z.driver_id
     WHERE z.company = ${company}
  ORDER BY z.created_at DESC`;

  const payload = rows.map(r => ({
    key: String(r.id),
    ym: r.ym,
    driverName: r.driver_name || "",
    dataUrl: r.url,
  }));
  return NextResponse.json(payload);
}
