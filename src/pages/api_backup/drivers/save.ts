// src/pages/api/drivers/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../utils/neonClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { company, drivers } = req.body || {};
  if (!company || !Array.isArray(drivers)) {
    return res.status(400).json({ error: 'company and drivers are required' });
  }

  // Ensure table
  await sql`
    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  try {
    await sql`BEGIN`;
    // Replace existing rows for this company (simple & predictable)
    await sql`DELETE FROM drivers WHERE company = ${company}`;

    for (const d of drivers) {
      const id = String(d.id ?? cryptoRandomId());
      await sql`
        INSERT INTO drivers (id, company, payload)
        VALUES (${id}, ${company}, ${sql.json(d)})
        ON CONFLICT (id) DO UPDATE SET
          company = EXCLUDED.company,
          payload = EXCLUDED.payload,
          updated_at = now();
      `;
    }
    await sql`COMMIT`;
    return res.status(200).json({ ok: true, count: drivers.length });
  } catch (e) {
    await sql`ROLLBACK`;
    console.error('save error', e);
    return res.status(500).json({ error: 'failed to save' });
  }
}

function cryptoRandomId(len = 12) {
  const rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return rnd.slice(0, len);
}
