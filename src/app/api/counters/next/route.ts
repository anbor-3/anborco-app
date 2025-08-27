import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  await requireUser(req);
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";
  const type = searchParams.get("type") || "po";
  if (!company) return NextResponse.json({ error: "missing company" }, { status: 400 });

  const rows = await sql<{ value: string }[]>`
    INSERT INTO counters (company, counter_type, value)
    VALUES (${company}, ${type}, 1)
    ON CONFLICT (company, counter_type)
    DO UPDATE SET value = counters.value + 1
    RETURNING value::text
  `;
  return NextResponse.json({ next: Number(rows[0].value) });
}
