import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_CONFIG } from '../tokens/api-config.token';
import { TokenService } from '../auth/token.service';
import { ToastService } from '../services/toast.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);
  const tokens = inject(TokenService);
  const router = inject(Router);
  const toasts = inject(ToastService);

  const isAgmApi = Object.values(config).some((base) => request.url.startsWith(base));
  const token = tokens.token();
  const authRequest = isAgmApi && token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          tokens.clear();
          toasts.warning('Sesion finalizada', 'Vuelve a iniciar sesion para continuar.');
          void router.navigate(['/auth/login']);
        }
        if (error.status === 403) {
          toasts.error('Acceso restringido', 'Tu rol no tiene permisos para esta accion.');
        }
      }
      return throwError(() => error);
    })
  );
};
