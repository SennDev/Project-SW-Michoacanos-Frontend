import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin, finalize, of, interval } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { AcademicsService } from '../../services/academics.service';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { Student, Subject, Teacher } from '../../shared/models/academic.models';

@Component({
  selector: 'agm-academics-screen',
  standalone: true,
  imports: [
    PageHeaderComponent, FileUploadCardComponent,
    LoadingSkeletonComponent, EmptyStateComponent, ErrorStateComponent, ConfirmationModalComponent,
    DatePipe
  ],
  templateUrl: './academics.screen.html',
  styleUrl: './academics.screen.scss'
})
export class AcademicsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  public readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly academics = inject(AcademicsService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly tab = signal<'teachers' | 'students' | 'subjects'>('students');

  readonly teachers = signal<Teacher[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly students = signal<Student[]>([]);

  readonly selectedSubjectId = signal<number | null>(null);
  readonly importingTeachers = signal(false);
  readonly importingStudents = signal(false);

  // Señales para la baja
  readonly studentToWithdraw = signal<Student | null>(null);
  readonly isWithdrawing = signal(false);

  readonly lastUpdated = signal<Date | null>(null);

  readonly isAdmin = computed(() => this.auth.role() === 'admin');
  readonly isTeacher = computed(() => this.auth.role() === 'docente');
  readonly selectedSubject = computed(() => this.subjects().find(s => s.id === this.selectedSubjectId()));

  ngOnInit(): void {
    if (this.isAdmin()) this.tab.set('teachers');
    this.load();

    interval(300000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(true));
  }

  load(isSilent = false): void {
    if (!isSilent) this.loading.set(true);
    this.error.set(null);

    const teachers$ = this.isAdmin() ? this.academics.listTeachers().pipe(catchError(() => of([]))) : of([]);
    const subjects$ = this.subjectScope.listVisibleSubjects().pipe(catchError(() => of([])));

    forkJoin({
      teachers: teachers$,
      subjects: subjects$
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        const sortedTeachers = data.teachers.sort((a, b) => a.nombre.localeCompare(b.nombre));
        const sortedSubjects = data.subjects.sort((a, b) => a.nombre.localeCompare(b.nombre));

        this.teachers.set(sortedTeachers);
        this.subjects.set(sortedSubjects);

        const currentSelected = this.selectedSubjectId();
        if (sortedSubjects.length > 0) {
          if (currentSelected && sortedSubjects.some(s => s.id === currentSelected)) {
             if (this.tab() === 'students') this.loadStudents(currentSelected, isSilent);
          } else {
             this.selectSubject(sortedSubjects[0].id);
          }
        }

        this.lastUpdated.set(new Date());
        this.loading.set(false);
      },
      error: (err: any) => {
        if (!isSilent) {
          this.error.set(errorMessage(err));
          this.loading.set(false);
        }
      }
    });
  }

  selectSubject(id: number): void {
    this.selectedSubjectId.set(id);
    this.loadStudents(id);
  }

  private loadStudents(subjectId: number, isSilent = false): void {
    if (!isSilent) this.students.set([]);
    this.academics.listStudentsBySubject(subjectId, this.isAdmin())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const sortedStudents = data.sort((a, b) => a.nombre.localeCompare(b.nombre));
          this.students.set(sortedStudents);
        },
        error: () => {
          if (!isSilent) this.toasts.error('Error', 'No se pudieron cargar los alumnos de este grupo.');
        }
      });
  }

  importTeachers(eventOrFile: any): void {
    const file = eventOrFile?.target?.files?.[0] || eventOrFile;
    if (!file) return;

    this.importingTeachers.set(true);
    this.academics.importTeachers(file).pipe(
      finalize(() => this.importingTeachers.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result: any) => {
        this.toasts.success('Directorio Actualizado', `Se detectaron ${result.detectados ?? 0} perfiles.`);
        this.load();
      },
      error: (err: any) => this.toasts.error('Error', errorMessage(err))
    });
  }

  importStudents(eventOrFile: any): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) return this.toasts.warning('Atención', 'Selecciona una materia primero.');

    const file = eventOrFile?.target?.files?.[0] || eventOrFile;
    if (!file) return;

    this.importingStudents.set(true);
    this.academics.importStudents(subjectId, file).pipe(
      finalize(() => this.importingStudents.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result: any) => {
        this.toasts.success('Matrícula Actualizada', `Se inscribieron ${result.alumnos_detectados ?? 0} alumnos.`);
        this.loadStudents(subjectId);
      },
      error: (err: any) => this.toasts.error('Error', errorMessage(err))
    });
  }

  // --- NUEVA LÓGICA DE REVISIÓN DE BAJA ---
  reviewWithdrawal(student: Student): void {
    // NOTA: Se asume que el backend devuelve un booleano 'baja_solicitada'
    // Si en tu modelo se llama diferente (ej: bajaSolicitada), cámbialo aquí.
    const hasRequested = student.status === 'baja_solicitada';
      if (hasRequested) {
        this.studentToWithdraw.set(student); // Abre el modal de confirmación
      } else {
        this.toasts.info('Información', `El/la alumno/a ${student.nombre} no ha solicitado la baja.`);
      }
    }

  confirmWithdrawal(): void {
    const target = this.studentToWithdraw();
    if (!target) return;
    const subjectId = this.selectedSubjectId();
    if (!subjectId) return;

    this.isWithdrawing.set(true);
    this.academics.withdrawStudent(target.id, subjectId, 'Baja aprobada por administracion desde AGM').pipe(
      finalize(() => {
        this.isWithdrawing.set(false);
        this.studentToWithdraw.set(null);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Baja Confirmada', `Se procesó la baja del alumno correctamente.`);
        this.loadStudents(subjectId);
      },
      error: (err: any) => this.toasts.error('Error en Baja', errorMessage(err))
    });
  }
}
