import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function DELETE(_req: NextRequest, ctx: { params: { id: string }}) {
  const id = Number(ctx.params.id);
  if (!id || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await sql`DELETE FROM attachments WHERE project_id = ${id}`;
  await sql`DELETE FROM projects WHERE id = ${id}`;
  return NextResponse.json({}, { status: 200 });
}
