import React from 'react';

type Row = {
  id: number;
  account_id: number | null;
  name?: string | null;
  cpf: string;
  email: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  visa_type: string;
  created_at: string;
};

const AdminDashboard: React.FC = () => {
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const [token, setToken] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [filters, setFilters] = React.useState({ email: '', cpf: '', visaType: '', from: '', to: '' });

  const [detail, setDetail] = React.useState<any | null>(null);
  const [metrics, setMetrics] = React.useState<any | null>(null);

  const check = async () => {
    try { const r = await fetch('/api/admin/me'); const j = await r.json(); setAuthed(!!j.ok); } catch { setAuthed(false); }
  };
  React.useEffect(() => { check(); }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (!r.ok) { const j = await r.json().catch(()=>({})); throw new Error(j?.error || 'Falha ao autenticar'); }
      setToken(''); await check();
    } catch (err:any) { setError(err?.message || 'Erro'); } finally { setLoading(false); }
  };

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); setAuthed(false); setRows([]); };

  const load = async () => {
    if (!authed) return;
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    for (const [k,v] of Object.entries(filters)) if (v) qs.set(k, v);
    const r = await fetch(`/api/admin/users?${qs.toString()}`);
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j?.error || 'Falha ao carregar');
    setRows(j.rows || []); setTotal(j.total || 0);
  };
  React.useEffect(() => { if (authed) { load().catch(()=>{}); } }, [authed, page, pageSize]);

  const onFilterSubmit = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load().catch(()=>{}); };

  const openDetail = async (id: number) => {
    const r = await fetch(`/api/admin/user?id=${id}`);
    const j = await r.json();
    if (!r.ok || !j.ok) return;
    setDetail(j);
  };

  const loadMetrics = async () => {
    if (!authed) return;
    const qs = new URLSearchParams({ days: '30' });
    if (filters.visaType) qs.set('visaType', filters.visaType);
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    const r = await fetch(`/api/admin/metrics?${qs.toString()}`);
    const j = await r.json();
    if (!r.ok || !j.ok) return;
    setMetrics(j);
  };
  React.useEffect(() => { if (authed) { loadMetrics().catch(()=>{}); } }, [authed]);
  const refreshAll = async () => { await Promise.all([load(), loadMetrics()]); };

  if (authed === null) return <div>Verificando...</div>;
  if (!authed) return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Acesso Administrativo</h2>
      <form onSubmit={login} className="space-y-3">
        <input type="password" value={token} onChange={e=>setToken(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Token de administrador" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading || !token} className="px-4 py-2 bg-purple-600 text-white rounded disabled:bg-gray-300">{loading? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>
  );

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Dashboard de Cadastros</h2>
        <div className="flex items-center gap-3">
          <button onClick={refreshAll} className="text-sm text-purple-700 underline">Atualizar</button>
          <button onClick={logout} className="text-sm text-red-600 underline">Sair</button>
        </div>
      </div>

      {/* Cards de métricas */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded border bg-white"><div className="text-xs text-gray-500">Total de usuários</div><div className="text-2xl font-semibold">{metrics.totalUsers}</div></div>
          <div className="p-3 rounded border bg-white"><div className="text-xs text-gray-500">Renovação</div><div className="text-xl">{(metrics.byVisaType||[]).find((x:any)=>x.visaType==='renewal')?.count || 0}</div></div>
          <div className="p-3 rounded border bg-white"><div className="text-xs text-gray-500">Primeiro visto</div><div className="text-xl">{(metrics.byVisaType||[]).find((x:any)=>x.visaType==='first_visa')?.count || 0}</div></div>
          <div className="p-3 rounded border bg-white"><div className="text-xs text-gray-500">Países distintos</div><div className="text-xl">{(metrics.topCountries||[]).length}</div></div>
        </div>
      )}

      {/* Séries por dia (30 dias) */}
      {metrics && (
        <div className="mb-4 p-3 border rounded bg-white">
          <div className="text-sm font-semibold mb-2">Cadastros por dia (últimos 30 dias)</div>
          <ChartBars data={(metrics.byDay||[])} width={600} height={140} />
        </div>
      )}

      {/* Heatmap simples (lat/lng) */}
      {metrics && (
        <div className="mb-4 p-3 border rounded bg-white">
          <div className="text-sm font-semibold mb-2">Mapa de calor (distribuição geográfica)</div>
          <HeatmapWorld points={(metrics.geo||[])} width={600} height={300} />
          <p className="text-xs text-gray-500 mt-1">Representação simplificada (sem tiles); a intensidade reflete clusters aproximados.</p>
        </div>
      )}

      <form onSubmit={onFilterSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <input value={filters.email} onChange={e=>setFilters({...filters, email:e.target.value})} className="border rounded px-2 py-1" placeholder="E-mail" />
        <input value={filters.cpf} onChange={e=>setFilters({...filters, cpf:e.target.value})} className="border rounded px-2 py-1" placeholder="CPF" />
        <select value={filters.visaType} onChange={e=>setFilters({...filters, visaType:e.target.value})} className="border rounded px-2 py-1">
          <option value="">Tipo de visto</option>
          <option value="renewal">Renovação</option>
          <option value="first_visa">Primeiro visto</option>
        </select>
        <input type="date" value={filters.from} onChange={e=>setFilters({...filters, from:e.target.value})} className="border rounded px-2 py-1" />
        <input type="date" value={filters.to} onChange={e=>setFilters({...filters, to:e.target.value})} className="border rounded px-2 py-1" />
        <div className="md:col-span-5 flex items-center gap-3">
          <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded">Filtrar</button>
          <span className="text-sm text-gray-600">Total: {total}</span>
          <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); setPage(1);}} className="border rounded px-2 py-1">
            {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/página</option>)}
          </select>
        </div>
      </form>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">E-mail</th>
              <th className="text-left px-3 py-2">CPF</th>
              <th className="text-left px-3 py-2">Telefone</th>
              <th className="text-left px-3 py-2">Visto</th>
              <th className="text-left px-3 py-2">Criado em</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.id}</td>
                <td className="px-3 py-2">{r.name || '-'}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.cpf}</td>
                <td className="px-3 py-2">{r.phone || '-'}</td>
                <td className="px-3 py-2">{r.visa_type}</td>
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right"><button onClick={()=>openDetail(r.id)} className="text-purple-700 underline">Ver</button></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={8}>Sem registros</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded disabled:opacity-50">Anterior</button>
        <span className="text-sm">Página {page} de {pages}</span>
        <button disabled={page>=pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded disabled:opacity-50">Próxima</button>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={()=>setDetail(null)}>
          <div className="bg-white rounded shadow-xl max-w-2xl w-full p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Detalhes do Usuário #{detail.user?.id}</h3>
              <button onClick={()=>setDetail(null)} className="text-gray-500">Fechar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><strong>Nome:</strong> {detail.user?.name || '-'}</div>
              <div><strong>E-mail:</strong> {detail.user?.email}</div>
              <div><strong>CPF:</strong> {detail.user?.cpf}</div>
              <div><strong>Telefone:</strong> {detail.user?.phone || '-'}</div>
              <div><strong>Tipo de visto:</strong> {detail.user?.visa_type}</div>
              <div><strong>Coordenadas:</strong> {detail.user?.latitude},{detail.user?.longitude}</div>
              <div className="md:col-span-2"><strong>Criado em:</strong> {new Date(detail.user?.created_at).toLocaleString()}</div>
            </div>
            <div className="mt-3">
              <h4 className="font-semibold mb-1">Redes sociais</h4>
              {(detail.social||[]).length ? (
                <ul className="list-disc list-inside text-sm">
                  {detail.social.map((s:any, i:number)=> <li key={i}>{s.platform}: {s.handle}</li>)}
                </ul>
              ) : <p className="text-sm text-gray-500">Nenhuma</p>}
            </div>
            <div className="mt-3">
              <h4 className="font-semibold mb-1">Países</h4>
              {(detail.countries||[]).length ? (
                <ul className="list-disc list-inside text-sm">
                  {detail.countries.map((c:any, i:number)=> <li key={i}>{c.country}</li>)}
                </ul>
              ) : <p className="text-sm text-gray-500">Nenhum</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

// Componentes auxiliares (gráfico de barras e heatmap simplificado)
const ChartBars: React.FC<{ data: { day: string; count: number }[]; width: number; height: number }> = ({ data, width, height }) => {
  const pad = 24;
  const w = width, h = height;
  const max = Math.max(1, ...data.map(d=>Number(d.count||0)));
  const bw = Math.max(1, Math.floor((w - pad*2) / Math.max(1, data.length)) - 2);
  return (
    <svg width={w} height={h} className="block">
      <rect x={0} y={0} width={w} height={h} fill="#fafafa"/>
      {data.map((d,i)=>{
        const x = pad + i*(bw+2);
        const val = Number(d.count||0);
        const bh = Math.round(((h-pad*1.5) * val) / max);
        const y = h - pad - bh;
        return <rect key={i} x={x} y={y} width={bw} height={bh} fill="#7c3aed" />
      })}
    </svg>
  );
};

const HeatmapWorld: React.FC<{ points: { lat: number; lng: number; count: number }[]; width: number; height: number }> = ({ points, width, height }) => {
  const max = Math.max(1, ...points.map(p=>Number(p.count||0)));
  return (
    <div style={{ width, height }} className="relative bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden border rounded">
      {points.map((p, i) => {
        const x = ((Number(p.lng)+180) / 360) * width;
        const y = ((90 - Number(p.lat)) / 180) * height;
        const alpha = Math.min(0.9, Math.max(0.1, Number(p.count)/max));
        const size = 6 + Math.round(14 * (Number(p.count)/max));
        return <div key={i} style={{ left: x - size/2, top: y - size/2, width: size, height: size, opacity: alpha }} className="absolute rounded-full bg-orange-600 mix-blend-multiply" />
      })}
    </div>
  );
};
