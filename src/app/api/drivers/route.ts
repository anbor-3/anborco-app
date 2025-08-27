import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  await requireUser(req);
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";
  if (!company) return NextResponse.json([], { status: 200 });

  const rows = await sql<{
    id: string; name: string; contract_type: string | null; company_name: string;
  }[]>`
    SELECT d.id::text AS id, d.name, d.contract_type, c.name AS company_name
      FROM drivers d
      JOIN companies c ON c.id = d.company_id
     WHERE c.name = ${company}
  ORDER BY d.created_at DESC`;

  const payload = rows.map(r => ({
    uid: r.id,
    name: r.name,
    contractType: r.contract_type || "",
    company: r.company_name,
  }));

  return NextResponse.json(payload);
}
