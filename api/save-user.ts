import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool } from './db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const raw = (req as any).body;
    let body: any = {};
    try {
      body = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { cpf, phone, email, socialMedia, location, visaType, countries } = body;

    if (!cpf || !phone || !email || !visaType || !Array.isArray(countries) || countries.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const lat = location?.latitude ?? null;
    const lng = location?.longitude ?? null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [userResult] = await conn.execute<import('mysql2').ResultSetHeader>(
        `INSERT INTO users (cpf, phone, email, latitude, longitude, visa_type) VALUES (?, ?, ?, ?, ?, ?)`,
        [cpf, phone, email, lat, lng, visaType]
      );

      const userId = (userResult as any).insertId as number;

      // Social media (key/value pairs)
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

      // Countries
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
    } catch (err: any) {
      await (await conn).rollback();
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error', message: err?.message || String(err) });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Internal error', message: (e as any)?.message || String(e) });
  }
}

