// Serviço de autenticação (e-mail/CPF + senha)
class AuthService {
  public async login(identifier: { email?: string; cpf?: string }, password: string): Promise<void> {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...identifier, password }),
    });
    if (!res.ok) {
      let msg = 'Falha no login';
      try {
        const j = await res.json().catch(() => undefined);
        const s = res.status;
        if (s === 401) msg = 'Credenciais inválidas';
        else if (s === 422) msg = 'CPF inválido';
        else if (s === 400) msg = 'Dados inválidos';
        else if (s >= 500) msg = 'Erro interno. Tente novamente.';
        if (j?.error) {
          const e = String(j.error);
          if (/invalid cpf/i.test(e)) msg = 'CPF inválido';
          if (/invalid credentials/i.test(e)) msg = 'Credenciais inválidas';
        }
      } catch {}
      throw new Error(msg);
    }
  }

  public async register(name: string, email: string, password: string, cpf: string): Promise<void> {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, cpf }),
    });
    if (!res.ok) {
      let msg = 'Falha no cadastro';
      try {
        const j = await res.json().catch(() => undefined);
        const s = res.status;
        if (s === 422) msg = 'CPF inválido';
        else if (s === 409) msg = 'Conflito: e-mail ou CPF já cadastrado';
        else if (s === 400) msg = 'Campos obrigatórios ausentes';
        else if (s >= 500) msg = 'Erro interno. Tente novamente.';
        if (j?.error) {
          const e = String(j.error);
          if (/email already registered/i.test(e)) msg = 'E-mail já cadastrado';
          if (/cpf already registered/i.test(e)) msg = 'CPF já cadastrado';
          if (/invalid cpf/i.test(e)) msg = 'CPF inválido';
        }
      } catch {}
      throw new Error(msg);
    }
  }

  public async checkAvailability(params: { email?: string; cpf?: string }) {
    const qs = new URLSearchParams(params as any).toString();
    const res = await fetch(`/api/check-availability?${qs}`);
    if (!res.ok) return { emailAvailable: null, cpfAvailable: null } as any;
    return res.json();
  }
}

export const authService = new AuthService();
