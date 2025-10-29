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
function blindIndex(value: string) {
  const v = process.env.DATA_HMAC_KEY || Buffer.from('dev_hmac_key_32_bytes_dev_hmac_key_32').toString('base64');
  const key = Buffer.from(v, 'base64');
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest('hex');
}
function normalizeCpf(input: string): string { return String(input||'').replace(/\D+/g,''); }
function setAuthCookie(res: any, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${2*24*60*60}; ${isProd ? 'Secure' : ''}`;
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
    const { email, cpf, password } = body;
    if ((!email && !cpf) || !password) return res.status(400).json({ error: 'Missing identifier/password' });

    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env vars' });

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      let rows: any[] = [];
      if (email) {
        const [r] = await conn.execute(`SELECT id, password_hash FROM auth_accounts WHERE email = ? AND provider = 'email' LIMIT 1`, [String(email)]);
        rows = r as any[];
      } else {
        const cpfNorm = normalizeCpf(String(cpf));
        if (cpfNorm.length !== 11) return res.status(401).json({ error: 'Invalid credentials' });
        const cpfBidx = blindIndex(cpfNorm);
        const [r] = await conn.execute(`
          SELECT aa.id, aa.password_hash
          FROM auth_accounts aa
          JOIN users u ON u.account_id = aa.id
          WHERE u.cpf_bidx = ? AND aa.provider = 'email'
          LIMIT 1
        `, [cpfBidx]);
        rows = r as any[];
      }
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

      // logar acesso (action=login) similar ao /api/client-log
      try {
        const h: any = req.headers || {};
        // Enriquecimento básico com ipapi.co (best-effort)
        const ipRaw = (h['x-real-ip'] as string) || (h['x-forwarded-for'] as string) || '';
        const clientIp = (ipRaw || '').split(',')[0].trim();
        let isp: string | null = null; let asn: string | null = null;
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), 2500);
          const url = clientIp ? `https://ipapi.co/${clientIp}/json/` : `https://ipapi.co/json/`;
          const r = await fetch(url, { signal: ctl.signal }); clearTimeout(t);
          if (r.ok) { const j: any = await r.json(); isp = String(j.org||'')||null; asn = String(j.asn||'')||null; }
        } catch {}
        await conn.query(
          `CREATE TABLE IF NOT EXISTS access_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            action VARCHAR(64) NOT NULL,
            ip VARCHAR(64) NULL,
            port VARCHAR(16) NULL,
            method VARCHAR(8) NULL,
            path TEXT NULL,
            user_agent TEXT NULL,
            referer TEXT NULL,
            country VARCHAR(8) NULL,
            region VARCHAR(64) NULL,
            city VARCHAR(64) NULL,
            latitude VARCHAR(32) NULL,
            longitude VARCHAR(32) NULL,
            accept_language VARCHAR(128) NULL,
            x_forwarded_for TEXT NULL,
            account_email VARCHAR(255) NULL,
            extra TEXT NULL,
            PRIMARY KEY (id)
          ) ENGINE=InnoDB`);
        const extra = JSON.stringify({ isp, asn });
        await conn.query(
          `INSERT INTO access_logs (action, ip, port, method, path, user_agent, referer, country, region, city, latitude, longitude, accept_language, x_forwarded_for, account_email, extra)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            'login',
            clientIp,
            (h['x-vercel-forwarded-for-port'] as string) || '',
            req.method || '',
            req.url || '',
            (h['user-agent'] as string) || '',
            (h['referer'] as string) || '',
            (h['x-vercel-ip-country'] as string) || '',
            (h['x-vercel-ip-country-region'] as string) || '',
            (h['x-vercel-ip-city'] as string) || '',
            (h['x-vercel-ip-latitude'] as string) || '',
            (h['x-vercel-ip-longitude'] as string) || '',
            (h['accept-language'] as string) || '',
            (h['x-forwarded-for'] as string) || '',
            String(email || ''),
            extra,
          ]
        );
      } catch {}

      return res.status(200).json({ ok: true, accountId: row.id });
    } catch (e: any) {
      return res.status(500).json({ error: 'DB error', message: e?.message || String(e) });
    } finally { await conn.end(); }
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}
