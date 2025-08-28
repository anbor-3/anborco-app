import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { verifyBearer, requireSameCompanyOrAdmin } from "@/lib/authServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await verifyBearer(req);
    const body = await req.json();

    const { company, driverId, type, fileName, url, createdAt } = body ?? {};
    if (!company || !driverId || !type || !fileName || !url) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    await requireSameCompanyOrAdmin(user, company);

    const rows = await sql<{ id: number }[]>`
      INSERT INTO pdfs (company, driver_id, type, file_name, url, created_at)
      VALUES (${company}, ${driverId}, ${type}, ${fileName}, ${url}, ${createdAt ?? new Date().toISOString()})
      RETURNING id;
    `;

    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "bad request" }, { status: 400 });
  }
}
