import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiClientService } from '../core/services/api-client.service';
import { ActivityPayload, GradePayload, GradeSummary, LocalActivity, WeightCategory, WeightPayload } from '../shared/models/grade.models';

const LOCAL_ACTIVITY_KEY = 'agm.local.activities';

@Injectable({ providedIn: 'root' })
export class GradesService {
  private readonly api = inject(ApiClientService);

  listWeights(subjectId: number): Observable<WeightCategory[]> {
    return this.api.get<WeightCategory[]>('grades', `/ponderaciones/${subjectId}`);
  }

  saveWeights(subjectId: number, payload: WeightPayload): Observable<{ materia_id: number; total: number }> {
    return this.api.post<{ materia_id: number; total: number }>('grades', `/ponderaciones/${subjectId}`, payload);
  }

  createActivity(payload: ActivityPayload): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('grades', '/actividades', payload).pipe(
      tap((response) => this.rememberActivity({ ...payload, id: response.id, created_at: new Date().toISOString() }))
    );
  }

  upsertGrade(payload: GradePayload): Observable<null> {
    return this.api.post<null>('grades', '/calificaciones', payload);
  }

  importGrades(activityId: number, file: File): Observable<{ filas: number; actualizadas: number }> {
    return this.api.upload<{ filas: number; actualizadas: number }>('grades', '/calificaciones/importar', file, {
      activity_id: activityId
    });
  }

  getConcentrado(subjectId: number): Observable<GradeSummary[]> {
    return this.api.get<GradeSummary[]>('grades', `/concentrado/${subjectId}`);
  }

  getLocalActivities(subjectId: number): LocalActivity[] {
    return this.readActivities().filter((activity) => activity.materia_id === subjectId);
  }

  private rememberActivity(activity: LocalActivity): void {
    const activities = [activity, ...this.readActivities().filter((item) => item.id !== activity.id)].slice(0, 80);
    localStorage.setItem(LOCAL_ACTIVITY_KEY, JSON.stringify(activities));
  }

  private readActivities(): LocalActivity[] {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_ACTIVITY_KEY) ?? '[]') as LocalActivity[];
    } catch {
      return [];
    }
  }
}
