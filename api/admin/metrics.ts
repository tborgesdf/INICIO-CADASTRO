import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { isAdmin } from '../../lib/adminAuth';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string|undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) return res.status(500).json({ error: 'Missing DB env' });

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

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      // Totais
      const [[{ totalUsers }]] = await conn.query(`SELECT COUNT(*) AS totalUsers FROM users u ${whereSql}`, params);

      // Por tipo de visto
      const [byVisaType] = await conn.query(
        `SELECT u.visa_type AS visaType, COUNT(*) AS count FROM users u ${whereSql} GROUP BY u.visa_type ORDER BY count DESC`, params
      );

      // Por dia (últimos N dias ou conforme filtro)
      const whereDays: string[] = [...where];
      const paramsDays: any[] = [...params];
      if (!from && !to) { whereDays.push('u.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'); paramsDays.push(days); }
      const whereSqlDays = whereDays.length ? ('WHERE ' + whereDays.join(' AND ')) : '';
      const [byDay] = await conn.query(
        `SELECT DATE(u.created_at) AS day, COUNT(*) AS count
         FROM users u ${whereSqlDays}
         GROUP BY DATE(u.created_at)
         ORDER BY day ASC`, paramsDays
      );

      // Países (top 20)
      const [topCountries] = await conn.query(
        `SELECT uc.country AS country, COUNT(*) AS count
         FROM user_countries uc
         JOIN users u ON u.id = uc.user_id
         ${whereSql}
         GROUP BY uc.country
         ORDER BY count DESC
         LIMIT 20`, params
      );

      // Geo heat (agregado por grid ~0.01/0.02)
      const geoWhere = where.length ? (whereSql + ' AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL') : 'WHERE u.latitude IS NOT NULL AND u.longitude IS NOT NULL';
      const [geo] = await conn.query(
        `SELECT ROUND(u.latitude, 2) AS lat, ROUND(u.longitude, 2) AS lng, COUNT(*) AS count
         FROM users u ${geoWhere}
         GROUP BY ROUND(u.latitude,2), ROUND(u.longitude,2)
         ORDER BY count DESC
         LIMIT 1000`, params
      );

      return res.status(200).json({ ok: true, totalUsers, byVisaType, byDay, topCountries, geo });
    } finally { await conn.end(); }
  } catch (e:any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
