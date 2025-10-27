import type { VercelRequest, VercelResponse } from '@vercel/node';
import { signToken, verifyFromRequest, setAuthCookie, clearAuthCookie } from '../lib/auth';

export const config = { runtime: 'nodejs' };

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const t = signToken({ ok: true });
    setAuthCookie(res, t);
    const sess = verifyFromRequest(req);
    clearAuthCookie(res);
    return res.status(200).json({ ok: true, tokenLen: t.length, hasSess: !!sess });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

