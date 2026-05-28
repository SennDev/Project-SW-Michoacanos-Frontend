import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../core/services/api-client.service';
import { AttendanceRecord, AttendanceRegistration, AttendanceSession, QrPayload } from '../shared/models/attendance.models';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly api = inject(ApiClientService);

  startSession(subjectId: number): Observable<AttendanceSession> {
    return this.api.post<AttendanceSession>('attendance', '/sesiones/iniciar', { materia_id: subjectId });
  }

  getActiveSession(subjectId: number): Observable<AttendanceSession | null> {
    return this.api.get<AttendanceSession | null>('attendance', `/sesiones/activa/${subjectId}`);
  }

  generateQr(subjectId: number, sessionId: number): Observable<QrPayload> {
    return this.api.get<QrPayload>('attendance', `/qr/${subjectId}`, { session_id: sessionId });
  }

  registerAttendance(token: string): Observable<AttendanceRegistration> {
    return this.api.post<AttendanceRegistration>('attendance', '/asistencias/registrar', { token });
  }

  closeSession(sessionId: number): Observable<null> {
    return this.api.delete<null>('attendance', `/sesiones/${sessionId}/cerrar`);
  }

  attendanceToday(subjectId: number): Observable<AttendanceRecord[]> {
    return this.api.get<AttendanceRecord[]>('attendance', `/asistencias/${subjectId}/hoy`);
  }

  attendanceHistory(subjectId: number): Observable<AttendanceRecord[]> {
    return this.api.get<AttendanceRecord[]>('attendance', `/asistencias/${subjectId}/historial`);
  }
}
