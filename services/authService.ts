// This is a mock authentication service.
// In a real application, this would interact with a backend authentication service
// like Firebase Authentication, Auth0, or a custom identity provider.

class AuthService {
  /**
   * Simulates logging in a user with email and password.
   * @returns A promise that resolves on "successful" login.
   */
  public loginWithEmail(email: string, password: string): Promise<void> {
    console.log(`--- SIMULATING EMAIL LOGIN for ${email} ---`);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email && password) {
          console.log("--- LOGIN SUCCESSFUL ---");
          resolve();
        } else {
          console.error("--- LOGIN FAILED: Email or password empty ---");
          reject(new Error("Email e senha são obrigatórios."));
        }
      }, 1000); // 1-second delay
    });
  }

  /**
   * Simulates registering a new user.
   * @returns A promise that resolves on "successful" registration.
   */
  public registerWithEmail(name: string, email: string, password: string): Promise<void> {
    console.log(`--- SIMULATING EMAIL REGISTRATION for ${name} (${email}) ---`);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (name && email && password) {
          console.log("--- REGISTRATION SUCCESSFUL ---");
          resolve();
        } else {
           console.error("--- REGISTRATION FAILED: Missing fields ---");
          reject(new Error("Todos os campos são obrigatórios."));
        }
      }, 1500); // 1.5-second delay
    });
  }

  /**
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
