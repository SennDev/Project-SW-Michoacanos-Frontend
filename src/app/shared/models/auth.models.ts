export type UserRole = 'admin' | 'docente' | 'alumno';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  display_name: string;
  profile_id: number | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in_minutes: number;
  user: AuthUser;
}

export interface StoredSession {
  token: string;
  expiresAt: number;
  user: AuthUser;
}
