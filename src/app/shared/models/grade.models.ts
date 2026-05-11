export interface WeightCategory {
  id: number;
  materia_id: number;
  nombre: string;
  porcentaje: number;
}

export interface WeightPayload {
  items: Array<Pick<WeightCategory, 'nombre' | 'porcentaje'>>;
}

export interface ActivityPayload {
  materia_id: number;
  categoria_id: number;
  nombre: string;
  max_puntos: number;
}

export interface LocalActivity extends ActivityPayload {
  id: number;
  created_at: string;
}

export interface GradePayload {
  activity_id: number;
  student_id: number;
  score: number;
}

export interface GradeSummary {
  alumno_id: number;
  matricula: string;
  nombre: string;
  promedio_real: number;
  promedio_redondeado: number;
}
