import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAuthCookie } from './_auth';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
}

