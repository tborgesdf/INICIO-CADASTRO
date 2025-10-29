import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { isAdmin, setAdminCookie, clearAdminCookie } from '../lib/adminAuth';

export const config = { runtime: 'nodejs' };

function parseJsonBody(req: VercelRequest): any {
  const raw: any = (req as any).body;
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return {} } }
  if (typeof raw === 'object') return raw;
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const action = String((req.query.action || req.query.a || '').toString());
    if (action === 'health') return res.status(200).json({ ok: true });

    if (action === 'admin-login' && req.method === 'POST') {
      const body = parseJsonBody(req);
      const email = String(body?.email || '').toLowerCase().trim();
      const password = String(body?.password || '');
      const allow = String(process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      if (!allow.length) return res.status(500).json({ error: 'ADMIN_EMAILS ausente' });
      if (!email || !allow.includes(email)) return res.status(401).json({ error: 'Não autorizado' });
      const plain = process.env.ADMIN_PASSWORD || '';
      if (!plain) return res.status(500).json({ error: 'ADMIN_PASSWORD ausente' });
      const a = Buffer.from(password); const b = Buffer.from(plain);
      const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
      setAdminCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (action === 'logout' && req.method === 'POST') {
      clearAdminCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (action === 'me') {
      return res.status(200).json({ ok: isAdmin(req) });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e:any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}

