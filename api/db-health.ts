import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';

export const config = { runtime: 'nodejs18.x' };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    return res.status(500).json({ ok: false, error: 'Missing DB env vars', have: { DB_HOST: !!DB_HOST, DB_USER: !!DB_USER, DB_PASSWORD: !!DB_PASSWORD, DB_NAME: !!DB_NAME } });
  }

  try {
    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      const [rows] = await conn.query('SELECT 1 AS ok');
      return res.status(200).json({ ok: true, db: DB_NAME, result: rows });
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

