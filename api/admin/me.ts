import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdmin } from '../../lib/adminAuth';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return res.status(200).json({ ok: isAdmin(req) });
  } catch {
    return res.status(200).json({ ok: false });
  }
}

