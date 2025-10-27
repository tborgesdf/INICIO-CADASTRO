import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';

const COOKIE_NAME = 'auth_token';
function parseCookie(req: any): string | null {
  const cookie = req.headers.cookie || '';
  const m = cookie.split(';').map((s: string) => s.trim()).find((s: string) => s.startsWith(`${COOKIE_NAME}=`));
  return m ? decodeURIComponent(m.split('=')[1]) : null;
}
function verifyToken(token: string, secret: string): any | null {
  try {
    const [h,p,sig] = token.split('.'); if (!(h && p && sig)) return null;
    const b2b = (s: string) => s.replace(/-/g,'+').replace(/_/g,'/');
    const data = `${h}.${p}`;
    const expected = require('crypto').createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (expected !== sig) return null;
    const json = Buffer.from(b2b(p), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    const now = Math.floor(Date.now()/1000);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch { return null; }
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const raw = (req as any).body;
    let body: any = {};
    try {
      body = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { cpf, phone, email, socialMedia, location, visaType, countries } = body;

    if (!cpf || !phone || !email || !visaType || !Array.isArray(countries) || countries.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const lat = location?.latitude ?? null;
    const lng = location?.longitude ?? null;

    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
      return res.status(500).json({ error: 'Missing DB env vars' });
    }

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      await conn.beginTransaction();

      const session = (function(){ const tok=parseCookie(req); if(!tok) return null; const key=process.env.JWT_SECRET||'change-me-dev'; const dec=verifyToken(tok, key); return dec && dec.accountId ? { accountId: Number(dec.accountId), email: String(dec.email||'') } : null; })();
      const accountId = session?.accountId || null;

      const [userResult] = await conn.execute<import('mysql2').ResultSetHeader>(
        `INSERT INTO users (account_id, cpf, phone, email, latitude, longitude, visa_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [accountId, cpf, phone, email, lat, lng, visaType]
      );

      const userId = (userResult as any).insertId as number;

      // Social media (key/value pairs)
      if (socialMedia && typeof socialMedia === 'object') {
        const entries = Object.entries(socialMedia).filter(([, v]) => !!v);
        if (entries.length) {
          const values: any[] = [];
          const placeholders: string[] = [];
          for (const [platform, handle] of entries) {
            placeholders.push('(?, ?, ?)');
            values.push(userId, platform, String(handle));
          }
          await conn.execute(
            `INSERT INTO user_social_media (user_id, platform, handle) VALUES ${placeholders.join(',')}`,
            values
          );
        }
      }

      // Countries
      if (Array.isArray(countries) && countries.length) {
        const values: any[] = [];
        const placeholders: string[] = [];
        for (const country of countries) {
          placeholders.push('(?, ?)');
          values.push(userId, String(country));
        }
        await conn.execute(
          `INSERT INTO user_countries (user_id, country) VALUES ${placeholders.join(',')}`,
          values
        );
      }

      await conn.commit();
      return res.status(200).json({ ok: true, userId });
    } catch (err: any) {
      try { await conn.rollback(); } catch {}
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error', message: err?.message || String(err) });
    } finally {
      await conn.end();
    }
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Internal error', message: (e as any)?.message || String(e) });
  }
}


