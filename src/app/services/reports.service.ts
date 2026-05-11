import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiClientService } from '../core/services/api-client.service';
import { DownloadHistoryItem, ReportFormat, ReportType, StudentStats, TeacherStats } from '../shared/models/report.models';

const REPORT_HISTORY_KEY = 'agm.report.history';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiClientService);

  exportReport(type: ReportType, subjectId: number, format: ReportFormat): Observable<Blob> {
    const path = type === 'calificaciones'
      ? `/reportes/calificaciones/${subjectId}`
      : `/reportes/asistencias/${subjectId}`;
    return this.api.blob('reports', path, { formato: format }).pipe(
      tap(() => this.remember(type, subjectId, format))
    );
  }

  teacherStats(teacherId: number): Observable<TeacherStats[]> {
    return this.api.get<TeacherStats[]>('reports', `/estadisticas/docente/${teacherId}`);
  }

  studentStats(studentId: number): Observable<StudentStats[]> {
    return this.api.get<StudentStats[]>('reports', `/estadisticas/alumno/${studentId}`);
  }

  history(): DownloadHistoryItem[] {
    try {
      return JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) ?? '[]') as DownloadHistoryItem[];
    } catch {
      return [];
    }
  }

  private remember(type: ReportType, subjectId: number, format: ReportFormat): void {
    const createdAt = new Date().toISOString();
    const filename = `${type}_${subjectId}.${format}`;
    const item: DownloadHistoryItem = {
      id: `${type}-${subjectId}-${format}-${createdAt}`,
      type,
      subjectId,
      format,
      filename,
      createdAt
    };
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify([item, ...this.history()].slice(0, 30)));
  }
}
