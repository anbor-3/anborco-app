// GET /api/drivers
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';

/**
 * 返却: drivers.data をそのまま返す（UIの型変化に強い）
 */
export async function GET(req: Request) {
  try {
    const { companyId } = await requireUser(req);

    const rows = await sql<any[]>(
      `select external_id, login_id, name, data
         from drivers
        where company_id = $1
        order by (data->>'name') nulls last, name`,
      [companyId]
    );

    // data(JSON)に最低限のキーをマージ（互換性確保）
    const drivers = rows.map(r => ({
      id: r.external_id,
      loginId: r.login_id || (r.data?.loginId ?? ''),
      name: r.name || (r.data?.name ?? ''),
      ...(r.data || {}),
    }));

    return NextResponse.json(drivers, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
