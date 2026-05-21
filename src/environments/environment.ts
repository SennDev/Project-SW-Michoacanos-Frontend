import { ApiConfig } from '../app/shared/models/api.models';

export const environment = {
  production: true,
  useMockFallback: false,
  api: {
    auth: 'http://3.95.61.121/api/auth',
    periods: 'http://3.95.61.121/api/periods',
    academics: 'http://3.95.61.121/api/academics',
    grades: 'http://3.95.61.121/api/grades',
    attendance: 'http://3.95.61.121/api/attendance',
    notifications: 'http://3.95.61.121/api/notifications',
    reports: 'http://3.95.61.121/api/reports'
  } satisfies ApiConfig
};
