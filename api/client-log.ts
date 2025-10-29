import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';

function parseJsonBody(req: VercelRequest): any {
  const raw: any = (req as any).body;
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return {} } }
  if (typeof raw === 'object') return raw;
  return {};
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const DB_HOST = process.env.DB_HOST || '';
  const DB_USER = process.env.DB_USER || '';
  const DB_PASSWORD = process.env.DB_PASSWORD || '';
  const DB_NAME = process.env.DB_NAME || '';
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    // garantir tabela e coluna extra
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS access_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        action VARCHAR(64) NOT NULL,
        ip VARCHAR(64) NULL,
        port VARCHAR(16) NULL,
        method VARCHAR(8) NULL,
        path TEXT NULL,
        user_agent TEXT NULL,
        referer TEXT NULL,
        country VARCHAR(8) NULL,
        region VARCHAR(64) NULL,
        city VARCHAR(64) NULL,
        latitude VARCHAR(32) NULL,
        longitude VARCHAR(32) NULL,
        accept_language VARCHAR(128) NULL,
        x_forwarded_for TEXT NULL,
        account_email VARCHAR(255) NULL,
        extra TEXT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB`);
    } catch {}
    try { await conn.query(`ALTER TABLE access_logs ADD COLUMN extra TEXT NULL`); } catch {}

    const body = parseJsonBody(req) || {};
    const h: any = req.headers || {};
    const extra = JSON.stringify({
      browser: body.browser || '',
      os: body.os || '',
      ua: body.ua || '',
      connType: body.connType || '',
      downlink: body.downlink ?? null,
      rtt: body.rtt ?? null,
      clientLat: body.clientLat ?? null,
      clientLng: body.clientLng ?? null,
      // marcadores futuros (ISP, proxy, tor)
      isp: body.isp ?? null,
      isProxy: body.isProxy ?? null,
      isTor: body.isTor ?? null,
    });
    await conn.query(
      `INSERT INTO access_logs (action, ip, port, method, path, user_agent, referer, country, region, city, latitude, longitude, accept_language, x_forwarded_for, account_email, extra)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'client_init',
        (h['x-real-ip'] as string) || (h['x-forwarded-for'] as string) || '',
        (h['x-vercel-forwarded-for-port'] as string) || '',
        req.method || '',
        req.url || '',
        (h['user-agent'] as string) || '',
        (h['referer'] as string) || '',
        (h['x-vercel-ip-country'] as string) || '',
        (h['x-vercel-ip-country-region'] as string) || '',
        (h['x-vercel-ip-city'] as string) || '',
        (h['x-vercel-ip-latitude'] as string) || '',
        (h['x-vercel-ip-longitude'] as string) || '',
        (h['accept-language'] as string) || '',
        (h['x-forwarded-for'] as string) || '',
        '',
        extra,
      ]
    );
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  } finally {
    try { await conn?.end(); } catch {}
  }
}

