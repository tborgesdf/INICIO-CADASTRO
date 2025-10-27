import type { VercelRequest, VercelResponse } from '@vercel/node';
import { signToken } from '../lib/auth';

export const config = { runtime: 'nodejs' };

export default function handler(_req: VercelRequest, res: VercelResponse) {
  // Exercita import de auth para validar em runtime
  const t = signToken({ ping: true });
  return res.status(200).json({ ok: true, tokenLen: t.length });
}
