// POST /api/drivers/save
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';

/**
 * 受け取り: { company?: string, drivers: Driver[] }
 * - drivers[] は画面の全件。DBと完全同期（UPSERT & 余剰DELETE）
 * - attachments, licenseFiles は無視（保存しない）
 */
export async function POST(req: Request) {
  try {
    const { companyId } = await requireUser(req);
    const body = await req.json();
    const drivers = Array.isArray(body?.drivers) ? body.drivers : [];

    if (drivers.length === 0) {
      // 0件なら会社の全ドライバーを削除して終了（完全同期主義）
      const del = await sql<any[]>(
        'delete from drivers where company_id = $1 returning external_id',
        [companyId]
      );
      return NextResponse.json({ ok: true, updated: 0, deleted: del.length });
    }

    // 会社内に存在する external_id 一覧を先に取得
    const existing = await sql<{ external_id: string }[]>(
      'select external_id from drivers where company_id = $1',
      [companyId]
    );
    const existingSet = new Set(existing.map(r => r.external_id));

    const incomingIds: string[] = [];

    // UPSERT
    for (const d of drivers) {
      const { attachments, licenseFiles, ...data } = d || {};
      const externalId = String(d?.id ?? '');
      if (!externalId) continue;
      incomingIds.push(externalId);

      const name = String((d as any).name || '');
      const loginId = String((d as any).loginId || '');

      await sql<any[]>(
        `insert into drivers (company_id, external_id, login_id, name, data)
         values ($1,$2,$3,$4,$5)
         on conflict (company_id, external_id)
         do update set login_id = excluded.login_id,
                       name     = excluded.name,
                       data     = excluded.data,
                       updated_at = now()`,
        [companyId, externalId, loginId, name, JSON.stringify(data)]
      );
    }

    // 余剰DELETE（DBにあるけど、送られてこなかった external_id）
    const del = await sql<any[]>(
      `delete from drivers
         where company_id = $1
           and not (external_id = any($2))`,
      [companyId, incomingIds]
    );

    return NextResponse.json({ ok: true, updated: incomingIds.length, deleted: del.length });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
