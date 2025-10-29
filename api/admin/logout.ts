import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAdminCookie } from '../../lib/adminAuth';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end('Method Not Allowed'); }
  clearAdminCookie(res);
  return res.status(200).json({ ok: true });
}

