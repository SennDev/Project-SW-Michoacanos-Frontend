import { Injectable, signal } from '@angular/core';
import { StoredSession } from '../../shared/models/auth.models';

const STORAGE_KEY = 'agm.session';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly stored = signal<StoredSession | null>(this.readSession());

  readonly session = this.stored.asReadonly();

  token(): string | null {
    return this.stored()?.token ?? null;
  }

  save(session: StoredSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.stored.set(session);
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.stored.set(null);
  }

  isValid(): boolean {
    const session = this.stored();
    return Boolean(session?.token && session.expiresAt > Date.now());
  }

  private readSession(): StoredSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as StoredSession;
      if (!session.token || !session.user || session.expiresAt <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }
}
