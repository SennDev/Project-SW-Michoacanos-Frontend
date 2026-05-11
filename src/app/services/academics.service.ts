import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../core/services/api-client.service';
import { ImportResult, Student, Teacher } from '../shared/models/academic.models';

@Injectable({ providedIn: 'root' })
export class AcademicsService {
  private readonly api = inject(ApiClientService);

  importTeachers(file: File): Observable<ImportResult> {
    return this.api.upload<ImportResult>('academics', '/docentes/importar', file);
  }

  listTeachers(page = 1, limit = 100): Observable<Teacher[]> {
    return this.api.get<Teacher[]>('academics', '/docentes', { page, limit });
  }

  importStudents(subjectId: number, file: File): Observable<ImportResult> {
    return this.api.upload<ImportResult>('academics', `/alumnos/importar/${subjectId}`, file);
  }

  listStudentsBySubject(subjectId: number, includeInactive = false): Observable<Student[]> {
    return this.api.get<Student[]>('academics', `/alumnos/materia/${subjectId}`, { incluir_bajas: includeInactive });
  }

  withdrawStudent(studentId: number, subjectId: number, reason: string): Observable<null> {
    return this.api.delete<null>('academics', `/alumnos/${studentId}/baja`, {
      materia_id: subjectId,
      motivo: reason
    });
  }
}
