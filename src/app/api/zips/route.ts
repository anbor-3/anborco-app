import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { verifyBearer, requireSameCompanyOrAdmin } from "@/lib/authServer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const u = await verifyBearer(req);
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "";
    if (!company) return NextResponse.json({ error: "missing company" }, { status: 400 });

    await requireSameCompanyOrAdmin(u, company);

    const rows = await sql<{
      id: number; driver_id: string; ym: string; file_name: string; url: string;
    }[]>`
      SELECT id, driver_id, ym, file_name, url
      FROM zips
      WHERE company = ${company}
      ORDER BY created_at DESC
      LIMIT 500;
    `;

    const list = rows.map(r => ({
      key: String(r.id),
      driverName: r.driver_id,    // 暫定
      ym: r.ym,
      dataUrl: r.url,
    }));

    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "bad request" }, { status: 400 });
  }
}
