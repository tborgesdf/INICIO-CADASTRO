import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { signTokenAsync, setAuthCookie } from './_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end('Method Not Allowed'); }

  const raw = (req as any).body; let body: any = {};
  try { body = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const { name, email, password } = body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env vars' });

  const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
  try {
    const bcrypt: any = (await import('bcryptjs')).default ?? (await import('bcryptjs'));
    const hash = await bcrypt.hash(String(password), 10);
    await conn.execute(
      `INSERT INTO auth_accounts (email, provider, name, password_hash) VALUES (?, 'email', ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)`,
      [String(email), String(name), hash]
    );
    const [rows] = await conn.query(`SELECT id FROM auth_accounts WHERE email = ? AND provider = 'email'`, [String(email)]);
    const accountId = (rows as any)[0]?.id as number;
    const token = await signTokenAsync({ accountId, email: String(email) });
    setAuthCookie(res, token);
    return res.status(200).json({ ok: true, accountId });
  } catch (e: any) {
    return res.status(500).json({ error: 'DB error', message: e?.message || String(e) });
  } finally { await conn.end(); }
}
