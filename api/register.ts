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
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || (process.env.JWT_SECRET || '').length < 32)) {
    throw new Error('JWT_SECRET must be set to a strong value in production');
  }
  return signHS256(payload, key);
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
function setAuthCookie(res: any, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${2*24*60*60}; ${isProd ? 'Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end('Method Not Allowed'); }

    const raw = (req as any).body; let body: any = {};
    try { body = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    const { name, email, password, cpf } = body;
    if (!name || !email || !password || !cpf) return res.status(400).json({ error: 'Missing fields' });

    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env vars' });

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      // Uniqueness checks (email or CPF)
      const [eRows] = await conn.execute(`SELECT 1 FROM auth_accounts WHERE email = ? AND provider = 'email' LIMIT 1`, [String(email)]);
      if ((eRows as any[]).length > 0) return res.status(409).json({ error: 'Email already registered' });
      const cpfBidx = blindIndex(String(cpf));
      const [cRows] = await conn.execute(`SELECT 1 FROM users WHERE (cpf_bidx = ? OR cpf = ?) LIMIT 1`, [cpfBidx, String(cpf)]);
      if ((cRows as any[]).length > 0) return res.status(409).json({ error: 'CPF already registered' });

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

      // Ensure a minimal users row exists with CPF for login via CPF
      const encCpf = encrypt(String(cpf));
      const encEmail = encrypt(String(email));
      const emailBidx = blindIndex(String(email));
      const [existing] = await conn.execute(`SELECT id FROM users WHERE account_id = ? LIMIT 1`, [accountId]);
      if ((existing as any[]).length === 0) {
        await conn.execute(
          `INSERT INTO users (account_id, cpf, email, cpf_enc, email_enc, cpf_bidx, email_bidx, visa_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'first_visa')`,
          [accountId, String(cpf), String(email), encCpf, encEmail, cpfBidx, emailBidx]
        );
      } else {
        const uid = (existing as any)[0].id;
        await conn.execute(
          `UPDATE users SET cpf = ?, email = ?, cpf_enc = ?, email_enc = ?, cpf_bidx = ?, email_bidx = ? WHERE id = ?`,
          [String(cpf), String(email), encCpf, encEmail, cpfBidx, emailBidx, uid]
        );
      }
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


