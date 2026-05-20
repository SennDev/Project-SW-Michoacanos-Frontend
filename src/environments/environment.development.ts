import { ApiConfig } from '../app/shared/models/api.models';

export const environment = {
  production: false,
  useMockFallback: true,
  api: {
    auth: 'http://3.94.103.183:8011',
    periods: 'http://3.94.103.183:8012',
    academics: 'http://3.94.103.183:8013',
    grades: 'http://3.94.103.183:8014',
    attendance: 'http://3.94.103.183:8015',
    notifications: 'http://3.94.103.183:8016',
    reports: 'http://3.94.103.183:8017'
  } satisfies ApiConfig
};
