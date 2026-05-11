export interface NotificationPayload {
  alumno_id?: number | null;
  docente_id?: number | null;
  materia_id?: number | null;
  materia_nombre?: string;
  motivo?: string;
  alumnos_emails?: string[];
}

export interface WelcomePayload {
  alumno_id: number;
  materia_id: number;
  email: string;
  nombre: string;
  temporary_password?: string;
}

export interface ResetPasswordPayload {
  email: string;
  reset_token: string;
}

export interface NotificationResult {
  status: string;
  total_enviados?: number;
}
