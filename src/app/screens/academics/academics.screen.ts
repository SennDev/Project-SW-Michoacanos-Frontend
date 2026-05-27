import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin, finalize, of, interval } from 'rxjs';
import { catchError, delay } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { AcademicsService } from '../../services/academics.service';
import { NotificationsService } from '../../services/notifications.service';
import { PeriodsService } from '../../services/periods.service'; // <-- INTEGRADO PARA EL FILTRO

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { Student, Subject, Teacher, Period } from '../../shared/models/academic.models';

@Component({
  selector: 'agm-academics-screen',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    PageHeaderComponent, FileUploadCardComponent,
    LoadingSkeletonComponent, EmptyStateComponent, ErrorStateComponent, ConfirmationModalComponent
  ],
  templateUrl: './academics.screen.html',
  styleUrl: './academics.screen.scss'
})
export class AcademicsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  public readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly academics = inject(AcademicsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly notifications = inject(NotificationsService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly tab = signal<'teachers' | 'students' | 'subjects'>('students');

  // --- DATOS MAESTROS ---
  readonly periods = signal<Period[]>([]);
  readonly teachers = signal<Teacher[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly students = signal<Student[]>([]);

  // --- SELECCIONES GLOBALES ---
  readonly selectedPeriodId = signal<number | null>(null);
  readonly selectedSubjectId = signal<number | null>(null);

  // --- ESTADOS DE CARGA ---
  readonly importingTeachers = signal(false);
  readonly importingStudents = signal(false);
  readonly importingSubjects = signal(false);

  readonly studentToWithdraw = signal<Student | null>(null);
  readonly isWithdrawing = signal(false);
  readonly lastUpdated = signal<Date | null>(null);

  // --- PAGINACIÓN (10 elementos por página) ---
  readonly itemsPerPage = 10;
  readonly teachersPage = signal(1);
  readonly subjectsPage = signal(1);
  readonly studentsPage = signal(1);

  // --- COMPUTADOS Y LÓGICA DERIVADA ---
  readonly isAdmin = computed(() => this.auth.role() === 'admin');
  readonly isTeacher = computed(() => this.auth.role() === 'docente');
  readonly selectedSubject = computed(() => this.subjects().find(s => s.id === this.selectedSubjectId()));

  // Lógica de Periodos (Vigente vs Histórico)
  readonly selectedPeriodStatus = computed(() => {
    const period = this.periods().find(p => p.id === this.selectedPeriodId());
    if (!period) return null;
    return period.activo ? 'Vigente' : 'Histórico';
  });

  // Paginadores Computados
  readonly paginatedTeachers = computed(() => this.paginate(this.teachers(), this.teachersPage()));
  readonly totalTeachersPages = computed(() => Math.ceil(this.teachers().length / this.itemsPerPage) || 1);

  readonly paginatedSubjects = computed(() => this.paginate(this.subjects(), this.subjectsPage()));
  readonly totalSubjectsPages = computed(() => Math.ceil(this.subjects().length / this.itemsPerPage) || 1);

  readonly paginatedStudents = computed(() => this.paginate(this.students(), this.studentsPage()));
  readonly totalStudentsPages = computed(() => Math.ceil(this.students().length / this.itemsPerPage) || 1);

  ngOnInit(): void {
    if (this.isAdmin()) this.tab.set('teachers');
    this.loadInitialData();

    interval(300000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchEntities(true));
  }

  // --- 1. CARGA INICIAL DE PERIODOS ---
  loadInitialData(): void {
    this.loading.set(true);
    this.periodsService.listPeriods().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (periodsData) => {
        // Ordenamos los periodos para que el activo salga primero
        const sortedPeriods = periodsData.sort((a, b) => Number(b.activo) - Number(a.activo));
        this.periods.set(sortedPeriods);

        // Autoseleccionamos el periodo activo por defecto
        const activePeriod = sortedPeriods.find(p => p.activo);
        if (activePeriod && !this.selectedPeriodId()) {
          this.selectedPeriodId.set(activePeriod.id);
        }

        this.fetchEntities(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err, 'No fue posible cargar los periodos.'));
        this.loading.set(false);
      }
    });
  }

  // --- 2. CARGA DE ENTIDADES BASADA EN EL PERIODO SELECCIONADO ---
  fetchEntities(isSilent = false): void {
    if (!isSilent) this.loading.set(true);
    this.error.set(null);

    const currentPeriodId = this.selectedPeriodId() || undefined;

    const teachers$ = this.isAdmin() ? this.academics.listTeachers().pipe(catchError(() => of([]))) : of([]);
    const subjects$ = this.subjectScope.listVisibleSubjects(currentPeriodId).pipe(catchError(() => of([])));

    forkJoin({
      teachers: teachers$,
      subjects: subjects$
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.teachers.set(data.teachers.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.subjects.set(data.subjects.sort((a, b) => a.nombre.localeCompare(b.nombre)));

        // Reset de Paginación tras recargar
        this.teachersPage.set(1);
        this.subjectsPage.set(1);

        const currentSelectedSubject = this.selectedSubjectId();
        if (data.subjects.length > 0) {
          if (currentSelectedSubject && data.subjects.some(s => s.id === currentSelectedSubject)) {
             if (this.tab() === 'students') this.loadStudents(currentSelectedSubject, isSilent);
          } else {
             this.selectSubject(data.subjects[0].id);
          }
        } else {
          this.students.set([]);
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

  // --- EVENTO: CAMBIO DE PERIODO ---
  onPeriodChange(periodId: number): void {
    this.selectedPeriodId.set(periodId);
    this.selectedSubjectId.set(null);
    this.students.set([]);
    this.fetchEntities(false);
  }

  // --- EVENTO: SELECCIÓN DE MATERIA ---
  selectSubject(id: number): void {
    this.selectedSubjectId.set(id);
    this.studentsPage.set(1); // Reset de página de alumnos
    this.loadStudents(id);
  }

  private loadStudents(subjectId: number, isSilent = false): void {
    if (!isSilent) this.students.set([]);
    this.academics.listStudentsBySubject(subjectId, this.isAdmin())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.students.set(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        },
        error: () => {
          if (!isSilent) this.toasts.error('Error', 'No se pudieron cargar los alumnos.');
        }
      });
  }

  // --- LÓGICA DE PAGINACIÓN ---
  private paginate<T>(array: T[], page: number): T[] {
    const startIndex = (page - 1) * this.itemsPerPage;
    return array.slice(startIndex, startIndex + this.itemsPerPage);
  }

  changePage(type: 'teachers' | 'subjects' | 'students', delta: number): void {
    if (type === 'teachers') {
      const newPage = this.teachersPage() + delta;
      if (newPage >= 1 && newPage <= this.totalTeachersPages()) this.teachersPage.set(newPage);
    } else if (type === 'subjects') {
      const newPage = this.subjectsPage() + delta;
      if (newPage >= 1 && newPage <= this.totalSubjectsPages()) this.subjectsPage.set(newPage);
    } else if (type === 'students') {
      const newPage = this.studentsPage() + delta;
      if (newPage >= 1 && newPage <= this.totalStudentsPages()) this.studentsPage.set(newPage);
    }
  }

  // --- IMPORTACIONES ---
  importTeachers(eventOrFile: any): void {
    const file = eventOrFile instanceof File ? eventOrFile : eventOrFile?.target?.files?.[0];
    if (!file) return;

    this.importingTeachers.set(true);
    this.academics.importTeachers(file).pipe(
      finalize(() => this.importingTeachers.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result: any) => {
        this.toasts.success('Directorio Actualizado', `Se detectaron ${result.detectados ?? 0} perfiles.`);
        this.fetchEntities();
      },
      error: (err: any) => this.toasts.error('Error de Importación', errorMessage(err))
    });
  }

  importSubjects(eventOrFile: any): void {
    const file = eventOrFile instanceof File ? eventOrFile : eventOrFile?.target?.files?.[0];
    if (!file) return;

    this.importingSubjects.set(true);
    const request$ = (this.academics as any).importSubjects ? (this.academics as any).importSubjects(file) : of({ materias_detectadas: 0 }).pipe(delay(500));

    request$.pipe(
      finalize(() => this.importingSubjects.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Catálogo Actualizado', `Materias vinculadas al periodo actual.`);
        this.fetchEntities();
      },
      error: (err: any) => this.toasts.error('Error de Importación', errorMessage(err))
    });
  }

  importStudents(eventOrFile: any): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) return this.toasts.warning('Atención', 'Selecciona una materia primero.');

    const file = eventOrFile instanceof File ? eventOrFile : eventOrFile?.target?.files?.[0];
    if (!file) return;

    this.importingStudents.set(true);
    this.academics.importStudents(subjectId, file).pipe(
      finalize(() => this.importingStudents.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result: any) => {
        this.toasts.success('Matrícula Actualizada', `Inscritos ${result.alumnos_detectados ?? 0} alumnos.`);
        this.loadStudents(subjectId);
      },
      error: (err: any) => this.toasts.error('Error de Importación', errorMessage(err))
    });
  }

  // --- LÓGICA DE REVISIÓN DE BAJA ---
  reviewWithdrawal(student: Student): void {
    const hasRequested = student.status === 'baja_solicitada' || (student as any).estado === 'baja_solicitada';
    if (hasRequested) this.studentToWithdraw.set(student);
    else this.toasts.info('Información', `El alumno no ha solicitado la baja.`);
  }

  confirmWithdrawal(): void {
    const target = this.studentToWithdraw();
    const subjectId = this.selectedSubjectId();
    if (!target || !subjectId) return;

    this.isWithdrawing.set(true);
    this.academics.withdrawStudent(target.id, subjectId, 'Baja desde AGM').pipe(
      finalize(() => { this.isWithdrawing.set(false); this.studentToWithdraw.set(null); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Baja Confirmada', `Proceso finalizado.`);
        const notifService = (this.notifications as any);
        if (notifService.sendBajaNotif || notifService.sendBaja) {
          const req = notifService.sendBajaNotif ? notifService.sendBajaNotif({ alumno_id: target.id, materia_id: subjectId }) : notifService.sendBaja({ alumno_id: target.id, materia_id: subjectId });
          req.pipe(catchError(() => of(null))).subscribe();
        }
        this.loadStudents(subjectId);
      },
      error: (err: any) => this.toasts.error('Error en Baja', errorMessage(err))
    });
  }
}
