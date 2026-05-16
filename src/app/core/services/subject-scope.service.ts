import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { PeriodsService } from '../../services/periods.service';
import { ReportsService } from '../../services/reports.service';
import { Subject } from '../../shared/models/academic.models';

@Injectable({ providedIn: 'root' })
export class SubjectScopeService {
  private readonly auth = inject(AuthService);
  private readonly periods = inject(PeriodsService);
  private readonly reports = inject(ReportsService);

  listVisibleSubjects(periodId?: number): Observable<Subject[]> {
    const user = this.auth.user();
    if (!user || user.role === 'admin') {
      return this.periods.listSubjects(periodId, 1, 100);
    }

    if (!user.profile_id) {
      return of([]);
    }

    const stats$: Observable<Array<{ materia_id: number }>> = user.role === 'docente'
      ? this.reports.teacherStats(user.profile_id)
      : this.reports.studentStats(user.profile_id);

    return stats$.pipe(
      map((stats) => Array.from(new Set(stats.map((item) => item.materia_id)))),
      switchMap((subjectIds: number[]) => subjectIds.length
        ? forkJoin(subjectIds.map((subjectId) => this.periods.getSubject(subjectId).pipe(catchError(() => of(null)))))
        : of([])),
      map((subjects: Array<Subject | null>) => subjects
        .filter((subject): subject is Subject => Boolean(subject))
        .filter((subject) => !periodId || subject.period_id === periodId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      ),
      catchError(() => of([]))
    );
  }
}
