import React from 'react';

type AdminUser = {
  id?: number;
  name: string;
  email: string;
  cpf: string;
  birth_date: string; // yyyy-mm-dd
  phone: string;
  role: string;
  can_manage_users: boolean;
  can_view_all: boolean;
  can_edit_all: boolean;
  view_fields: string;
  edit_fields: string;
  is_active: boolean;
  photo?: string; // base64
};

const AdminUsers: React.FC = () => {
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<AdminUser>({
    name:'', email:'', cpf:'', birth_date:'', phone:'', role:'admin',
    can_manage_users:false, can_view_all:true, can_edit_all:false,
    view_fields:'', edit_fields:'', is_active:true,
  });
  const [err, setErr] = React.useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin3?action=adminUsersList');
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error||'Falha ao carregar');
      setRows(j.rows||[]);
    } catch (e:any) { setErr(e?.message||'Erro'); } finally { setLoading(false); }
  };
  React.useEffect(()=>{ load(); },[]);

  const openNew = () => { setForm({ name:'', email:'', cpf:'', birth_date:'', phone:'', role:'admin', can_manage_users:false, can_view_all:true, can_edit_all:false, view_fields:'', edit_fields:'', is_active:true }); setErr(''); setModalOpen(true); };
  const openEdit = async (id:number) => {
    try {
      const r = await fetch(`/api/admin3?action=adminUsersGet&id=${id}`);
      const j = await r.json(); if(!r.ok||!j.ok) throw new Error(j?.error||'Erro');
      const u = j.user;
      setForm({
        id: u.id,
        name: u.name||'', email: u.email||'', cpf: u.cpf||'', birth_date: u.birth_date||'', phone: u.phone||'', role: u.role||'admin',
        can_manage_users: !!u.can_manage_users, can_view_all: !!u.can_view_all, can_edit_all: !!u.can_edit_all,
        view_fields: (u.view_fields? JSON.parse(u.view_fields).join(','):''),
        edit_fields: (u.edit_fields? JSON.parse(u.edit_fields).join(','):''),
        is_active: !!u.is_active,
      }); setErr(''); setModalOpen(true);
    } catch (e:any) { alert(e?.message||'Erro'); }
  };
  const delRow = async (id:number) => {
    if(!confirm('Remover este usuário do sistema?')) return;
    const r = await fetch('/api/admin3?action=adminUsersDelete', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ id }) });
    const j = await r.json().catch(()=>({})); if(!r.ok) { alert(j?.error||'Erro'); return; }
    await load();
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return;
    const reader = new FileReader(); reader.onload = () => {
      const base64 = String(reader.result||''); setForm(prev=>({ ...prev, photo: base64 }));
    }; reader.readAsDataURL(f);
  };
  // opções de campos aplicáveis às permissões
  const fieldOpts = ['name','email','cpf','birth_date','phone','visa_type','countries'];
  const hasField = (list: string, key: string) => list.split(',').map(s=>s.trim()).filter(Boolean).includes(key);
  const toggleField = (which: 'view'|'edit', key: string, on?: boolean) => {
    const current = (which==='view'? form.view_fields : form.edit_fields).split(',').map(s=>s.trim()).filter(Boolean);
    const set = new Set(current);
    if (on===undefined) {
      if (set.has(key)) set.delete(key); else set.add(key);
    } else {
      if (on) set.add(key); else set.delete(key);
    }
    const str = Array.from(set).join(',');
    setForm(prev => ({ ...prev, [which==='view'?'view_fields':'edit_fields']: str } as any));
  };
  const save = async () => {
    setErr('');
    try {
      const payload = { ...form, view_fields: form.view_fields? form.view_fields.split(',').map(s=>s.trim()).filter(Boolean): undefined, edit_fields: form.edit_fields? form.edit_fields.split(',').map(s=>s.trim()).filter(Boolean): undefined };
      const r = await fetch('/api/admin3?action=adminUsersUpsert', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(()=>({})); if(!r.ok) throw new Error(j?.error||'Erro ao salvar');
      setModalOpen(false); await load();
    } catch (e:any) { setErr(e?.message||'Erro'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Usuários do Sistema</h3>
        <button onClick={openNew} className="px-3 py-1 bg-purple-600 text-white rounded">Novo usuário</button>
      </div>
      {loading && <p className="text-sm text-gray-500">Carregando...</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100"><tr>
            <th className="text-left px-3 py-2">Nome</th>
            <th className="text-left px-3 py-2">E-mail</th>
            <th className="text-left px-3 py-2">CPF</th>
            <th className="text-left px-3 py-2">Nascimento</th>
            <th className="text-left px-3 py-2">Celular</th>
            <th className="text-left px-3 py-2">Permissões</th>
            <th className="text-right px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {rows.map((r:any)=> (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.name||'-'}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.cpf||'-'}</td>
                <td className="px-3 py-2">{r.birth_date||'-'}</td>
                <td className="px-3 py-2">{r.phone||'-'}</td>
                <td className="px-3 py-2">{r.role||'-'} {r.can_manage_users? '• Gerencia usuários':''} {r.can_view_all? '• Ver tudo':''} {r.can_edit_all? '• Edita tudo':''}</td>
                <td className="px-3 py-2 text-right"><button onClick={()=>openEdit(r.id)} className="text-purple-700 underline mr-3">Editar</button><button onClick={()=>delRow(r.id)} className="text-red-700 underline">Excluir</button></td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={7}>Nenhum usuário</td></tr>}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={()=>setModalOpen(false)}>
          <div className="bg-white rounded shadow-xl max-w-2xl w-full p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">{form.id? 'Editar usuário':'Novo usuário'}</h4>
              <button onClick={()=>setModalOpen(false)} className="text-gray-500">Fechar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="block">Nome Completo<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full border rounded px-2 py-1" /></label>
              <label className="block">E-mail<input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full border rounded px-2 py-1" /></label>
              <label className="block">CPF<input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} className="w-full border rounded px-2 py-1" /></label>
              <label className="block">Data de Nascimento<input type="date" value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})} className="w-full border rounded px-2 py-1" /></label>
              <label className="block">Telefone celular<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full border rounded px-2 py-1" /></label>
              <label className="block">Foto<input type="file" accept="image/*" onChange={onFile} className="w-full border rounded px-2 py-1" /></label>
              {form.photo && <img alt="preview" src={form.photo} className="max-h-24 rounded border" />}
              <label className="block">Perfil<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full border rounded px-2 py-1"><option value="admin">admin</option><option value="viewer">viewer</option></select></label>
              <label className="block"><input type="checkbox" checked={form.can_manage_users} onChange={e=>setForm({...form,can_manage_users:e.target.checked})} /> Gerenciar usuários</label>
              <label className="block"><input type="checkbox" checked={form.can_view_all} onChange={e=>setForm({...form,can_view_all:e.target.checked})} /> Ver todos os dados</label>
              <label className="block"><input type="checkbox" checked={form.can_edit_all} onChange={e=>setForm({...form,can_edit_all:e.target.checked})} /> Editar todos os dados</label>
              <div className="md:col-span-2">
                <div className="mb-1 font-medium">Campos visíveis</div>
                <div className="grid grid-cols-2 gap-2">
                  {fieldOpts.map(f => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={hasField(form.view_fields, f)} onChange={e=>toggleField('view', f, e.target.checked)} /> {f}
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-500">Selecione quais campos o usuário pode visualizar.</div>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 font-medium">Campos editáveis</div>
                <div className="grid grid-cols-2 gap-2">
                  {fieldOpts.map(f => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={hasField(form.edit_fields, f)} onChange={e=>toggleField('edit', f, e.target.checked)} /> {f}
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-500">Selecione quais campos o usuário pode editar.</div>
              </div>
              <label className="block"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})} /> Ativo</label>
            </div>
            {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={()=>setModalOpen(false)} className="px-3 py-1 border rounded">Cancelar</button>
              <button onClick={save} className="px-3 py-1 bg-purple-600 text-white rounded">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
