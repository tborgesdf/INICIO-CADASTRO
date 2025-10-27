import type { VercelRequest, VercelResponse } from '@vercel/node';
const COOKIE_NAME = 'auth_token';
function clearAuthCookie(res: any) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export const config = { runtime: 'nodejs' };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    clearAuthCookie(res);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
