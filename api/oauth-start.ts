import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function base64url(input: Buffer) {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_REDIRECT_URI } = process.env as Record<string, string | undefined>;
    if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_REDIRECT_URI) {
      return res.status(500).send('Missing Auth0 env (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_REDIRECT_URI)');
    }

    const connection = (req.query.connection as string) || undefined; // 'google' | 'apple' | undefined

    // PKCE
    const codeVerifier = base64url(crypto.randomBytes(32));
    const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
    const state = base64url(crypto.randomBytes(16));

    const isProd = process.env.NODE_ENV === 'production';
    const cookie = [
      `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${isProd ? 'Secure' : ''}`,
      `oauth_verifier=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${isProd ? 'Secure' : ''}`,
    ];
    res.setHeader('Set-Cookie', cookie);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: AUTH0_CLIENT_ID,
      redirect_uri: AUTH0_REDIRECT_URI,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });
    if (connection) params.set('connection', connection);

    const authorizeUrl = `https://${AUTH0_DOMAIN}/authorize?${params.toString()}`;
    res.status(302).setHeader('Location', authorizeUrl).end();
  } catch (e: any) {
    res.status(500).send(e?.message || String(e));
  }
}

