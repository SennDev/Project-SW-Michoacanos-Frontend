import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs'; // 1. Eliminamos 'tap' porque ya no guardamos localmente
import { ApiClientService } from '../core/services/api-client.service';
import { ActivityPayload, GradePayload, GradeSummary, LocalActivity, WeightCategory, WeightPayload } from '../shared/models/grade.models';

// 2. Eliminamos la constante LOCAL_ACTIVITY_KEY

@Injectable({ providedIn: 'root' })
export class GradesService {
  private readonly api = inject(ApiClientService);

  // --- PONDERACIONES (CATEGORÍAS) ---

  listWeights(subjectId: number): Observable<WeightCategory[]> {
    return this.api.get<WeightCategory[]>('grades', `/ponderaciones/${subjectId}`);
  }

  saveWeights(subjectId: number, payload: WeightPayload): Observable<{ materia_id: number; total: number }> {
    return this.api.post<{ materia_id: number; total: number }>('grades', `/ponderaciones/${subjectId}`, payload);
  }

  // --- GESTIÓN DE ACTIVIDADES (NUEVO CRUD) ---

  // GET: Trae la lista real de la base de datos (Reemplaza a getLocalActivities)
  listActivities(materiaId: number): Observable<LocalActivity[]> {
    return this.api.get<LocalActivity[]>('grades', `/actividades/materia/${materiaId}`);
  }

  // POST: Crea una actividad (Ya no guarda en LocalStorage)
  createActivity(payload: ActivityPayload): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('grades', '/actividades', payload);
  }

  // PUT: Actualiza una actividad existente
  updateActivity(activityId: number, payload: { categoria_id: number; nombre: string; max_puntos: number }): Observable<{ id: number }> {
    return this.api.put<{ id: number }>('grades', `/actividades/${activityId}`, payload);
  }

  // DELETE: Elimina una actividad y sus calificaciones huérfanas
  deleteActivity(activityId: number): Observable<null> {
    return this.api.delete<null>('grades', `/actividades/${activityId}`);
  }

  // --- CALIFICACIONES (GRADES) ---

  upsertGrade(payload: GradePayload): Observable<null> {
    return this.api.post<null>('grades', '/calificaciones', payload);
  }

  importGrades(activityId: number, file: File): Observable<{ filas: number; actualizadas: number }> {
    return this.api.upload<{ filas: number; actualizadas: number }>('grades', '/calificaciones/importar', file, {
      activity_id: activityId.toString()
    });
  }

  getConcentrado(subjectId: number): Observable<GradeSummary[]> {
    return this.api.get<GradeSummary[]>('grades', `/concentrado/${subjectId}`);
  }

  // 3. Eliminamos las funciones privadas de LocalStorage (rememberActivity y readActivities)
}