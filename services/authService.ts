// Serviço de autenticação apenas com e-mail/senha (logins sociais removidos)
class AuthService {
  public async loginWithEmail(email: string, password: string): Promise<void> {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Falha no login');
  }

  public async registerWithEmail(name: string, email: string, password: string): Promise<void> {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) throw new Error('Falha no cadastro');
  }
}

export const authService = new AuthService();

