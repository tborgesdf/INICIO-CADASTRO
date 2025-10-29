import React from 'react';

const MyProcesses: React.FC = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [err, setErr] = React.useState('');
  const visaLabel = (v?: string) => v === 'renewal' ? 'Renovação' : v === 'first_visa' ? 'Primeiro visto' : (v || '-');
  const fmt = (s:any) => { try { const d=new Date(s); return new Intl.DateTimeFormat('pt-BR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);} catch{ return String(s||''); } };
  React.useEffect(()=>{ (async()=>{
    try { const r = await fetch('/api/my-processes'); const j = await r.json(); if(!r.ok||!j.ok) throw new Error(j?.error||'Erro'); setItems(j.items||[]);} catch(e:any){ setErr(e?.message||'Erro'); }
  })(); },[]);
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Meus processos</h2>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100"><tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-t"><td className="px-3 py-2">{it.id}</td><td className="px-3 py-2">{fmt(it.created_at)}</td><td className="px-3 py-2">{visaLabel(it.visa_type)}</td><td className="px-3 py-2">{it.status||'-'}</td></tr>
            ))}
            {items.length===0 && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>Nenhum processo</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyProcesses;

