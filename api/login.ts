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
function clearAuthCookie(res: any) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end('Method Not Allowed'); }
    let body: any = {};
    try {
      const raw = (req as any).body;
      if (raw && typeof raw === 'string') {
        body = JSON.parse(raw);
      } else if (raw && typeof raw === 'object') {
        body = raw;
      } else {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve) => {
          (req as any).on('data', (c: Buffer) => chunks.push(c));
          (req as any).on('end', () => resolve());
        });
        if (chunks.length) {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        }
      }
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    const { email, password } = body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email/password' });

    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env vars' });

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      const [rows] = await conn.execute(`SELECT id, password_hash FROM auth_accounts WHERE email = ? AND provider = 'email' LIMIT 1`, [String(email)]);
      const row = (rows as any)[0];
      if (!row || !row.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
      const stored: string = String(row.password_hash);
      if (!stored.startsWith('pbkdf2$')) return res.status(401).json({ error: 'Invalid credentials' });
      const [, iterStr, salt, hashHex] = stored.split('$');
      const iters = Number(iterStr);
      const derived = crypto.pbkdf2Sync(String(password), salt, iters, 64, 'sha512').toString('hex');
      const ok = crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hashHex, 'hex'));
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken({ accountId: row.id, email: String(email) });
      setAuthCookie(res, token);
      return res.status(200).json({ ok: true, accountId: row.id });
    } catch (e: any) {
      return res.status(500).json({ error: 'DB error', message: e?.message || String(e) });
    } finally { await conn.end(); }
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}
