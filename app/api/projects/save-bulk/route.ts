import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

type Incoming = {
  company: string;
  projects: any[];
};

export async function POST(req: NextRequest) {
  const { company, projects }: Incoming = await req.json();
  if (!company || !Array.isArray(projects)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const saved: any[] = [];
  for (const p of projects) {
    const base = {
      company,
      manager: p.manager || "",
      phone:   p.phone   || "",
      name:    p.name    || "",
      contract_start: p.contractStart || null,
      contract_end:   p.contractEnd   || null,
      unit_price: Number(p.unitPrice || 0),
      start_time: p.startTime || "08:00",
      end_time:   p.endTime   || "17:00",
      payment_date:  p.paymentDate  || "",
      transfer_date: p.transferDate || "",
      required_people: p.requiredPeople || "0",
      required_unit:   p.requiredUnit   || "名",
      custom_fields: p.customFields || {},
    };

    if (p.id && p.id > 0) {
      // update
      const rows = await sql<any[]>`
        UPDATE projects SET
          manager = ${base.manager},
          phone   = ${base.phone},
          name    = ${base.name},
          contract_start = ${base.contract_start},
          contract_end   = ${base.contract_end},
          unit_price = ${base.unit_price},
          start_time = ${base.start_time},
          end_time   = ${base.end_time},
          payment_date  = ${base.payment_date},
          transfer_date = ${base.transfer_date},
          required_people = ${base.required_people},
          required_unit   = ${base.required_unit},
          custom_fields = ${sql.json(base.custom_fields)}
        WHERE id = ${p.id} AND company = ${company}
        RETURNING id, company, manager, phone, name,
          to_char(contract_start, 'YYYY-MM-DD') AS contract_start,
          to_char(contract_end,   'YYYY-MM-DD') AS contract_end,
          unit_price, start_time, end_time, payment_date, transfer_date,
          required_people, required_unit, custom_fields
      `;
      const r = rows[0];
      saved.push({
        id: r.id, company: r.company, manager: r.manager, phone: r.phone, name: r.name,
        contractStart: r.contract_start || "", contractEnd: r.contract_end || "",
        unitPrice: r.unit_price, startTime: r.start_time, endTime: r.end_time,
        paymentDate: r.payment_date, transferDate: r.transfer_date,
        requiredPeople: r.required_people, requiredUnit: r.required_unit,
        customFields: r.custom_fields || {}, attachments: [] // 添付は別API
      });
    } else {
      // insert
      const rows = await sql<any[]>`
        INSERT INTO projects
          (company, manager, phone, name, contract_start, contract_end,
           unit_price, start_time, end_time, payment_date, transfer_date,
           required_people, required_unit, custom_fields)
        VALUES
          (${company}, ${base.manager}, ${base.phone}, ${base.name},
           ${base.contract_start}, ${base.contract_end}, ${base.unit_price},
           ${base.start_time}, ${base.end_time}, ${base.payment_date}, ${base.transfer_date},
           ${base.required_people}, ${base.required_unit}, ${sql.json(base.custom_fields)})
        RETURNING id, company, manager, phone, name,
          to_char(contract_start, 'YYYY-MM-DD') AS contract_start,
          to_char(contract_end,   'YYYY-MM-DD') AS contract_end,
          unit_price, start_time, end_time, payment_date, transfer_date,
          required_people, required_unit, custom_fields
      `;
      const r = rows[0];
      saved.push({
        id: r.id, company: r.company, manager: r.manager, phone: r.phone, name: r.name,
        contractStart: r.contract_start || "", contractEnd: r.contract_end || "",
        unitPrice: r.unit_price, startTime: r.start_time, endTime: r.end_time,
        paymentDate: r.payment_date, transferDate: r.transfer_date,
        requiredPeople: r.required_people, requiredUnit: r.required_unit,
        customFields: r.custom_fields || {}, attachments: []
      });
    }
  }

  return NextResponse.json({ projects: saved }, { status: 200 });
}
