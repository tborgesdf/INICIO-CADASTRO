import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const raw = (req as any).body;
  let body: any = {};
  try { body = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    return res.status(500).json({ ok: false, stage: 'env', error: 'Missing DB env vars' });
  }

  try {
    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      const { cpf, phone, email, socialMedia, location, visaType, countries } = body;
      if (!cpf || !phone || !email || !visaType || !Array.isArray(countries) || countries.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const lat = location?.latitude ?? null;
      const lng = location?.longitude ?? null;

      await conn.beginTransaction();
      const [userResult] = await conn.execute<import('mysql2').ResultSetHeader>(
        `INSERT INTO users (cpf, phone, email, latitude, longitude, visa_type) VALUES (?, ?, ?, ?, ?, ?)`,
        [cpf, phone, email, lat, lng, visaType]
      );
      const userId = (userResult as any).insertId as number;

      if (socialMedia && typeof socialMedia === 'object') {
        const entries = Object.entries(socialMedia).filter(([, v]) => !!v);
        if (entries.length) {
          const values: any[] = [];
          const placeholders: string[] = [];
          for (const [platform, handle] of entries) {
            placeholders.push('(?, ?, ?)');
            values.push(userId, platform, String(handle));
          }
          await conn.execute(
            `INSERT INTO user_social_media (user_id, platform, handle) VALUES ${placeholders.join(',')}`,
            values
          );
        }
      }

      if (Array.isArray(countries) && countries.length) {
        const values: any[] = [];
        const placeholders: string[] = [];
        for (const country of countries) {
          placeholders.push('(?, ?)');
          values.push(userId, String(country));
        }
        await conn.execute(
          `INSERT INTO user_countries (user_id, country) VALUES ${placeholders.join(',')}`,
          values
        );
      }

      await conn.commit();
      return res.status(200).json({ ok: true, userId });
    } catch (e: any) {
      try { await conn.rollback(); } catch {}
      return res.status(500).json({ ok: false, stage: 'tx', error: e?.message || String(e) });
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    return res.status(500).json({ ok: false, stage: 'connect', error: e?.message || String(e) });
  }
}

