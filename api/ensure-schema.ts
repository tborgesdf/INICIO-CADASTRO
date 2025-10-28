import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';

export const config = { runtime: 'nodejs' };

async function ensureAuthAccounts(conn: mysql.Connection) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS auth_accounts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      provider ENUM('google','apple','email') NOT NULL,
      name VARCHAR(255) NULL,
      password_hash VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_auth_email_provider (email, provider)
    ) ENGINE=InnoDB;
  `);

  const [cols] = await conn.query("SHOW COLUMNS FROM auth_accounts LIKE 'password_hash'");
  const hasPass = (cols as any[]).length > 0;
  if (!hasPass) {
    await conn.execute("ALTER TABLE auth_accounts ADD COLUMN password_hash VARCHAR(255) NULL AFTER name");
  }
}

async function ensureUsers(conn: mysql.Connection) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      account_id BIGINT UNSIGNED NULL,
      cpf VARCHAR(32) NULL,
      phone VARCHAR(32) NULL,
      email VARCHAR(255) NULL,
      cpf_enc VARBINARY(768) NULL,
      phone_enc VARBINARY(768) NULL,
      email_enc VARBINARY(768) NULL,
      cpf_bidx CHAR(64) NULL,
      email_bidx CHAR(64) NULL,
      latitude DECIMAL(10,7) NULL,
      longitude DECIMAL(10,7) NULL,
      visa_type ENUM('renewal','first_visa') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_users_email (email),
      KEY idx_users_email_bidx (email_bidx),
      KEY idx_users_cpf_bidx (cpf_bidx)
    ) ENGINE=InnoDB;
  `);

  // Ensure visa_type, sensitive columns and indexes exist
  await conn.execute(`ALTER TABLE users MODIFY COLUMN visa_type ENUM('renewal','first_visa') NOT NULL`);
  const [colsCpfEnc] = await conn.query("SHOW COLUMNS FROM users LIKE 'cpf_enc'");
  if ((colsCpfEnc as any[]).length === 0) {
    await conn.execute("ALTER TABLE users ADD COLUMN cpf_enc VARBINARY(768) NULL AFTER email");
  }
  const [colsPhoneEnc] = await conn.query("SHOW COLUMNS FROM users LIKE 'phone_enc'");
  if ((colsPhoneEnc as any[]).length === 0) {
    await conn.execute("ALTER TABLE users ADD COLUMN phone_enc VARBINARY(768) NULL AFTER cpf_enc");
  }
  const [colsEmailEnc] = await conn.query("SHOW COLUMNS FROM users LIKE 'email_enc'");
  if ((colsEmailEnc as any[]).length === 0) {
    await conn.execute("ALTER TABLE users ADD COLUMN email_enc VARBINARY(768) NULL AFTER phone_enc");
  }
  const [colsCpfBidx] = await conn.query("SHOW COLUMNS FROM users LIKE 'cpf_bidx'");
  if ((colsCpfBidx as any[]).length === 0) {
    await conn.execute("ALTER TABLE users ADD COLUMN cpf_bidx CHAR(64) NULL AFTER email_enc");
    await conn.execute("ALTER TABLE users ADD KEY idx_users_cpf_bidx (cpf_bidx)");
  }
  const [colsEmailBidx] = await conn.query("SHOW COLUMNS FROM users LIKE 'email_bidx'");
  if ((colsEmailBidx as any[]).length === 0) {
    await conn.execute("ALTER TABLE users ADD COLUMN email_bidx CHAR(64) NULL AFTER cpf_bidx");
    await conn.execute("ALTER TABLE users ADD KEY idx_users_email_bidx (email_bidx)");
  }

  // Ensure FK to auth_accounts
  const [fkRows] = await conn.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME='users' AND REFERENCED_TABLE_NAME='auth_accounts' AND COLUMN_NAME='account_id'");
  const hasFk = (fkRows as any[]).length > 0;
  if (!hasFk) {
    // Guarantee column exists
    const [accCol] = await conn.query("SHOW COLUMNS FROM users LIKE 'account_id'");
    if ((accCol as any[]).length === 0) {
      await conn.execute("ALTER TABLE users ADD COLUMN account_id BIGINT UNSIGNED NULL AFTER id");
    }
    await conn.execute("ALTER TABLE users ADD KEY idx_users_account (account_id)");
    await conn.execute("ALTER TABLE users ADD CONSTRAINT fk_users_account FOREIGN KEY (account_id) REFERENCES auth_accounts(id) ON DELETE SET NULL");
  }
}

async function ensureAuxTables(conn: mysql.Connection) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_social_media (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      platform VARCHAR(64) NOT NULL,
      handle TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_usm_user (user_id)
    ) ENGINE=InnoDB;
  `);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_countries (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      country VARCHAR(128) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_uc_user (user_id)
    ) ENGINE=InnoDB;
  `);
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    return res.status(500).json({ ok: false, error: 'Missing DB env vars' });
  }
  const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
  try {
    await ensureAuthAccounts(conn);
    await ensureUsers(conn);
    await ensureAuxTables(conn);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  } finally {
    await conn.end();
  }
}
