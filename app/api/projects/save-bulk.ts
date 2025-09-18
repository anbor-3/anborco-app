import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  try {
    const { company, projects } = req.body || {};
    if (!company || !Array.isArray(projects)) return res.status(400).json({ error: 'bad request' });

    // 最低限の UPSERT（本番はスキーマに合わせて）
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const p of projects) {
        await client.query(
          `insert into projects (id, company, name, manager, phone, unit_price, start_time, end_time)
             values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (id) do update set
             company=$2, name=$3, manager=$4, phone=$5, unit_price=$6, start_time=$7, end_time=$8`,
          [p.id, company, p.name, p.manager, p.phone, p.unitPrice, p.startTime, p.endTime]
        );
      }
      await client.query('commit');
    } finally {
      client.release();
    }

    return res.json({ projects });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'failed to save-bulk' });
  }
}
