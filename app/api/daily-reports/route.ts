// GET /api/daily-reports?status=...&from=YYYY-MM-DD&to=YYYY-MM-DD&driverId=driver0001
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const { companyId } = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const driverId = searchParams.get('driverId') || undefined;

    const where: string[] = ['company_id = $1'];
    const params: any[] = [companyId];
    let i = 2;

    if (status) { where.push(`status = $${i++}`); params.push(status); }
    if (from)   { where.push(`date >= $${i++}`); params.push(from); }
    if (to)     { where.push(`date <= $${i++}`); params.push(to); }
    if (driverId) { where.push(`driver_external_id = $${i++}`); params.push(driverId); }

    const q = `select external_id, driver_external_id, date, status, data
                 from daily_reports
                where ${where.join(' and ')}
                order by date desc, created_at desc
                limit 500`;

    const rows = await sql<any[]>(q, params);

    const reports = rows.map(r => ({
      id: r.external_id,
      driverId: r.driver_external_id,
      date: r.date,
      status: r.status,
      ...(r.data || {}),
    }));

    return NextResponse.json(reports, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
