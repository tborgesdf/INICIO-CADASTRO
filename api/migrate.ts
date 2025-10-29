import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

async function ensureMigrationsTable(conn: mysql.Connection) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`_migrations\` (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB;
  `);
}

async function getApplied(conn: mysql.Connection) {
  const [rows]: any = await (conn as any).query('SELECT name FROM `_migrations`');
  const set = new Set<string>((rows || []).map((r: any) => r.name));
  return set;
}

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const token = String(req.headers['x-admin-token'] || '');
    const allow = process.env.ADMIN_TOKEN || process.env.MIGRATE_TOKEN || '';
    if (!allow) return res.status(500).json({ error: 'ADMIN_TOKEN/MIGRATE_TOKEN ausente' });
    if (!token || token !== allow) return res.status(401).json({ error: 'Unauthorized' });

    const DB_HOST = process.env.DB_HOST || '';
    const DB_USER = process.env.DB_USER || '';
    const DB_PASSWORD = process.env.DB_PASSWORD || '';
    const DB_NAME = process.env.DB_NAME || '';
    if (!(DB_HOST && DB_USER && DB_PASSWORD && DB_NAME)) {
      return res.status(500).json({ error: 'DB env vars ausentes' });
    }

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, multipleStatements: true });
    try {
      await ensureMigrationsTable(conn);
      const applied = await getApplied(conn);
      const dir = path.resolve(process.cwd(), 'sql', 'migrations');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
      const ran: string[] = [];
      for (const file of files) {
        if (applied.has(file)) continue;
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        const statements = sql
          .split(/;\s*\n/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        await (conn as any).beginTransaction();
        try {
          for (const stmt of statements) {
            try {
              await (conn as any).query(stmt);
            } catch (e: any) {
              const code = e?.errno || e?.code || 0;
              const msg = String(e?.message || '').toLowerCase();
              const isIdempotent = (
                code === 1050 /* ER_TABLE_EXISTS_ERROR */ ||
                code === 1060 /* ER_DUP_FIELDNAME */ ||
                code === 1061 /* ER_DUP_KEYNAME */ ||
                code === 1022 /* ER_DUP_KEY */ ||
                msg.includes('duplicate column') ||
                msg.includes('duplicate key') ||
                msg.includes('already exists') ||
                msg.includes('cannot add foreign key constraint') /* FKs podem já existir ou faltar dependência; tolerar reexecução */
              );
              if (!isIdempotent) throw e; // abort for real errors
            }
          }
          await (conn as any).query('INSERT INTO `_migrations` (name) VALUES (?)', [file]);
          await (conn as any).commit();
          ran.push(file);
        } catch (e) {
          await (conn as any).rollback();
          throw e;
        }
      }
      return res.status(200).json({ ok: true, ran });
    } finally {
      try { await conn.end(); } catch {}
    }
  } catch (e: any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}
