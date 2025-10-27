
import type { UserData } from '../types';

class DatabaseService {
  public async saveUserData(data: UserData): Promise<void> {
    const res = await fetch('/api/save-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to save user data: ${res.status} ${text}`);
    }
  }
}

export const databaseService = new DatabaseService();
