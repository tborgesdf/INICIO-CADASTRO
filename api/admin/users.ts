import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { isAdmin } from '../../lib/adminAuth';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string|undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env' });

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
    const email = String(req.query.email || '').trim();
    const cpf = String(req.query.cpf || '').replace(/\D+/g,'');
    const visaType = String(req.query.visaType || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const where: string[] = [];
    const params: any[] = [];
    if (email) { where.push('u.email LIKE ?'); params.push(`%${email}%`); }
    if (cpf) { where.push('u.cpf LIKE ?'); params.push(`%${cpf}%`); }
    if (visaType) { where.push('u.visa_type = ?'); params.push(visaType); }
    if (from) { where.push('u.created_at >= ?'); params.push(from); }
    if (to) { where.push('u.created_at <= ?'); params.push(to); }
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      const [[{ total }]] = await conn.query(`SELECT COUNT(*) as total FROM users u ${whereSql}`, params);
      const offset = (page - 1) * pageSize;
      const [rows] = await conn.query(
        `SELECT u.id, u.account_id, u.cpf, u.email, u.phone, u.latitude, u.longitude, u.visa_type, u.created_at,
                aa.name
         FROM users u
         LEFT JOIN auth_accounts aa ON aa.id = u.account_id
         ${whereSql}
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`, [...params, pageSize, offset]
      );
      return res.status(200).json({ ok: true, page, pageSize, total, rows });
    } finally { await conn.end(); }
  } catch (e:any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}

