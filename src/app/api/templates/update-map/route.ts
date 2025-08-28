import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { verifyBearer } from "@/lib/authServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await verifyBearer(req);
    const { key, map } = await req.json();
    if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

    await sql`
      UPDATE templates SET map = ${JSON.stringify(map ?? {})}::jsonb
      WHERE id = ${Number(key)}
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "bad request" }, { status: 400 });
  }
}
