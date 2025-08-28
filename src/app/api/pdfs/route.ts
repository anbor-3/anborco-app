import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { verifyBearer, requireSameCompanyOrAdmin } from "@/lib/authServer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const u = await verifyBearer(req);
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company") || "";
    const ym = searchParams.get("ym") || ""; // "YYYY-MM"
    if (!company || !ym) {
      return NextResponse.json({ error: "missing query" }, { status: 400 });
    }

    await requireSameCompanyOrAdmin(u, company);

    const rows = await sql<{
      id: number;
      created_at: string;
      file_name: string;
      url: string;
      driver_id: string;
    }[]>`
      SELECT id, created_at, file_name, url, driver_id
      FROM pdfs
      WHERE company = ${company}
        AND to_char(created_at, 'YYYY-MM') = ${ym}
      ORDER BY created_at DESC
      LIMIT 500;
    `;

    // フロントの期待shapeに寄せる（driverName は暫定で driver_id）
    const list = rows.map(r => ({
      key: String(r.id),
      driverName: r.driver_id,
      date: new Date(r.created_at).toISOString().slice(0, 10),
      fileName: r.file_name,
      dataUrl: r.url,
    }));

    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "bad request" }, { status: 400 });
  }
}
