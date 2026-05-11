export interface AttendanceSession {
  session_id: number;
  materia_id: number;
  started_at: string;
  closes_at: string;
  status?: string;
}

export interface QrPayload {
  token: string;
  qr_png_base64: string;
  issued_at: number;
}

export interface AttendanceRecord {
  session_id: number;
  student_id: number;
  estado: 'Presente' | 'Retardo' | string;
  registered_at: string;
}

export interface AttendanceRegistration {
  estado: string;
  alumno_id: number;
}
