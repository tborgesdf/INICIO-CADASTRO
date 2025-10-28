import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { signToken, setAuthCookie, clearAuthCookie } from '../lib/auth';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end('Method Not Allowed'); }
  const raw = (req as any).body; let body: any = {};
  try { body = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const { email, password } = body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email/password' });

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env vars' });

  const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
  try {
    const [rows] = await conn.execute(`SELECT id, password_hash FROM auth_accounts WHERE email = ? AND provider = 'email' LIMIT 1`, [String(email)]);
    const row = (rows as any)[0];
    if (!row || !row.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
    const bcrypt: any = (await import('bcryptjs')).default ?? (await import('bcryptjs'));
    const ok = await bcrypt.compare(String(password), String(row.password_hash));
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ accountId: row.id, email: String(email) });
    setAuthCookie(res, token);
    return res.status(200).json({ ok: true, accountId: row.id });
  } catch (e: any) {
    return res.status(500).json({ error: 'DB error', message: e?.message || String(e) });
  } finally { await conn.end(); }
}
