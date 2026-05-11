import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../core/services/api-client.service';
import { ImportResult, Period, PeriodPayload, Subject } from '../shared/models/academic.models';

@Injectable({ providedIn: 'root' })
export class PeriodsService {
  private readonly api = inject(ApiClientService);

  listPeriods(page = 1, limit = 50): Observable<Period[]> {
    return this.api.get<Period[]>('periods', '/periodos', { page, limit });
  }

  createPeriod(payload: PeriodPayload): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('periods', '/periodos', payload);
  }

  updatePeriod(id: number, payload: PeriodPayload): Observable<{ id: number }> {
    return this.api.put<{ id: number }>('periods', `/periodos/${id}`, payload);
  }

  deletePeriod(id: number): Observable<null> {
    return this.api.delete<null>('periods', `/periodos/${id}`);
  }

  importSchedule(file: File, periodId?: number): Observable<ImportResult> {
    return this.api.upload<ImportResult>('periods', '/periodos/importar', file, { periodo_id: periodId });
  }

  listSubjects(periodId?: number, page = 1, limit = 100): Observable<Subject[]> {
    return this.api.get<Subject[]>('periods', '/materias', { periodo: periodId, page, limit });
  }

  getSubject(id: number): Observable<Subject> {
    return this.api.get<Subject>('periods', `/materias/${id}`);
  }
}
