import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    return res.status(500).json({ ok: false, stage: 'env', error: 'Missing DB env vars' });
  }

  try {
    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      const [r1] = await conn.execute(
        "INSERT INTO users (cpf, phone, email, latitude, longitude, visa_type) VALUES (?, ?, ?, ?, ?, ?)",
        ['12345678900', '55999999999', 'teste+vercel@example.com', null, null, 'renewal']
      );
      const userId = (r1 as any).insertId as number;
      return res.status(200).json({ ok: true, userId });
    } catch (e: any) {
      return res.status(500).json({ ok: false, stage: 'insert', error: e?.message || String(e) });
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, stage: 'connect', error: e?.message || String(e) });
  }
}

