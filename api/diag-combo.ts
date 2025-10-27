import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { signToken } from '../lib/auth';

export const config = { runtime: 'nodejs' };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // touch both imports
    const t = signToken({ combo: true });
    const ok = !!mysql;
    return res.status(200).json({ ok, tokenLen: t.length });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
