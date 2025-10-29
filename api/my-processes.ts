import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import mysql from 'mysql2/promise';

export const config = { runtime: 'nodejs' };

function parseUserSession(req: any): { email: string; accountId: number } | null {
  try {
    const cookie: string = req.headers?.cookie || '';
    const part = cookie.split(';').map((s:string)=>s.trim()).find((s:string)=>s.startsWith('auth_token='));
    if (!part) return null;
    const tok = decodeURIComponent(part.split('=')[1]||'');
    const [h,p,sig] = tok.split('.'); if (!(h && p && sig)) return null;
    const secret = process.env.JWT_SECRET || 'change-me-dev';
    const data = `${h}.${p}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (expected !== sig) return null;
    const payloadJson = Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now()/1000);
    if (payload.exp && now > payload.exp) return null;
    return { email: String(payload.email||''), accountId: Number(payload.accountId||0) };
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const sess = parseUserSession(req); if (!sess || !sess.accountId) return res.status(401).json({ error: 'Unauthorized' });
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string,string|undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env vars' });
    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      const [rows]: any = await conn.query(
        `SELECT id, visa_type, status, created_at FROM users WHERE account_id=? ORDER BY created_at DESC`,
        [sess.accountId]
      );
      return res.status(200).json({ ok: true, items: rows || [] });
    } finally { try { await conn.end(); } catch {} }
  } catch (e:any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}

