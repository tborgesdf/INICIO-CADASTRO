// Dev-only API server to test /api/save-user locally with Vite proxy
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.warn('Atenção: Variáveis DB_* não configuradas. Edite seu .env conforme .env.example');
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
});

app.post('/api/save-user', async (req, res) => {
  try {
    const { cpf, phone, email, socialMedia, location, visaType, countries } = req.body || {};
    if (!cpf || !phone || !email || !visaType || !Array.isArray(countries) || countries.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const lat = location?.latitude ?? null;
    const lng = location?.longitude ?? null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [userResult] = await conn.execute(
        'INSERT INTO users (cpf, phone, email, latitude, longitude, visa_type) VALUES (?, ?, ?, ?, ?, ?)',
        [cpf, phone, email, lat, lng, visaType]
      );
      const userId = userResult.insertId;

      if (socialMedia && typeof socialMedia === 'object') {
        const entries = Object.entries(socialMedia).filter(([, v]) => !!v);
        if (entries.length) {
          const placeholders = entries.map(() => '(?, ?, ?)').join(',');
          const values = entries.flatMap(([platform, handle]) => [userId, platform, String(handle)]);
          await conn.execute(
            `INSERT INTO user_social_media (user_id, platform, handle) VALUES ${placeholders}`,
            values
          );
        }
      }

      if (Array.isArray(countries) && countries.length) {
        const placeholders = countries.map(() => '(?, ?)').join(',');
        const values = countries.flatMap((c) => [userId, String(c)]);
        await conn.execute(
          `INSERT INTO user_countries (user_id, country) VALUES ${placeholders}`,
          values
        );
      }

      await conn.commit();
      return res.json({ ok: true, userId });
    } catch (e) {
      try { await conn.rollback(); } catch {}
      console.error('DB error:', e);
      return res.status(500).json({ error: 'Database error' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Dev API rodando em http://localhost:${PORT}`);
});

