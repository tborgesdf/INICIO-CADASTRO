// This is a mock authentication service.
// In a real application, this would interact with a backend authentication service
// like Firebase Authentication, Auth0, or a custom identity provider.

class AuthService {
  /**
   * Simulates logging in a user with email and password.
   * @returns A promise that resolves on "successful" login.
   */
  public async loginWithEmail(email: string, password: string): Promise<void> {\r\n    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });\r\n    if (!res.ok) throw new Error('Falha no login');\r\n  }\r\n\r\n  /**
   * Simulates registering a new user.
   * @returns A promise that resolves on "successful" registration.
   */
  public async registerWithEmail(name: string, email: string, password: string): Promise<void> {\r\n    const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });\r\n    if (!res.ok) throw new Error('Falha no cadastro');\r\n  }\r\n\r\n  /**
   * Simulates logging in with a Google account.
   * @returns A promise that resolves on "successful" login.
   */
  public loginWithGoogle(): Promise<void> {
    console.log("--- SIMULATING GOOGLE LOGIN ---");
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("--- GOOGLE LOGIN SUCCESSFUL ---");
        resolve();
      }, 700);
    });
  }

  /**
   * Simulates logging in with an Apple account.
   * @returns A promise that resolves on "successful" login.
   */
  public loginWithApple(): Promise<void> {
    console.log("--- SIMULATING APPLE LOGIN ---");
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("--- APPLE LOGIN SUCCESSFUL ---");
        resolve();
      }, 700);
    });
  }
}

export const authService = new AuthService();

// Auth service utilizado pelo front. Integra com nossas rotas serverless
// para login/cadastro via e-mail/senha e inicia o fluxo OAuth via Auth0.

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

  // Inicia OAuth no Auth0 (conexões corretas)
  public loginWithGoogle(): void {
    window.location.href = '/api/oauth-start?connection=google-oauth2';
  }

  public loginWithApple(): void {
    window.location.href = '/api/oauth-start?connection=apple';
  }

  public loginWithMicrosoft(): void {
    window.location.href = '/api/oauth-start?connection=windowslive';
  }
}

export const authService = new AuthService();
