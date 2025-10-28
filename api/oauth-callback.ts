import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { setAuthCookie, signToken } from './_auth';

function getCookie(req: VercelRequest, name: string) {
  const c = req.headers.cookie || '';
  const part = c.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.split('=')[1]) : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_REDIRECT_URI, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as Record<string, string | undefined>;
    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_REDIRECT_URI) {
      return res.status(500).send('Missing Auth0 env (DOMAIN/CLIENT_ID/REDIRECT_URI)');
    }
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
      return res.status(500).send('Missing DB env');
    }

    const { code, state } = req.query as any;
    const expectedState = getCookie(req, 'oauth_state');
    const verifier = getCookie(req, 'oauth_verifier');
    if (!code || !state || !verifier || state !== expectedState) {
      return res.status(400).send('Invalid state or missing verifier');
    }

    // Exchange code for tokens
    const tokenResp = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: AUTH0_CLIENT_ID,
        // client_secret omitted for SPA/public clients
        code: String(code),
        code_verifier: verifier,
        redirect_uri: AUTH0_REDIRECT_URI,
      }),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return res.status(500).send(`Failed to exchange code: ${t}`);
    }
    const tokens: any = await tokenResp.json();

    // Get user info
    const userInfoResp = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResp.ok) {
      const t = await userInfoResp.text();
      return res.status(500).send(`Failed to fetch userinfo: ${t}`);
    }
    const user = await userInfoResp.json();
    const email = String(user.email || '');
    const name = String(user.name || '');
    const sub: string = String(user.sub || '');
    const provider = sub.includes('google')
      ? 'google'
      : sub.includes('apple')
      ? 'apple'
      : (sub.includes('microsoft') || sub.includes('windowslive'))
      ? 'microsoft'
      : 'email';

    const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME });
    try {
      await conn.execute(
        `INSERT INTO auth_accounts (email, provider, name) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [email, provider, name]
      );
      const [rows] = await conn.execute(`SELECT id FROM auth_accounts WHERE email = ? AND provider = ? LIMIT 1`, [email, provider]);
      const accountId = (rows as any)[0]?.id as number;
      const token = signToken({ accountId, email });
      setAuthCookie(res, token);
      res.status(302).setHeader('Location', '/').end();
    } finally {
      await conn.end();
    }
  } catch (e: any) {
    res.status(500).send(e?.message || String(e));
  }
}
