export interface Period {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  plan_estudios: string;
  activo: boolean;
}

export interface PeriodPayload {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  plan_estudios: string;
  activo: boolean;
}

export interface ScheduleSlot {
  dia: string;
  hora: string;
  salon: string;
}

export interface Subject {
  id: number;
  period_id: number;
  docente_id: number | null;
  nrc: string;
  clave: string;
  nombre: string;
  seccion: string;
  docente_nombre: string;
  horario: ScheduleSlot[];
  salon: string;
  estado: string;
}

export interface Teacher {
  id: number;
  nombre: string;
  email: string;
  ubicacion: string;
  extension: string;
}

export interface Student {
  id: number;
  matricula: string;
  nombre: string;
  email: string;
  status: string;
  nivel: string;
  activo?: boolean;
  baja_count?: number;
}

export interface ImportResult {
  periodo_id?: number;
  periodo_nombre?: string;
  plan_estudios?: string;
  materias_detectadas?: number;
  materias_nuevas?: number;
  detectados?: number;
  creados?: number;
  alumnos_detectados?: number;
  alumnos_nuevos?: number;
  preview?: unknown[];
  [key: string]: unknown;
}
