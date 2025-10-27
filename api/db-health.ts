import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from './db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT 1 AS ok');
      return res.status(200).json({ ok: true, db: process.env.DB_NAME, result: rows });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

