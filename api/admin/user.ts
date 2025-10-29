import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { isAdmin } from '../../lib/adminAuth';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
    const id = Number(req.query.id || 0);
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string|undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env' });

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      const [[user]] = await conn.query(
        `SELECT u.*, aa.name
         FROM users u
         LEFT JOIN auth_accounts aa ON aa.id = u.account_id
         WHERE u.id = ?
         LIMIT 1`, [id]
      ) as any;
      if (!user) return res.status(404).json({ error: 'Not found' });
      const [social] = await conn.query(`SELECT platform, handle FROM user_social_media WHERE user_id = ? ORDER BY id ASC`, [id]);
      const [countries] = await conn.query(`SELECT country FROM user_countries WHERE user_id = ? ORDER BY id ASC`, [id]);
      return res.status(200).json({ ok: true, user, social, countries });
    } finally { await conn.end(); }
  } catch (e:any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}

