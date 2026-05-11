import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiClientService } from '../core/services/api-client.service';
import { AttendanceRecord, AttendanceRegistration, AttendanceSession, QrPayload } from '../shared/models/attendance.models';

const LOCAL_SESSION_KEY = 'agm.local.attendance-sessions';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly api = inject(ApiClientService);

  startSession(subjectId: number): Observable<AttendanceSession> {
    return this.api.post<AttendanceSession>('attendance', '/sesiones/iniciar', { materia_id: subjectId }).pipe(
      tap((session) => this.rememberSession({ ...session, status: 'abierta' }))
    );
  }

  generateQr(subjectId: number, sessionId: number): Observable<QrPayload> {
    return this.api.get<QrPayload>('attendance', `/qr/${subjectId}`, { session_id: sessionId });
  }

  registerAttendance(token: string): Observable<AttendanceRegistration> {
    return this.api.post<AttendanceRegistration>('attendance', '/asistencias/registrar', { token });
  }

  closeSession(sessionId: number): Observable<null> {
    return this.api.delete<null>('attendance', `/sesiones/${sessionId}/cerrar`).pipe(
      tap(() => this.markClosed(sessionId))
    );
  }

  attendanceToday(subjectId: number): Observable<AttendanceRecord[]> {
    return this.api.get<AttendanceRecord[]>('attendance', `/asistencias/${subjectId}/hoy`);
  }

  attendanceHistory(subjectId: number): Observable<AttendanceRecord[]> {
    return this.api.get<AttendanceRecord[]>('attendance', `/asistencias/${subjectId}/historial`);
  }

  getLocalSessions(subjectId: number): AttendanceSession[] {
    return this.readSessions().filter((session) => session.materia_id === subjectId);
  }

  private rememberSession(session: AttendanceSession): void {
    const sessions = [session, ...this.readSessions().filter((item) => item.session_id !== session.session_id)].slice(0, 80);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessions));
  }

  private markClosed(sessionId: number): void {
    const sessions = this.readSessions().map((session) => session.session_id === sessionId ? { ...session, status: 'cerrada' } : session);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessions));
  }

  private readSessions(): AttendanceSession[] {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY) ?? '[]') as AttendanceSession[];
    } catch {
      return [];
    }
  }
}
