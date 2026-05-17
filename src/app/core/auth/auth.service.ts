import { computed, inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, Observable, tap } from 'rxjs';
import { API_CONFIG } from '../tokens/api-config.token';
import { TokenService } from './token.service';
import { ApiResponse } from '../../shared/models/api.models';
import {
  AuthUser,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  ResetPasswordRequest,
  StoredSession,
  TokenResponse,
  UserRole
} from '../../shared/models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly tokens = inject(TokenService);
  private readonly router = inject(Router);

  readonly session = this.tokens.session;
  readonly user = computed(() => this.session()?.user ?? null);
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAuthenticated = computed(() => this.tokens.isValid());

  login(payload: LoginRequest): Observable<AuthUser> {
    return this.http
      .post<ApiResponse<TokenResponse>>(`${this.apiConfig.auth}/auth/login`, payload)
      .pipe(
        map((response) => {
          if (!response.success) {
            throw new Error(response.message || 'No fue posible iniciar sesion.');
          }
          return response.data;
        }),
        tap((token) => this.tokens.save(this.toSession(token))),
        map((token) => token.user)
      );
  }

  refreshProfile(): Observable<AuthUser> {
    return this.http
      .get<ApiResponse<AuthUser>>(`${this.apiConfig.auth}/auth/me`)
      .pipe(
        map((response) => response.data),
        tap((user) => {
          const session = this.session();
          if (session) {
            this.tokens.save({ ...session, user });
          }
        })
      );
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<ForgotPasswordResponse | null> {
    return this.http
      .post<ApiResponse<ForgotPasswordResponse | null>>(`${this.apiConfig.auth}/auth/forgot-password`, payload)
      .pipe(map((response) => response.data));
  }

  resetPassword(payload: ResetPasswordRequest): Observable<null> {
    return this.http
      .post<ApiResponse<null>>(`${this.apiConfig.auth}/auth/reset-password`, payload)
      .pipe(map((response) => response.data));
  }

  logout(redirect = true): void {
    this.tokens.clear();
    if (redirect) {
      void this.router.navigate(['/auth/login']);
    }
  }

  hasAnyRole(roles: readonly UserRole[] | undefined): boolean {
    if (!roles?.length) {
      return true;
    }
    const role = this.role();
    return Boolean(role && roles.includes(role));
  }

  private toSession(token: TokenResponse): StoredSession {
    return {
      token: token.access_token,
      expiresAt: Date.now() + token.expires_in_minutes * 60_000,
      user: token.user
    };
  }
}
