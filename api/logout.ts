import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAuthCookie } from './_auth';

export const config = { runtime: 'nodejs' };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    clearAuthCookie(res);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
