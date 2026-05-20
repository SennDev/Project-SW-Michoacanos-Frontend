import { NavItem } from '../models/ui.models';

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    route: '/dashboard',
    icon: 'grid',
    roles: ['admin', 'docente', 'alumno'],
    description: 'Resumen institucional'
  },
  {
    label: 'Periodos',
    route: '/periods',
    icon: 'calendar',
    roles: ['admin', 'docente', 'alumno'],
    description: 'Periodos y materias'
  },
  {
    label: 'Academicos',
    route: '/academics',
    icon: 'users',
    roles: ['admin', 'docente'],
    description: 'Docentes, alumnos e inscripciones'
  },
  {
    label: 'Calificaciones',
    route: '/grades',
    icon: 'grades',
    roles: ['admin', 'docente', 'alumno'],
    description: 'Ponderaciones y concentrados'
  },
  {
    label: 'Asistencias',
    route: '/attendance',
    icon: 'qr',
    roles: ['admin', 'docente', 'alumno'],
    description: 'Sesiones QR y registro'
  },
  {
    label: 'Notificaciones',
    route: '/notifications',
    icon: 'mail',
    roles: ['admin'],
    description: 'Correos y bitacora admin'
  },
  {
    label: 'Reportes',
    route: '/reports',
    icon: 'file',
    roles: ['admin', 'docente', 'alumno'],
    description: 'Exportaciones PDF y XLSX'
  },
  {
    label: 'Salud',
    route: '/system-health',
    icon: 'pulse',
    roles: ['admin'],
    description: 'Estado de microservicios'
  }
];
