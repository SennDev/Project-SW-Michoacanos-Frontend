export type ReportFormat = 'pdf' | 'xlsx';
export type ReportType = 'calificaciones' | 'asistencias';

export interface TeacherStats {
  materia_id: number;
  materia: string;
  promedio_grupal: number;
  aprobacion: number;
  sesiones: number;
  asistencias: number;
  retardos: number;
}

export interface StudentStats {
  faltas: number;
  materia_id: number;
  materia: string;
  promedio_actual: number;
  asistencias: number;
}

export interface DownloadHistoryItem {
  id: string;
  type: ReportType;
  subjectId: number;
  format: ReportFormat;
  filename: string;
  createdAt: string;
}
