import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const company = req.nextUrl.searchParams.get("company") || "";
  if (!company) return NextResponse.json([], { status: 200 });

  const rows = await sql<{ key: string }[]>`
    SELECT DISTINCT jsonb_object_keys(custom_fields) AS key
    FROM projects
    WHERE company = ${company}
    ORDER BY key
  `;
  return NextResponse.json(rows.map(r => r.key).filter(Boolean), { status: 200 });
}
