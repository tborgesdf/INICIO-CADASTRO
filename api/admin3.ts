import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import mysql from 'mysql2/promise';
// Helpers inline para autenticação admin (evita problemas de resolução de módulo no runtime ESM)
const ADMIN_COOKIE = 'admin_session';
const b64url = (b: Buffer | string) => (typeof b === 'string' ? Buffer.from(b) : b)
  .toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function setAdminCookie(res: any) {
  const secret = process.env.JWT_SECRET || 'change-me-dev';
  const now = Math.floor(Date.now()/1000);
  const payload = JSON.stringify({ adm: true, iat: now });
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const val = `${b64url(payload)}.${sig}`;
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${2*60*60}; ${isProd?'Secure':''}`);
}
function clearAdminCookie(res: any) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}
function parseUserSession(req: any): { email: string; accountId: number } | null {
  try {
    const cookie: string = req.headers?.cookie || '';
    const part = cookie.split(';').map((s:string)=>s.trim()).find((s:string)=>s.startsWith('auth_token='));
    if (!part) return null;
    const tok = decodeURIComponent(part.split('=')[1]||'');
    const [h,p,sig] = tok.split('.'); if (!(h && p && sig)) return null;
    const secret = process.env.JWT_SECRET || 'change-me-dev';
    const data = `${h}.${p}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64')
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (expected !== sig) return null;
    const payloadJson = Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now()/1000);
    if (payload.exp && now > payload.exp) return null;
    return { email: String(payload.email||''), accountId: Number(payload.accountId||0) };
  } catch { return null; }
}

function isAdmin(req: any): boolean {
  try {
    const cookie: string = req.headers?.cookie || '';
    const part = cookie.split(';').map((s:string)=>s.trim()).find((s:string)=>s.startsWith(`${ADMIN_COOKIE}=`));
    if (part) {
      const val = decodeURIComponent(part.split('=')[1]||'');
      const [p,s] = val.split('.'); if (!(p && s)) return false;
      const payload = Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
      const secret = process.env.JWT_SECRET || 'change-me-dev';
      const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64')
        .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      if (sig === s) { const obj = JSON.parse(payload); if (obj && obj.adm) return true; }
    }
    // Fallback: sessão do usuário comum, validada e em allowlist de admins
    const allow = String(process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if (allow.length) {
      const sess = parseUserSession(req);
      if (sess && allow.includes(String(sess.email||'').toLowerCase())) return true;
    }
    return false;
  } catch { return false; }
}

export const config = { runtime: 'nodejs' };

function parseJsonBody(req: VercelRequest): any {
  const raw: any = (req as any).body;
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return {} } }
  if (typeof raw === 'object') return raw;
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const action = String((req.query.action || req.query.a || '').toString());
    if (action === 'health') return res.status(200).json({ ok: true });

    if (action === 'admin-login' && req.method === 'POST') {
      const body = parseJsonBody(req);
      const email = String(body?.email || '').toLowerCase().trim();
      const password = String(body?.password || '');
      const allow = String(process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      if (!allow.length) return res.status(500).json({ error: 'ADMIN_EMAILS ausente' });
      if (!email || !allow.includes(email)) return res.status(401).json({ error: 'Não autorizado' });
      const plain = process.env.ADMIN_PASSWORD || '';
      if (!plain) return res.status(500).json({ error: 'ADMIN_PASSWORD ausente' });
      const a = Buffer.from(password); const b = Buffer.from(plain);
      const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
      setAdminCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (action === 'logout' && req.method === 'POST') {
      clearAdminCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (action === 'me') {
      return res.status(200).json({ ok: isAdmin(req) });
    }
    if (action === 'whoami') {
      const session = parseUserSession(req);
      const sessionEmail = (session?.email || '').toLowerCase();
      const allowList = String(process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      const isSuper = !!(sessionEmail && allowList.includes(sessionEmail));
      let perms: any = { isSuper, can_manage_users: isSuper, can_view_all: isSuper, can_edit_all: isSuper, view_fields: [], edit_fields: [] };
      if (!isSuper && sessionEmail) {
        try {
          const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
          if (DB_HOST && DB_USER && DB_PASSWORD && DB_NAME) {
            const c = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
            try {
              const [rows]: any = await c.query(`SELECT can_manage_users, can_view_all, can_edit_all, view_fields, edit_fields FROM admin_users WHERE email=? AND is_active=1 LIMIT 1`, [sessionEmail]);
              if ((rows||[])[0]) {
                const u = rows[0];
                perms.can_manage_users = !!u.can_manage_users;
                perms.can_view_all = !!u.can_view_all;
                perms.can_edit_all = !!u.can_edit_all;
                perms.view_fields = u.view_fields ? JSON.parse(u.view_fields) : [];
                perms.edit_fields = u.edit_fields ? JSON.parse(u.edit_fields) : [];
              }
            } finally { await c.end().catch(()=>{}); }
          }
        } catch {}
      }
      return res.status(200).json({ ok: true, perms });
    }

    // As rotas abaixo exigem sessão admin válida
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

    // Conexão MySQL
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
      return res.status(500).json({ error: 'Missing DB env vars' });
    }

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, multipleStatements: true });
    try {
      // ensure admin_users table exists (for RBAC básico)
      await conn.query(`CREATE TABLE IF NOT EXISTS admin_users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        cpf VARCHAR(32) NULL,
        birth_date DATE NULL,
        phone VARCHAR(32) NULL,
        photo LONGBLOB NULL,
        role VARCHAR(32) NULL,
        can_manage_users TINYINT(1) NOT NULL DEFAULT 0,
        can_view_all TINYINT(1) NOT NULL DEFAULT 1,
        can_edit_all TINYINT(1) NOT NULL DEFAULT 0,
        view_fields JSON NULL,
        edit_fields JSON NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB`);

      const session = parseUserSession(req);
      const sessionEmail = (session?.email || '').toLowerCase();
      const allowList = String(process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      const isSuper = !!(sessionEmail && allowList.includes(sessionEmail));
      let isDbAdmin = false;
      if (sessionEmail && !isSuper) {
        const [adm]: any = await conn.query(`SELECT id FROM admin_users WHERE email = ? AND is_active = 1 LIMIT 1`, [sessionEmail]);
        isDbAdmin = (adm||[]).length>0;
      }
      const hasAdmin = isSuper || isDbAdmin || isAdmin(req);
      if (!hasAdmin) return res.status(401).json({ error: 'Unauthorized' });
      if (action === 'users') {
        const page = Math.max(1, Number(req.query.page || 1));
        const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)));
        const email = String(req.query.email || '').trim();
        const cpf = String(req.query.cpf || '').replace(/\D+/g, '');
        const visaType = String(req.query.visaType || '').trim();
        const from = String(req.query.from || '').trim();
        const to = String(req.query.to || '').trim();

        const where: string[] = [];
        const params: any[] = [];
        if (email) { where.push('u.email LIKE ?'); params.push(`%${email}%`); }
        if (cpf) { where.push('u.cpf LIKE ?'); params.push(`%${cpf}%`); }
        if (visaType) { where.push('u.visa_type = ?'); params.push(visaType); }
        if (from) { where.push('u.created_at >= ?'); params.push(from); }
        if (to) { where.push('u.created_at <= ?'); params.push(to); }
        const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

        const [countRows] = await conn.query<any[]>(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
        const total = (countRows as any)[0]?.total || 0;
        const offset = (page - 1) * pageSize;
        const [rows] = await conn.query<any[]>(
          `SELECT 
             u.id, u.account_id, u.cpf, u.email, u.phone, u.latitude, u.longitude, u.visa_type, u.created_at, aa.name,
             (SELECT GROUP_CONCAT(uc.country SEPARATOR ', ') FROM user_countries uc WHERE uc.user_id = u.id) AS countries
           FROM users u 
           LEFT JOIN auth_accounts aa ON aa.id = u.account_id
           ${whereSql}
           ORDER BY u.created_at DESC
           LIMIT ? OFFSET ?`, [...params, pageSize, offset]
        );
        // log de acesso
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
            PRIMARY KEY (id)
          ) ENGINE=InnoDB`);
          const h: any = req.headers || {};
          await conn.query(
            `INSERT INTO access_logs (action, ip, port, method, path, user_agent, referer, country, region, city, latitude, longitude, accept_language, x_forwarded_for, account_email)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'admin_users',
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
              (parseUserSession(req)?.email) || ''
            ]
          );
        } catch {}
        return res.status(200).json({ ok: true, page, pageSize, total, rows });
      }

      if (action === 'metrics') {
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

        const [totRows] = await conn.query<any[]>(`SELECT COUNT(*) AS totalUsers FROM users u ${whereSql}`, params);
        const totalUsers = (totRows as any)[0]?.totalUsers || 0;
        const [byVisaType] = await conn.query<any[]>(
          `SELECT u.visa_type AS visaType, COUNT(*) AS count FROM users u ${whereSql} GROUP BY u.visa_type ORDER BY count DESC`, params
        );
        const whereDays: string[] = [...where];
        const paramsDays: any[] = [...params];
        if (!from && !to) { whereDays.push('u.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'); paramsDays.push(days); }
        const whereSqlDays = whereDays.length ? ('WHERE ' + whereDays.join(' AND ')) : '';
        const [byDay] = await conn.query<any[]>(
          `SELECT DATE(u.created_at) AS day, COUNT(*) AS count FROM users u ${whereSqlDays} GROUP BY DATE(u.created_at) ORDER BY day ASC`, paramsDays
        );
        const [topCountries] = await conn.query<any[]>(
          `SELECT uc.country AS country, COUNT(*) AS count FROM user_countries uc JOIN users u ON u.id = uc.user_id ${whereSql} GROUP BY uc.country ORDER BY count DESC LIMIT 20`, params
        );
        const geoWhere = where.length ? (whereSql + ' AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL') : 'WHERE u.latitude IS NOT NULL AND u.longitude IS NOT NULL';
        const [geo] = await conn.query<any[]>(
          `SELECT ROUND(u.latitude, 2) AS lat, ROUND(u.longitude, 2) AS lng, COUNT(*) AS count FROM users u ${geoWhere} GROUP BY ROUND(u.latitude,2), ROUND(u.longitude,2) ORDER BY count DESC LIMIT 1000`, params
        );
        // Aggregate simple country counts for CA / EUA / MX using basic normalization
        const [aggCountries]: any = await conn.query(
          `SELECT
             SUM(CASE WHEN UPPER(uc.country) LIKE 'CANAD%' OR UPPER(uc.country)='CA' THEN 1 ELSE 0 END) AS CA,
             SUM(CASE WHEN UPPER(uc.country) IN ('ESTADOS UNIDOS','UNITED STATES','EUA','USA','US') OR UPPER(uc.country) LIKE 'ESTADOS UNID%' THEN 1 ELSE 0 END) AS EUA,
             SUM(CASE WHEN UPPER(uc.country) LIKE 'MEX%' OR UPPER(uc.country)='MX' THEN 1 ELSE 0 END) AS MX
           FROM user_countries uc JOIN users u ON u.id = uc.user_id ${whereSql}`, params
        );
        const ca = Number((aggCountries || [])[0]?.CA || 0);
        const eua = Number((aggCountries || [])[0]?.EUA || 0);
        const mx = Number((aggCountries || [])[0]?.MX || 0);

        // Recent cities from access_logs (last seen and count)
        const [recentCities]: any = await conn.query(
          `SELECT city, country, MAX(created_at) AS last_at, COUNT(*) AS count
             FROM access_logs
            WHERE city IS NOT NULL AND city <> ''
            GROUP BY city, country
            ORDER BY last_at DESC
            LIMIT 30`
        );
        return res.status(200).json({ ok: true, totalUsers, byVisaType, byDay, topCountries, geo, ca, eua, mx, recentCities });
      }

      if (action === 'user') {
        const id = Number(req.query.id || 0);
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const [uRows]: any = await conn.query(
          `SELECT u.*, aa.name FROM users u LEFT JOIN auth_accounts aa ON aa.id = u.account_id WHERE u.id = ? LIMIT 1`,
          [id]
        );
        const user = (uRows || [])[0];
        if (!user) return res.status(404).json({ error: 'Not found' });
        const [social]: any = await conn.query(`SELECT platform, handle FROM user_social_media WHERE user_id = ? ORDER BY id ASC`, [id]);
        const [countries]: any = await conn.query(`SELECT country FROM user_countries WHERE user_id = ? ORDER BY id ASC`, [id]);
        return res.status(200).json({ ok: true, user, social, countries });
      }

      if (action === 'purge' && req.method === 'POST') {
        const body = parseJsonBody(req);
        const headerConfirm = String((req.headers as any)['x-admin-confirm'] || '').toUpperCase();
        const bodyConfirm = String(body?.confirm || '').toUpperCase();
        if (headerConfirm !== 'PURGE' && bodyConfirm !== 'PURGE') {
          return res.status(400).json({ error: 'Confirmação ausente. Envie {"confirm":"PURGE"} ou header x-admin-confirm: PURGE' });
        }
        await conn.beginTransaction();
        try {
          await conn.query('SET FOREIGN_KEY_CHECKS=0');
          await conn.query('TRUNCATE TABLE user_countries');
          await conn.query('TRUNCATE TABLE user_social_media');
          await conn.query('TRUNCATE TABLE users');
          await conn.query('TRUNCATE TABLE auth_accounts');
          await conn.query('SET FOREIGN_KEY_CHECKS=1');
          await conn.commit();
        } catch (e) {
          try { await conn.rollback(); } catch {}
          throw e;
        }
        return res.status(200).json({ ok: true, purged: true });
      }

      if (action === 'delete' && req.method === 'POST') {
        const body = parseJsonBody(req);
        const id = Number(body?.id || 0);
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const [[u]]: any = await conn.query(`SELECT id, account_id FROM users WHERE id = ? LIMIT 1`, [id]);
        if (!u) return res.status(404).json({ error: 'Not found' });
        await conn.beginTransaction();
        try {
          await conn.query(`DELETE FROM users WHERE id = ?`, [id]);
          if (u.account_id) {
            await conn.query(`DELETE FROM auth_accounts WHERE id = ?`, [u.account_id]);
          }
          await conn.commit();
        } catch (e) { try { await conn.rollback(); } catch {}; throw e; }
        return res.status(200).json({ ok: true, deleted: id });
      }

      if (action === 'deleteMany' && req.method === 'POST') {
        const body = parseJsonBody(req);
        const ids: number[] = Array.isArray(body?.ids) ? body.ids.map((x:any)=>Number(x)).filter((n:number)=>n>0) : [];
        if (!ids.length) return res.status(400).json({ error: 'Missing ids' });
        await conn.beginTransaction();
        try {
          const [rows]: any = await conn.query(`SELECT id, account_id FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
          const acctIds = (rows || []).map((r:any)=>r.account_id).filter((n:any)=>!!n);
          if (ids.length) await conn.query(`DELETE FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
          if (acctIds.length) await conn.query(`DELETE FROM auth_accounts WHERE id IN (${acctIds.map(()=>'?').join(',')})`, acctIds);
          await conn.commit();
        } catch (e) { try { await conn.rollback(); } catch {}; throw e; }
        return res.status(200).json({ ok: true, deleted: ids.length });
      }

      if (action === 'update' && req.method === 'POST') {
        const body = parseJsonBody(req);
        const id = Number(body?.id || 0);
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const email = (body?.email ?? '').toString().trim();
        const cpfRaw = (body?.cpf ?? '').toString();
        const phone = (body?.phone ?? '').toString();
        const visaType = (body?.visa_type ?? '').toString();

        // helpers de criptografia/índice cego (iguais aos usados nas rotas principais)
        const getKey = (name: string) => {
          const v = process.env[name]; if (!v) throw new Error(`Missing ${name}`);
          const b = Buffer.from(v, 'base64'); if (b.length !== 32) throw new Error(`${name} must be 32 bytes base64`); return b;
        };
        const encrypt = (value: string) => {
          const key = getKey('DATA_ENC_KEY'); const iv = crypto.randomBytes(12);
          const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
          const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); const tag = cipher.getAuthTag();
          return Buffer.concat([iv, tag, ct]).toString('base64');
        };
        const blindIndex = (value: string) => {
          const key = getKey('DATA_HMAC_KEY'); return crypto.createHmac('sha256', key).update(value, 'utf8').digest('hex');
        };
        const normalizeCpf = (s: string) => String(s||'').replace(/\D+/g,'');
        const isValidCpf = (cpf: string) => { const s = normalizeCpf(cpf); if (s.length!==11) return false; if (/^(\d)\1{10}$/.test(s)) return false; const dv=(b:string)=>{let f=b.length+1,sum=0; for(let i=0;i<b.length;i++) sum+=parseInt(b[i],10)*(f-i); const m=sum%11; return m<2?0:11-m;}; return dv(s.substring(0,9))===parseInt(s[9],10)&&dv(s.substring(0,10))===parseInt(s[10],10); };

        const [[u]]: any = await conn.query(`SELECT u.id, u.account_id, aa.email AS account_email FROM users u LEFT JOIN auth_accounts aa ON aa.id=u.account_id WHERE u.id = ? LIMIT 1`, [id]);
        if (!u) return res.status(404).json({ error: 'Not found' });

        // validações
        if (email) {
          const [dups]: any = await conn.query(`SELECT 1 FROM auth_accounts WHERE email = ? AND provider='email' AND id <> ? LIMIT 1`, [email, u.account_id||0]);
          if ((dups||[]).length) return res.status(409).json({ error: 'E-mail já cadastrado' });
        }
        let cpfNorm = cpfRaw ? normalizeCpf(cpfRaw) : '';
        if (cpfRaw && !isValidCpf(cpfNorm)) return res.status(422).json({ error: 'CPF inválido' });
        if (cpfNorm) {
          const [cdups]: any = await conn.query(`SELECT 1 FROM users WHERE (cpf_bidx = ? OR cpf = ?) AND id <> ? LIMIT 1`, [blindIndex(cpfNorm), cpfNorm, id]);
          if ((cdups||[]).length) return res.status(409).json({ error: 'CPF já cadastrado' });
        }

        await conn.beginTransaction();
        try {
          const updates: string[] = []; const params: any[] = [];
          if (email) { updates.push('email = ?','email_enc = ?','email_bidx = ?'); params.push(email, encrypt(email), blindIndex(email)); }
          if (cpfRaw) { updates.push('cpf = ?','cpf_enc = ?','cpf_bidx = ?'); params.push(cpfNorm, encrypt(cpfNorm), blindIndex(cpfNorm)); }
          if (phone) { updates.push('phone = ?','phone_enc = ?'); params.push(phone, encrypt(phone)); }
          if (visaType) { updates.push('visa_type = ?'); params.push(visaType); }
          if (!updates.length) { await conn.rollback(); return res.status(400).json({ error: 'Nenhuma alteração' }); }
          const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`; params.push(id);
          await conn.query(sql, params);
          if (email && u.account_id) { await conn.query(`UPDATE auth_accounts SET email = ? WHERE id = ?`, [email, u.account_id]); }
          await conn.commit();
        } catch (e) { try { await conn.rollback(); } catch {}; throw e; }
        return res.status(200).json({ ok: true });
      }

      // Administração de usuários do sistema (apenas super ou can_manage_users)
      if (action === 'adminUsersList') {
        if (!isSuper) {
          const [me]: any = await conn.query(`SELECT can_manage_users FROM admin_users WHERE email=? LIMIT 1`, [sessionEmail]);
          if (!(me||[])[0]?.can_manage_users) return res.status(403).json({ error: 'Forbidden' });
        }
        const [rows]: any = await conn.query(`SELECT id,name,email,cpf,birth_date,phone,role,can_manage_users,can_view_all,can_edit_all,is_active,created_at FROM admin_users ORDER BY created_at DESC`);
        return res.status(200).json({ ok: true, rows });
      }
      if (action === 'adminUsersGet') {
        const id = Number(req.query.id || 0); if (!id) return res.status(400).json({ error: 'Missing id' });
        const [rows]: any = await conn.query(`SELECT id,name,email,cpf,birth_date,phone,role,can_manage_users,can_view_all,can_edit_all,view_fields,edit_fields,is_active FROM admin_users WHERE id=? LIMIT 1`, [id]);
        const user = (rows||[])[0]; if (!user) return res.status(404).json({ error: 'Not found' });
        return res.status(200).json({ ok: true, user });
      }
      if (action === 'adminUsersUpsert' && req.method === 'POST') {
        if (!isSuper) {
          const [me]: any = await conn.query(`SELECT can_manage_users FROM admin_users WHERE email=? LIMIT 1`, [sessionEmail]);
          if (!(me||[])[0]?.can_manage_users) return res.status(403).json({ error: 'Forbidden' });
        }
        const body = parseJsonBody(req);
        const id = Number(body?.id || 0);
        const name = String(body?.name||'');
        const email = String(body?.email||'').toLowerCase();
        const cpf = String(body?.cpf||'');
        const birth_date = String(body?.birth_date||'') || null;
        const phone = String(body?.phone||'');
        const role = String(body?.role||'admin');
        const can_manage_users = body?.can_manage_users ? 1:0;
        const can_view_all = body?.can_view_all ? 1:0;
        const can_edit_all = body?.can_edit_all ? 1:0;
        const view_fields = body?.view_fields ? JSON.stringify(body.view_fields) : null;
        const edit_fields = body?.edit_fields ? JSON.stringify(body.edit_fields) : null;
        const is_active = body?.is_active ? 1:0;
        // foto base64 opcional
        let photoBuf: Buffer|null = null;
        if (body?.photo && typeof body.photo === 'string') {
          const s: string = body.photo;
          const b64 = s.startsWith('data:') ? s.substring(s.indexOf(',')+1) : s;
          try { photoBuf = Buffer.from(b64, 'base64'); } catch {}
        }
        if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });
        if (id) {
          const params: any[] = [name,email,cpf,birth_date,phone,role,can_manage_users,can_view_all,can_edit_all,view_fields,edit_fields,is_active];
          let sql = `UPDATE admin_users SET name=?, email=?, cpf=?, birth_date=?, phone=?, role=?, can_manage_users=?, can_view_all=?, can_edit_all=?, view_fields=?, edit_fields=?, is_active=?`;
          if (photoBuf) { sql += `, photo=?`; params.push(photoBuf); }
          sql += ` WHERE id=?`; params.push(id);
          await conn.query(sql, params);
          return res.status(200).json({ ok: true, id });
        } else {
          const [dups]: any = await conn.query(`SELECT 1 FROM admin_users WHERE email=? LIMIT 1`, [email]);
          if ((dups||[]).length) return res.status(409).json({ error: 'E-mail já cadastrado' });
          const [r]: any = await conn.query(`INSERT INTO admin_users (name,email,cpf,birth_date,phone,photo,role,can_manage_users,can_view_all,can_edit_all,view_fields,edit_fields,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [name,email,cpf,birth_date,phone,photoBuf,role,can_manage_users,can_view_all,can_edit_all,view_fields,edit_fields,1]);
          return res.status(200).json({ ok: true, id: r.insertId });
        }
      }
      if (action === 'adminUsersDelete' && req.method === 'POST') {
        if (!isSuper) {
          const [me]: any = await conn.query(`SELECT can_manage_users FROM admin_users WHERE email=? LIMIT 1`, [sessionEmail]);
          if (!(me||[])[0]?.can_manage_users) return res.status(403).json({ error: 'Forbidden' });
        }
        const body = parseJsonBody(req);
        const id = Number(body?.id || 0); if (!id) return res.status(400).json({ error: 'Missing id' });
        await conn.query(`DELETE FROM admin_users WHERE id=?`, [id]);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Invalid action' });
    } catch (e: any) {
      const dbg = String(req.query.debug || '') === '1';
      if (dbg) return res.status(500).json({ error: e?.message || String(e) });
      return res.status(500).json({ error: 'Internal error' });
    } finally {
      try { await conn.end(); } catch {}
    }
  } catch (e:any) {
    return res.status(500).json({ error: 'Internal error', message: e?.message || String(e) });
  }
}

