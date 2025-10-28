import type { VercelRequest } from '@vercel/node';
import crypto from 'crypto';

const COOKIE_NAME = 'auth_token';

function b64url(input: Buffer | string) {
  const base = (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return base;
}

function signHS256(payload: any, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const withExp = { ...payload, iat: now, exp: now + 7 * 24 * 60 * 60 };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(withExp));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${sig}`;
}

function verifyHS256(token: string, secret: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, signature] = parts;
  const data = `${encHeader}.${encPayload}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (expected !== signature) return null;
  const payloadJson = Buffer.from(encPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const payload = JSON.parse(payloadJson);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  return payload;
}

export function signToken(payload: object, secret?: string) {
  const key = secret || process.env.JWT_SECRET || 'change-me-dev';
  return signHS256(payload, key);
}

export function verifyFromRequest(req: VercelRequest): { accountId: number; email: string } | null {
  try {
    const key = process.env.JWT_SECRET || 'change-me-dev';
    const cookie = req.headers.cookie || '';
    const m = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`));
    if (!m) return null;
    const token = decodeURIComponent(m.split('=')[1]);
    const decoded = verifyHS256(token, key) as any;
    if (decoded && decoded.accountId) return { accountId: Number(decoded.accountId), email: String(decoded.email || '') };
    return null;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: any, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookie = `auth_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*24*60*60}; ${isProd ? 'Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
}

export function clearAuthCookie(res: any) {
  res.setHeader('Set-Cookie', `auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
