import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_CONFIG } from '../tokens/api-config.token';
import { ApiResponse, ApiServiceKey } from '../../shared/models/api.models';

type QueryValue = string | number | boolean | null | undefined;

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  get<T>(service: ApiServiceKey, path: string, params?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.url(service, path), { params: this.params(params) })
      .pipe(map((response) => this.unwrap(response)));
  }

  post<T>(service: ApiServiceKey, path: string, body?: unknown, params?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(service, path), body ?? {}, { params: this.params(params) })
      .pipe(map((response) => this.unwrap(response)));
  }

  put<T>(service: ApiServiceKey, path: string, body?: unknown): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(this.url(service, path), body ?? {})
      .pipe(map((response) => this.unwrap(response)));
  }

  delete<T>(service: ApiServiceKey, path: string, params?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .delete<ApiResponse<T>>(this.url(service, path), { params: this.params(params) })
      .pipe(map((response) => this.unwrap(response)));
  }

  upload<T>(service: ApiServiceKey, path: string, file: File, extra?: Record<string, QueryValue>): Observable<T> {
    const body = new FormData();
    body.append('file', file);
    Object.entries(extra ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        body.append(key, String(value));
      }
    });
    return this.http
      .post<ApiResponse<T>>(this.url(service, path), body)
      .pipe(map((response) => this.unwrap(response)));
  }

  blob(service: ApiServiceKey, path: string, params?: Record<string, QueryValue>): Observable<Blob> {
    return this.http.get(this.url(service, path), {
      params: this.params(params),
      responseType: 'blob'
    });
  }

  rawUrl(service: ApiServiceKey, path: string): string {
    return this.url(service, path);
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      throw new Error(response.message || 'La respuesta del servicio no fue exitosa.');
    }
    return response.data;
  }

  private url(service: ApiServiceKey, path: string): string {
    const base = this.config[service].replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }

  private params(params?: Record<string, QueryValue>): HttpParams {
    let result = new HttpParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result = result.set(key, String(value));
      }
    });
    return result;
  }
}
