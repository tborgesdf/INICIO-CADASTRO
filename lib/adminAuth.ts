import * as crypto from 'crypto';

const ADMIN_COOKIE = 'admin_session';

function b64url(b: Buffer | string) {
  return (typeof b === 'string' ? Buffer.from(b) : b)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
}

export function setAdminCookie(res: any) {
  const secret = process.env.JWT_SECRET || 'change-me-dev';
  const now = Math.floor(Date.now()/1000);
  const payload = JSON.stringify({ adm: true, iat: now });
  const sigB64 = crypto.createHmac('sha256', secret).update(payload).digest('base64');
  const sig = sigB64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const val = b64url(Buffer.from(payload)) + '.' + sig;
  const isProd = process.env.NODE_ENV === 'production';
  const cookie = `${ADMIN_COOKIE}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${2*60*60}; ${isProd?'Secure':''}`;
  res.setHeader('Set-Cookie', cookie);
}

export function clearAdminCookie(res: any) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

export function isAdmin(req: any): boolean {
  try {
    const cookie: string = req.headers?.cookie || '';
    const part = cookie.split(';').map((s:string)=>s.trim()).find((s:string)=>s.startsWith(`${ADMIN_COOKIE}=`));
    if (!part) return false;
    const val = decodeURIComponent(part.split('=')[1]||'');
    const [p,s] = val.split('.');
    if (!p || !s) return false;
    const payload = Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
    const secret = process.env.JWT_SECRET || 'change-me-dev';
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64')
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (sig !== s) return false;
    const obj = JSON.parse(payload);
    return !!obj.adm;
  } catch { return false; }
}
