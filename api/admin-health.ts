export const config = { runtime: 'nodejs' };
export default function handler(req: any, res: any) {
  try { res.status(200).json({ ok: true }); } catch { res.status(500).end('err'); }
}

