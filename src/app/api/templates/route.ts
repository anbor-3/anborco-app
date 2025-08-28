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
      id: number; type: string; name: string; data_url: string; map: any; created_at: string;
    }[]>`
      SELECT id, type, name, data_url, map, created_at
      FROM templates
      WHERE company = ${company}
      ORDER BY created_at DESC, id DESC;
    `;

    const list = rows.map(r => ({
      key: String(r.id),
      name: r.name,
      type: r.type as any,
      date: new Date(r.created_at).toISOString().slice(0, 10),
      dataUrl: r.data_url,
      map: r.map ?? {},
    }));

    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "bad request" }, { status: 400 });
  }
}
