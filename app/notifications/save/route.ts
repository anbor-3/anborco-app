// POST /api/notifications/save
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';

/**
 * 受け取り: { type: 'warning'|'report'|'shift', category: string, message: string, target?: string }
 */
export async function POST(req: Request) {
  try {
    const { companyId } = await requireUser(req);
    const body = await req.json();
    const { type, category, message, target } = body || {};
    if (!type || !category || !message) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }
    await sql<any[]>(
      `insert into notifications (company_id, type, category, message, target)
       values ($1,$2,$3,$4,$5)`,
      [companyId, String(type), String(category), String(message), target ? String(target) : null]
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
