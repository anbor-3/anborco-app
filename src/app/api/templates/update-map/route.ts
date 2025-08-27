import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function POST(req: NextRequest) {
  await requireUser(req);
  const { key, map } = await req.json();
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

  await sql`UPDATE templates SET map = ${JSON.stringify(map || {})}::jsonb WHERE id = ${Number(key)}`;
  return NextResponse.json({ ok: true });
}
