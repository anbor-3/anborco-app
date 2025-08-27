import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireUser(_req);
  await sql`DELETE FROM templates WHERE id = ${Number(params.id)}`;
  return NextResponse.json({ ok: true });
}
