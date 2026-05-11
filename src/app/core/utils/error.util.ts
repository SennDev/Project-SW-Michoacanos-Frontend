import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(error: unknown, fallback = 'No fue posible completar la operacion.'): string {
  if (error instanceof HttpErrorResponse) {
    const detail = typeof error.error?.detail === 'string'
      ? error.error.detail
      : typeof error.error?.message === 'string'
        ? error.error.message
        : '';
    return detail || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}
