// api/dashboardStats.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ダッシュボード用の最小スタブ。まずは404を止めるのが目的。
// 後でNeonの実データ集計に差し替えてOK。
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const company = String(req.query.company || '');
  const date    = String(req.query.date || '');
  const month   = String(req.query.month || '');

  if (!company) return res.status(400).json({ error: 'missing company' });

  // ひとまずダミー値。フロントが必要とするキーを最低限返す。
  // （フロントが求める形に合わせて足してください。）
  res.status(200).json({
    company,
    date,
    month,
    totals: {
      drivers: 0,
      reportsToday: 0,
      warnings: 0,
    }
  });
}
