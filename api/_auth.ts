import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'auth_token';

export function signToken(payload: object, secret?: string) {
  const key = secret || process.env.JWT_SECRET || 'change-me-dev';
  return jwt.sign(payload, key, { expiresIn: '7d' });
}

export function verifyFromRequest(req: VercelRequest): { accountId: number; email: string } | null {
  try {
    const key = process.env.JWT_SECRET || 'change-me-dev';
    const cookie = req.headers.cookie || '';
    const m = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`));
    if (!m) return null;
    const token = decodeURIComponent(m.split('=')[1]);
    const decoded = jwt.verify(token, key) as any;
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

