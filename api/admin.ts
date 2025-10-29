import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import * as crypto from 'crypto';
import { isAdmin, setAdminCookie, clearAdminCookie } from '../lib/adminAuth';

export const config = { runtime: 'nodejs' };

function parseJsonBody(req: VercelRequest): any {
  const raw: any = (req as any).body;
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  if (typeof raw === 'object') return raw;
  return {};
}

async function getConn() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string|undefined>;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) throw new Error('Missing DB env vars');
  return mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const action = String((req.query.action || req.query.a || '').toString());

    // admin-login (POST): e-mail precisa estar em ADMIN_EMAILS e a senha bater com ADMIN_PASSWORD_HASH (bcrypt) ou ADMIN_PASSWORD
    if (action === 'admin-login' && req.method === 'POST') {
      const body = parseJsonBody(req);
      const email = String(body?.email || '').toLowerCase().trim();
      const password = String(body?.password || '');
      const allow = String(process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      if (!allow.length) return res.status(500).json({ error: 'ADMIN_EMAILS ausente' });
      if (!email || !allow.includes(email)) return res.status(401).json({ error: 'Não autorizado' });\n      if (!email || !allow.includes(email)) return res.status(401).json({ error: 'N�o autorizado' });\n      const plain = process.env.ADMIN_PASSWORD || '';\n      if (!plain) return res.status(500).json({ error: 'ADMIN_PASSWORD ausente' });\n      {\n        const a = Buffer.from(password);\n        const b = Buffer.from(plain);\n        const ok = a.length === b.length && crypto.timingSafeEqual(a, b);\n        if (!ok) return res.status(401).json({ error: 'Credenciais inv�lidas' });\n      }\n      setAdminCookie(res);\n      return res.status(200).json({ ok: true });
    }

    // logout (POST)
    if (action === 'logout' && req.method === 'POST') {
      clearAdminCookie(res);
      return res.status(200).json({ ok: true });
    }

    // me (GET)
    if (action === 'me') {
      return res.status(200).json({ ok: isAdmin(req) });
    }

    // Rotas abaixo exigem admin (cookie admin válido)
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

    // users (GET listagem + filtros + paginação)
    if (action === 'users') {
      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
      const email = String(req.query.email || '').trim();
      const cpf = String(req.query.cpf || '').replace(/\D+/g,'');
      const visaType = String(req.query.visaType || '').trim();
      const from = String(req.query.from || '').trim();
      const to = String(req.query.to || '').trim();

      const where: string[] = [];
      const params: any[] = [];
      if (email) { where.push('u.email LIKE ?'); params.push(`%${email}%`); }
      if (cpf) { where.push('u.cpf LIKE ?'); params.push(`%${cpf}%`); }
      if (visaType) { where.push('u.visa_type = ?'); params.push(visaType); }
      if (from) { where.push('u.created_at >= ?'); params.push(from); }
      if (to) { where.push('u.created_at <= ?'); params.push(to); }
      const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

      const conn = await getConn();
      try {
        const [countRows] = await conn.query<any[]>(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
        const total = (countRows as any)[0]?.total || 0;
        const offset = (page - 1) * pageSize;
        const [rows] = await conn.query<any[]>(
          `SELECT u.id, u.account_id, u.cpf, u.email, u.phone, u.latitude, u.longitude, u.visa_type, u.created_at, aa.name
           FROM users u LEFT JOIN auth_accounts aa ON aa.id = u.account_id
           ${whereSql}
           ORDER BY u.created_at DESC
           LIMIT ? OFFSET ?`, [...params, pageSize, offset]
        );
        return res.status(200).json({ ok: true, page, pageSize, total, rows });
      } finally { await (await conn).end(); }
    }

    // user (GET detalhes)
    if (action === 'user') {
      const id = Number(req.query.id || 0);
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const conn = await getConn();
      try {
        const [uRows] = await conn.query<any[]>(
          `SELECT u.*, aa.name FROM users u LEFT JOIN auth_accounts aa ON aa.id = u.account_id WHERE u.id = ? LIMIT 1`, [id]
        );
        const user = (uRows as any)[0];
        if (!user) return res.status(404).json({ error: 'Not found' });
        const [social] = await conn.query<any[]>(`SELECT platform, handle FROM user_social_media WHERE user_id = ? ORDER BY id ASC`, [id]);
        const [countries] = await conn.query<any[]>(`SELECT country FROM user_countries WHERE user_id = ? ORDER BY id ASC`, [id]);
        return res.status(200).json({ ok: true, user, social, countries });
      } finally { await (await conn).end(); }
    }

    // metrics (GET)
    if (action === 'metrics') {
      const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
      const visaType = String(req.query.visaType || '').trim();
      const from = String(req.query.from || '').trim();
      const to = String(req.query.to || '').trim();

      const where: string[] = [];
      const params: any[] = [];
      if (visaType) { where.push('u.visa_type = ?'); params.push(visaType); }
      if (from) { where.push('u.created_at >= ?'); params.push(from); }
      if (to) { where.push('u.created_at <= ?'); params.push(to); }
      const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

      const conn = await getConn();
      try {
        const [totRows] = await conn.query<any[]>(`SELECT COUNT(*) AS totalUsers FROM users u ${whereSql}`, params);
        const totalUsers = (totRows as any)[0]?.totalUsers || 0;
        const [byVisaType] = await conn.query<any[]>(
          `SELECT u.visa_type AS visaType, COUNT(*) AS count FROM users u ${whereSql} GROUP BY u.visa_type ORDER BY count DESC`, params
        );
        const whereDays: string[] = [...where];
        const paramsDays: any[] = [...params];
        if (!from && !to) { whereDays.push('u.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'); paramsDays.push(days); }
        const whereSqlDays = whereDays.length ? ('WHERE ' + whereDays.join(' AND ')) : '';
        const [byDay] = await conn.query<any[]>(
          `SELECT DATE(u.created_at) AS day, COUNT(*) AS count FROM users u ${whereSqlDays} GROUP BY DATE(u.created_at) ORDER BY day ASC`, paramsDays
        );
        const [topCountries] = await conn.query<any[]>(
          `SELECT uc.country AS country, COUNT(*) AS count FROM user_countries uc JOIN users u ON u.id = uc.user_id ${whereSql} GROUP BY uc.country ORDER BY count DESC LIMIT 20`, params
        );
        const geoWhere = where.length ? (whereSql + ' AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL') : 'WHERE u.latitude IS NOT NULL AND u.longitude IS NOT NULL';
        const [geo] = await conn.query<any[]>(
          `SELECT ROUND(u.latitude, 2) AS lat, ROUND(u.longitude, 2) AS lng, COUNT(*) AS count FROM users u ${geoWhere} GROUP BY ROUND(u.latitude,2), ROUND(u.longitude,2) ORDER BY count DESC LIMIT 1000`, params
        );
        return res.status(200).json({ ok: true, totalUsers, byVisaType, byDay, topCountries, geo });
      } finally { await (await conn).end(); }
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}


