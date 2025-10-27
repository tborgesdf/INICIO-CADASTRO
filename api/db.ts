import mysql from 'mysql2/promise';

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  // Do not throw at import-time in Vercel build, but do validate at runtime
  console.warn('DB environment variables are not fully set (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).');
}

export const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

