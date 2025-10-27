const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [r1] = await conn.execute(
      "INSERT INTO users (cpf, phone, email, latitude, longitude, visa_type) VALUES (?, ?, ?, ?, ?, ?)",
      ['12345678900', '55999999999', 'teste@example.com', null, null, 'renewal']
    );
    console.log('Inserted id:', r1.insertId);
    const [rows] = await conn.query('SELECT id, cpf, email, visa_type FROM users ORDER BY id DESC LIMIT 1');
    console.log(rows);
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });

