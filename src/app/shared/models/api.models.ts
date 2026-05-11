export type ApiServiceKey = 'auth' | 'periods' | 'academics' | 'grades' | 'attendance' | 'notifications' | 'reports';

export type ApiConfig = Record<ApiServiceKey, string>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export interface HealthStatus {
  key: ApiServiceKey;
  name: string;
  port: number;
  status: 'online' | 'offline' | 'degraded';
  latencyMs?: number;
  message?: string;
}
