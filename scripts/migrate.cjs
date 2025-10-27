// Simple SQL migrations runner
// - Looks for repo/sql/migrations/*.sql
// - Records applied files in `_migrations` table

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function ensureMigrationsTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`_migrations\` (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB;
  `);
}

async function getApplied(conn) {
  const [rows] = await conn.query('SELECT name FROM `_migrations`');
  const set = new Set(rows.map((r) => r.name));
  return set;
}

async function applyMigration(conn, name, sql) {
  await conn.beginTransaction();
  try {
    await conn.query(sql);
    await conn.query('INSERT INTO `_migrations` (name) VALUES (?)', [name]);
    await conn.commit();
    console.log(`Applied: ${name}`);
  } catch (e) {
    await conn.rollback();
    throw e;
  }
}

async function main() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error('Missing DB env vars (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  try {
    await ensureMigrationsTable(conn);
    const applied = await getApplied(conn);

    const dir = path.resolve(__dirname, '..', 'sql', 'migrations');
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await applyMigration(conn, file, sql);
    }

    console.log('Migrations complete.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err && err.message ? err.message : err);
  process.exit(1);
});

