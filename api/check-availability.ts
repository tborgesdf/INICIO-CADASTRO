import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import * as crypto from 'crypto';

export const config = { runtime: 'nodejs' };

function normalizeCpf(s: string) { return String(s || '').replace(/\D+/g, ''); }
function blindIndex(value: string) {
  const v = process.env.DATA_HMAC_KEY || Buffer.from('dev_hmac_key_32_bytes_dev_hmac_key_32').toString('base64');
  const key = Buffer.from(v, 'base64');
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env vars' });

    const email = (req.query.email as string) || '';
    const cpfRaw = (req.query.cpf as string) || '';
    const cpf = normalizeCpf(cpfRaw);

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      let emailAvailable: boolean | null = null;
      let cpfAvailable: boolean | null = null;

      if (email) {
        const [r] = await conn.execute(`SELECT 1 FROM auth_accounts WHERE email = ? AND provider = 'email' LIMIT 1`, [email]);
        emailAvailable = (r as any[]).length === 0;
      }
      if (cpf) {
        const cpfBidx = blindIndex(cpf);
        const [c] = await conn.execute(`SELECT 1 FROM users WHERE (cpf_bidx = ? OR cpf = ?) LIMIT 1`, [cpfBidx, cpf]);
        cpfAvailable = (c as any[]).length === 0;
      }

      return res.status(200).json({ ok: true, emailAvailable, cpfAvailable });
    } finally { await conn.end(); }
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

