import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { API_CONFIG } from '../tokens/api-config.token';
import { AGM_SERVICES } from '../../shared/constants/service-map';
import { ApiResponse, HealthStatus } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  checkAll(): Observable<HealthStatus[]> {
    return forkJoin(AGM_SERVICES.map((service) => this.check(service.key)));
  }

  check(key: HealthStatus['key']): Observable<HealthStatus> {
    const meta = AGM_SERVICES.find((service) => service.key === key);
    const started = performance.now();
    return this.http.get<ApiResponse<{ service: string; status: string }>>(`${this.config[key]}/health`).pipe(
      map((response) => ({
        key,
        name: meta?.name ?? key,
        port: meta?.port ?? 0,
        status: response.success ? 'online' : 'degraded',
        latencyMs: Math.round(performance.now() - started),
        message: response.data?.status ?? response.message
      }) satisfies HealthStatus),
      catchError(() => of({
        key,
        name: meta?.name ?? key,
        port: meta?.port ?? 0,
        status: 'offline',
        latencyMs: Math.round(performance.now() - started),
        message: 'Sin respuesta'
      } satisfies HealthStatus))
    );
  }
}
