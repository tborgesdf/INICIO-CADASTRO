import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setAdminCookie } from '../../lib/adminAuth';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end('Method Not Allowed'); }
  try {
    let body: any = {};
    try { const raw = (req as any).body; body = typeof raw === 'string' ? JSON.parse(raw) : (raw||{}); } catch {}
    const token = String(body?.token || '');
    if (!process.env.ADMIN_TOKEN) return res.status(500).json({ error: 'ADMIN_TOKEN ausente' });
    if (token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'Token inválido' });
    setAdminCookie(res);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erro interno', message: e?.message || String(e) });
  }
}

