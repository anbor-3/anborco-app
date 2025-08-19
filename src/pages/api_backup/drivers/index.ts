
import type { NextApiRequest, NextApiResponse } from 'next'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM drivers ORDER BY uid ASC')
      res.status(200).json(result.rows)
    } catch (error) {
      res.status(500).json({ message: 'DB Error', error })
    }
  } else if (req.method === 'POST') {
    const { uid, name, company, phone } = req.body
    try {
      await pool.query(
        'INSERT INTO drivers (uid, name, company, phone) VALUES ($1, $2, $3, $4)',
        [uid, name, company, phone]
      )
      res.status(200).json({ message: 'Driver added' })
    } catch (error) {
      res.status(500).json({ message: 'Insert Error', error })
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' })
  }
}
