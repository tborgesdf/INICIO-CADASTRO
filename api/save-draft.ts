import type { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import * as crypto from 'crypto';

const COOKIE = 'auth_token';
function getToken(req:any){ const c=req.headers?.cookie||''; const m=c.split(';').map((s:string)=>s.trim()).find((s:string)=>s.startsWith(COOKIE+'=')); return m? decodeURIComponent(m.split('=')[1]): null; }
function verify(tok:string){ try{ const [h,p,s]=tok.split('.'); if(!(h&&p&&s)) return null; const sec=process.env.JWT_SECRET||'change-me-dev'; const exp=crypto.createHmac('sha256',sec).update(`${h}.${p}`).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); if(exp!==s) return null; const payload=JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')); const now=Math.floor(Date.now()/1000); if(payload.exp&&now>payload.exp) return null; return payload; }catch{return null;} }

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse){
  try{
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
    const tok=getToken(req); const dec=tok?verify(tok):null; const accountId=dec?.accountId? Number(dec.accountId): null; if(!accountId) return res.status(401).json({error:'Unauthorized'});
    let body:any={}; try{ const raw:(any)=(req as any).body; body= typeof raw==='string'? JSON.parse(raw): (typeof raw==='object'? raw: {});}catch{ body={}; }
    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env as any; if(!DB_HOST||!DB_USER||!DB_PASSWORD||!DB_NAME) return res.status(500).json({error:'Missing DB env vars'});
    const conn = await mysql.createConnection({ host:DB_HOST, user:DB_USER, password:DB_PASSWORD, database:DB_NAME });
    try{
      // Find latest in_progress draft
      const [rows]: any = await conn.query(`SELECT id FROM users WHERE account_id=? AND status='in_progress' ORDER BY created_at DESC LIMIT 1`, [accountId]);
      const draftId = (rows||[])[0]?.id || null;
      // Build dynamic update
      const fields: string[] = []; const params: any[] = [];
      const setIf = (col:string, val:any) => { if(val!==undefined){ fields.push(`${col}=?`); params.push(val); } };
      setIf('cpf', body.cpf);
      setIf('phone', body.phone);
      setIf('email', body.email);
      setIf('latitude', body.location?.latitude ?? null);
      setIf('longitude', body.location?.longitude ?? null);
      setIf('visa_type', body.visaType);
      if(draftId){
        if(fields.length){ await conn.query(`UPDATE users SET ${fields.join(', ')} WHERE id=?`, [...params, draftId]); }
      } else {
        await conn.query(`INSERT INTO users (account_id, cpf, phone, email, latitude, longitude, visa_type, status) VALUES (?,?,?,?,?,?,?, 'in_progress')`, [accountId, body.cpf??null, body.phone??null, body.email??null, body.location?.latitude ?? null, body.location?.longitude ?? null, body.visaType??null]);
      }
      // Optionally save social and countries if provided
      const idRes: any = draftId ? draftId : (await conn.query(`SELECT id FROM users WHERE account_id=? ORDER BY created_at DESC LIMIT 1`, [accountId]) as any)[0][0]?.id;
      const userId = idRes;
      if (userId && body.socialMedia && typeof body.socialMedia==='object'){
        await conn.query(`DELETE FROM user_social_media WHERE user_id=?`, [userId]);
        const entries = Object.entries(body.socialMedia).filter(([,v])=>!!v);
        if(entries.length){
          const values:any[]=[]; const ph:string[]=[]; for(const [platform, handle] of entries){ ph.push('(?,?,?)'); values.push(userId, platform, String(handle)); }
          await conn.query(`INSERT INTO user_social_media (user_id, platform, handle) VALUES ${ph.join(',')}`, values);
        }
      }
      if (userId && Array.isArray(body.countries)){
        await conn.query(`DELETE FROM user_countries WHERE user_id=?`, [userId]);
        if(body.countries.length){
          const values:any[]=[]; const ph:string[]=[]; for(const c of body.countries){ ph.push('(?,?)'); values.push(userId, String(c)); }
          await conn.query(`INSERT INTO user_countries (user_id, country) VALUES ${ph.join(',')}`, values);
        }
      }
      return res.status(200).json({ ok:true });
    } finally { try{ await conn.end(); }catch{} }
  }catch(e:any){ return res.status(500).json({error:'Internal error', message:e?.message||String(e)}); }
}

