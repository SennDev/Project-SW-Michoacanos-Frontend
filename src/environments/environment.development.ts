import { ApiConfig } from '../app/shared/models/api.models';

export const environment = {
  production: false,
  useMockFallback: true,
  api: {
    auth: 'http://127.0.0.1:8011',
    periods: 'http://127.0.0.1:8012',
    academics: 'http://127.0.0.1:8013',
    grades: 'http://127.0.0.1:8014',
    attendance: 'http://127.0.0.1:8015',
    notifications: 'http://127.0.0.1:8016',
    reports: 'http://127.0.0.1:8017'
  } satisfies ApiConfig
};
