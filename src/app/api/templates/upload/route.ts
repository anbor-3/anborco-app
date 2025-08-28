import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { verifyBearer, requireSameCompanyOrAdmin } from "@/lib/authServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const u = await verifyBearer(req);
    const { company, type, name, dataUrl, map } = await req.json();

    if (!company || !type || !name || !dataUrl) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    await requireSameCompanyOrAdmin(u, company);

    const rows = await sql<{ id: number; created_at: string }[]>`
      INSERT INTO templates (company, type, name, data_url, map)
      VALUES (${company}, ${type}, ${name}, ${dataUrl}, ${JSON.stringify(map ?? {})}::jsonb)
      RETURNING id, created_at;
    `;

    const saved = {
      key: String(rows[0].id),
      name,
      type,
      date: new Date(rows[0].created_at).toISOString().slice(0, 10),
      dataUrl,
      map: map ?? {},
    };

    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "bad request" }, { status: 400 });
  }
}
