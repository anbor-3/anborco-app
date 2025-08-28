import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { verifyBearer, requireSameCompanyOrAdmin } from "@/lib/authServer";

export const runtime = "nodejs";

type Body = {
  company: string;
  driverId: string; // Firebase UID
  ym: string;       // 'YYYY-MM'
  fileName: string;
  url: string;      // Firebase Storage のダウンロードURL
};

export async function POST(req: Request) {
  try {
    const u = await verifyBearer(req);
    const body = (await req.json()) as Body;

    const { company, driverId, ym, fileName, url } = body;
    if (!company || !driverId || !ym || !fileName || !url) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    await requireSameCompanyOrAdmin(u, company);

    await sql`
      INSERT INTO zips (company, driver_id, ym, file_name, url)
      VALUES (${company}, ${driverId}, ${ym}, ${fileName}, ${url});
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "bad request" }, { status: 400 });
  }
}
