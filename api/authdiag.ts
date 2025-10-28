import type { VercelRequest, VercelResponse } from '@vercel/node';
import { signToken, verifyFromRequest } from './_auth';

export const config = { runtime: 'nodejs18.x' };

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const t = signToken({ probe: true });
    const sess = verifyFromRequest(req);
    return res.status(200).json({ ok: true, tokenLen: t.length, hasSess: !!sess });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

