// POST /api/daily-reports/return
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { companyId } = await requireUser(req);
    const { reportId, reason } = await req.json();

    if (!reportId) return NextResponse.json({ error: 'reportId is required' }, { status: 400 });

    const upd = await sql<any[]>(
      `update daily_reports
          set status = 'returned',
              data = jsonb_set(coalesce(data,'{}'::jsonb), '{returnReason}', to_jsonb(coalesce($3, ''))),
              updated_at = now()
        where company_id = $1 and external_id = $2
        returning external_id`,
      [companyId, reportId, reason || '']
    );

    if (upd.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (reason) {
      await sql<any[]>(
        `insert into notifications (company_id, type, category, message, target)
         values ($1,'report','差し戻し', $2, $3)`,
        [companyId, `日報 ${reportId} を差し戻し: ${reason}`, reportId]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
