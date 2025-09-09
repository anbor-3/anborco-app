import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

type ProjectRow = {
  id: number;
  company: string;
  manager: string;
  phone: string;
  name: string;
  contract_start: string | null;
  contract_end: string | null;
  unit_price: number;
  start_time: string;
  end_time: string;
  payment_date: string;
  transfer_date: string;
  required_people: string;
  required_unit: string;
  custom_fields: any;
};

type Attachment = {
  id: string;
  project_id: number;
  name: string;
  url: string;
  size: number | null;
  type: string | null;
  uploaded_at: string;
};

export async function GET(req: NextRequest) {
  const company = req.nextUrl.searchParams.get("company") || "";
  if (!company) {
    return NextResponse.json({ error: "Missing company" }, { status: 400 });
  }

  // 1) projects
  const rows = await sql<ProjectRow[]>`
    SELECT id, company, manager, phone, name,
           to_char(contract_start, 'YYYY-MM-DD') AS contract_start,
           to_char(contract_end,   'YYYY-MM-DD') AS contract_end,
           unit_price, start_time, end_time, payment_date, transfer_date,
           required_people, required_unit, custom_fields
    FROM projects
    WHERE company = ${company}
    ORDER BY id ASC
  `;

  const ids = rows.map(r => r.id);
  let atts: Attachment[] = [];
  if (ids.length) {
    atts = await sql<Attachment[]>`
      SELECT id::text, project_id, name, url, size, type,
             to_char(uploaded_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as uploaded_at
      FROM attachments
      WHERE project_id = ANY(${ids}::int[])
      ORDER BY id ASC
    `;
  }

  const byProject = new Map<number, Attachment[]>();
  for (const a of atts) {
    if (!byProject.has(a.project_id)) byProject.set(a.project_id, []);
    byProject.get(a.project_id)!.push(a);
  }

  const result = rows.map(r => ({
    id: r.id,
    company: r.company,
    manager: r.manager,
    phone: r.phone,
    name: r.name,
    contractStart: r.contract_start || "",
    contractEnd:   r.contract_end   || "",
    unitPrice: r.unit_price,
    startTime: r.start_time,
    endTime:   r.end_time,
    paymentDate:  r.payment_date,
    transferDate: r.transfer_date,
    requiredPeople: r.required_people,
    requiredUnit:   r.required_unit,
    customFields: r.custom_fields || {},
    attachments: byProject.get(r.id)?.map(a => ({
      name: a.name, url: a.url, size: Number(a.size||0), type: a.type || "", uploadedAt: a.uploaded_at
    })) || []
  }));

  return NextResponse.json(result, { status: 200 });
}
