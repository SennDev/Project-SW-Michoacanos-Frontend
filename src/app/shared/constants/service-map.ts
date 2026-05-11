import { ApiServiceKey } from '../models/api.models';

export const AGM_SERVICES: Array<{ key: ApiServiceKey; name: string; port: number; description: string }> = [
  { key: 'auth', name: 'Auth', port: 8011, description: 'Login, JWT y RBAC' },
  { key: 'periods', name: 'Periodos', port: 8012, description: 'Periodos y materias' },
  { key: 'academics', name: 'Academicos', port: 8013, description: 'Docentes, alumnos e inscripciones' },
  { key: 'grades', name: 'Calificaciones', port: 8014, description: 'Ponderaciones y concentrados' },
  { key: 'attendance', name: 'Asistencias', port: 8015, description: 'Sesiones QR' },
  { key: 'notifications', name: 'Notificaciones', port: 8016, description: 'Correo y eventos' },
  { key: 'reports', name: 'Reportes', port: 8017, description: 'PDF, XLSX y estadisticas' }
];
