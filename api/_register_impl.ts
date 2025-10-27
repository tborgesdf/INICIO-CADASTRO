import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import * as crypto from 'crypto';

const COOKIE_NAME = 'auth_token';
function b64url(input: Buffer | string) {
  const base = (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return base;
}
function signHS256(payload: any, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now()/1000);
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify({ ...payload, iat: now, exp: now + 7*24*60*60 }));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return `${data}.${sig}`;
}
function signToken(payload: object, secret?: string) {
  const key = secret || process.env.JWT_SECRET || 'change-me-dev';
  return signHS256(payload, key);
}
function setAuthCookie(res: any, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*24*60*60}; ${isProd ? 'Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end('Method Not Allowed'); }

    const raw = (req as any).body; let body: any = {};
    try { body = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    const { name, email, password } = body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env vars' });

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      const salt = crypto.randomBytes(16).toString('hex');
      const iters = 100000;
      const derived = crypto.pbkdf2Sync(String(password), salt, iters, 64, 'sha512').toString('hex');
      const hash = `pbkdf2$${iters}$${salt}$${derived}`;
      await conn.execute(
        `INSERT INTO auth_accounts (email, provider, name, password_hash) VALUES (?, 'email', ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)`,
        [String(email), String(name), hash]
      );
      const [rows] = await conn.query(`SELECT id FROM auth_accounts WHERE email = ? AND provider = 'email'`, [String(email)]);
      const accountId = (rows as any)[0]?.id as number;
      const token = signToken({ accountId, email: String(email) });
      setAuthCookie(res, token);
      return res.status(200).json({ ok: true, accountId });
    } catch (e: any) {
      return res.status(500).json({ error: 'DB error', message: e?.message || String(e) });
    } finally { await conn.end(); }
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}

