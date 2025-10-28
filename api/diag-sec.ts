import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { runtime: 'nodejs' };

export default function handler(req: VercelRequest, res: VercelResponse) {
  const adminToken = process.env.ADMIN_TOKEN || '';
  if (process.env.NODE_ENV === 'production') {
    const provided = (req.headers['x-admin-token'] as string) || '';
    if (!adminToken) return res.status(500).json({ ok: false, error: 'Missing ADMIN_TOKEN' });
    if (!provided || provided !== adminToken) return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  try {
    const enc = process.env.DATA_ENC_KEY || '';
    const hmac = process.env.DATA_HMAC_KEY || '';
    const encLen = enc ? Buffer.from(enc, 'base64').length : 0;
    const hmacLen = hmac ? Buffer.from(hmac, 'base64').length : 0;
    return res.status(200).json({ ok: true, encLen, hmacLen, hasJwt: !!process.env.JWT_SECRET });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

