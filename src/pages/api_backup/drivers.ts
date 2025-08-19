// src/pages/api/drivers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../utils/neonClient';

type Driver = Record<string, any>;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const company = String(req.query.company || '').trim();
  if (!company) {
    return res.status(400).json({ error: 'company is required' });
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

  const rows = await sql`
    SELECT payload
    FROM drivers
    WHERE company = ${company}
    ORDER BY payload->>'name' NULLS FIRST;
  ` as unknown as { payload: Driver }[];

  const drivers = rows.map(r => r.payload);
  return res.status(200).json(drivers);
}
