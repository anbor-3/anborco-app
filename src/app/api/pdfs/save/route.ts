import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function POST(req: NextRequest) {
  await requireUser(req);
  const { company, driverId, type, fileName, url, createdAt } = await req.json();
  if (!company || !driverId || !type || !fileName || !url) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  await sql`
    INSERT INTO pdfs (company, driver_id, type, file_name, url, created_at)
    VALUES (${company}, ${driverId}, ${type}, ${fileName}, ${url},
            ${createdAt ? sql`${createdAt}::timestamptz` : sql`now()`})
  `;
  return NextResponse.json({ ok: true });
}
