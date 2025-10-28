import type { VercelRequest, VercelResponse } from '@vercel/node';
import { signToken } from './_auth';

export const config = { runtime: 'nodejs18.x' };

export default function handler(_req: VercelRequest, res: VercelResponse) {
  // Apenas prova de vida do import
  if (typeof signToken !== 'function') {
    return res.status(500).json({ ok: false, error: 'signToken not loaded' });
  }
  return res.status(200).json({ ok: true });
}

