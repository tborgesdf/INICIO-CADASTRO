import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import * as crypto from 'crypto';

const COOKIE_NAME = 'auth_token';
function parseCookie(req: any): string | null {
  const cookie = req.headers.cookie || '';
  const m = cookie.split(';').map((s: string) => s.trim()).find((s: string) => s.startsWith(`${COOKIE_NAME}=`));
  return m ? decodeURIComponent(m.split('=')[1]) : null;
}
function getKey(varName: string, fallback?: string) {
  const v = process.env[varName] || fallback;
  if (!v) throw new Error(`Missing required env ${varName}`);
  const buf = Buffer.from(v, 'base64');
  if (buf.length !== 32) throw new Error(`${varName} must be 32 bytes, base64-encoded`);
  return buf;
}
function encrypt(value: string) {
  const key = getKey('DATA_ENC_KEY', process.env.NODE_ENV === 'production' ? undefined : Buffer.from('dev_enc_key_32_bytes_dev_enc_key_32_b').toString('base64'));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}
function blindIndex(value: string) {
  const key = getKey('DATA_HMAC_KEY', process.env.NODE_ENV === 'production' ? undefined : Buffer.from('dev_hmac_key_32_bytes_dev_hmac_key_32').toString('base64'));
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest('hex');
}
async function verifyToken(token: string, secret: string): Promise<any | null> {
  try {
    const [h,p,sig] = token.split('.'); if (!(h && p && sig)) return null;
    const b2b = (s: string) => s.replace(/-/g,'+').replace(/_/g,'/');
    const data = `${h}.${p}`;
    const expected = (await import('crypto')).createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
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

      const tok = parseCookie(req);
      const key = process.env.JWT_SECRET || 'change-me-dev';
      const dec = tok ? await verifyToken(tok, key) : null;
      const session = dec && dec.accountId ? { accountId: Number(dec.accountId), email: String(dec.email || '') } : null;
      const accountId = session?.accountId || null;

      const encCpf = cpf ? encrypt(String(cpf)) : null;
      const encPhone = phone ? encrypt(String(phone)) : null;
      const encEmail = email ? encrypt(String(email)) : null;
      const cpfBidx = cpf ? blindIndex(String(cpf)) : null;
      const emailBidx = email ? blindIndex(String(email)) : null;

      const [userResult] = await conn.execute<import('mysql2').ResultSetHeader>(
        `INSERT INTO users (account_id, cpf, phone, email, cpf_enc, phone_enc, email_enc, cpf_bidx, email_bidx, latitude, longitude, visa_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [accountId, cpf ?? null, phone ?? null, email ?? null, encCpf, encPhone, encEmail, cpfBidx, emailBidx, lat, lng, visaType]
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
      const isAdmin = process.env.NODE_ENV !== 'production' || ((process.env.ADMIN_TOKEN || '') && (((req.headers['x-admin-token'] as string) || '') === process.env.ADMIN_TOKEN));
      const body = isAdmin ? { error: 'Database error', message: err?.message || String(err), stack: err?.stack || '' } : { error: 'Database error' };
      return res.status(500).json(body);
    } finally {
      await conn.end();
    }
  } catch (e) {
    console.error('Handler error:', e);
    const isAdmin = process.env.NODE_ENV !== 'production' || ((process.env.ADMIN_TOKEN || '') && (((req.headers['x-admin-token'] as string) || '') === process.env.ADMIN_TOKEN));
    const body = isAdmin ? { error: 'Internal error', message: (e as any)?.message || String(e), stack: (e as any)?.stack || '' } : { error: 'Internal error' };
    return res.status(500).json(body);
  }
}







