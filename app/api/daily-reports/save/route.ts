// POST /api/daily-reports/save
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';

/**
 * 受け取り: { reports: Array<{
 *   id: string;
 *   driverId: string;
 *   date: string; // YYYY-MM-DD
 *   status?: 'submitted'|'returned'|'approved';
 *   ... 任意の追加フィールド（temperature, alcohol, start など）
 * }> }
 * - 既存があれば更新、無ければINSERT（UPSERT）
 * - 削除は行わない（ログの意味合いが強いため）
 */
export async function POST(req: Request) {
  try {
    const { companyId } = await requireUser(req);
    const body = await req.json();
    const reports = Array.isArray(body?.reports) ? body.reports : [];

    if (reports.length === 0) {
      return NextResponse.json({ ok: true, upserted: 0 });
    }

    let count = 0;
    for (const r of reports) {
      const externalId = String(r?.id ?? '');
      const driverExternalId = String(r?.driverId ?? '');
      const date = String(r?.date ?? '');
      if (!externalId || !driverExternalId || !date) continue;

      const { id, driverId, date: _date, status = 'submitted', ...rest } = r;
      await sql<any[]>(
        `insert into daily_reports (company_id, external_id, driver_external_id, date, status, data)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (company_id, external_id)
         do update set driver_external_id = excluded.driver_external_id,
                       date = excluded.date,
                       status = excluded.status,
                       data = excluded.data,
                       updated_at = now()`,
        [companyId, externalId, driverExternalId, date, status, JSON.stringify(rest)]
      );
      count++;
    }

    return NextResponse.json({ ok: true, upserted: count });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
