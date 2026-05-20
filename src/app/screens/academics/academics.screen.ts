import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, finalize, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { AcademicsService } from '../../services/academics.service';
import { GradesService } from '../../services/grades.service';
import { AttendanceService } from '../../services/attendance.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { Student, Subject, Teacher } from '../../shared/models/academic.models';
import { TableColumn } from '../../shared/models/ui.models';
import { GradeSummary } from '../../shared/models/grade.models';
import { AttendanceRecord } from '../../shared/models/attendance.models';

interface StudentRosterRow extends Student {
  promedio: number | null;
  asistencia: number | null;
  faltas: number;
  riesgo: string;
}

@Component({
  selector: 'agm-academics-screen',
  standalone: true,
  imports: [
    FormsModule,
    PageHeaderComponent,
    SearchableTableComponent,
    FileUploadCardComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ConfirmationModalComponent
  ],
  template: `
    <agm-page-header
      eyebrow="Academicos"
      title="Docentes, alumnos e inscripciones"
      description="Administra el directorio docente, las materias importadas y los alumnos inscritos por materia."
    >
      <button class="btn ghost" type="button" (click)="load()">Actualizar</button>
    </agm-page-header>

    @if (error()) {
      <agm-error-state [message]="error()" (retry)="load()" />
    }

    @if (loading()) {
      <agm-loading-skeleton [rows]="6" />
    } @else {
      <section class="section-tabs" aria-label="Vistas academicas">
        @if (isAdmin()) {
          <button type="button" [class.active]="tab() === 'teachers'" (click)="tab.set('teachers')">Docentes</button>
        }
        <button type="button" [class.active]="tab() === 'students'" (click)="tab.set('students')">Alumnos</button>
        <button type="button" [class.active]="tab() === 'subjects'" (click)="tab.set('subjects')">Materias</button>
      </section>

      @if (tab() === 'teachers') {
        <section class="grid-3" style="margin-top: 18px;">
          @if (isAdmin()) {
            <agm-file-upload-card
              title="Importar docentes"
              hint="Carga el directorio PDF. El backend creara usuarios docentes y conservara la fuente de verdad."
              accept=".pdf"
              [loading]="importingTeachers()"
              (upload)="importTeachers($event)"
            />
          }

          <article class="panel pad" style="grid-column: span 2;">
            <h2 class="panel-title">Directorio docente</h2>
            <agm-searchable-table
              [rows]="teachers()"
              [columns]="teacherColumns"
              placeholder="Buscar docente, correo o extension"
              emptyTitle="Sin docentes"
              emptyMessage="Importa el directorio docente o revisa ms-academics."
            />
          </article>
        </section>
      }

      @if (tab() === 'students') {
        <section class="grid-3" style="margin-top: 18px;">
          <article class="panel pad">
            <h2 class="panel-title">Materia</h2>
            <div class="field">
              <label>Selecciona una materia</label>
              <select [ngModel]="selectedSubjectId()" (ngModelChange)="selectSubject($event)">
                <option [ngValue]="null">Sin seleccion</option>
                @for (subject of subjects(); track subject.id) {
                  <option [ngValue]="subject.id">{{ subject.nrc }} - {{ subject.nombre }}</option>
                }
              </select>
            </div>
            @if (selectedSubject()) {
              <div class="divider"></div>
              <strong>{{ selectedSubject()?.nombre }}</strong>
              <p class="muted">Docente: {{ selectedSubject()?.docente_nombre || 'Pendiente' }}</p>
              <p class="muted">Salon: {{ selectedSubject()?.salon || 'Por definir' }}</p>
            }
          </article>

          <agm-file-upload-card
            title="Importar alumnos"
            hint="Acepta PDF, CSV o XLSX en /alumnos/importar/{materia_id}."
            accept=".pdf,.csv,.xlsx,.xlsm"
            actionLabel="Importar alumnos"
            [loading]="importingStudents()"
            (upload)="importStudents($event)"
          />

          <article class="panel pad">
            <h2 class="panel-title">Resumen</h2>
            <div class="metric-list">
              <div class="metric-row"><span>Materias</span><strong>{{ subjects().length }}</strong></div>
              <div class="metric-row"><span>Alumnos activos</span><strong>{{ students().length }}</strong></div>
              <div class="metric-row"><span>En riesgo</span><strong>{{ atRiskCount() }}</strong></div>
            </div>
          </article>
        </section>

        <section style="margin-top: 18px;">
          <div class="row between wrap roster-toolbar">
            <div>
              <h2 class="panel-title">Alumnos del grupo</h2>
              <p class="muted">{{ selectedSubject()?.nombre || 'Selecciona una materia' }}</p>
            </div>
            <div class="section-tabs" aria-label="Filtrar alumnos">
              <button type="button" [class.active]="rosterFilter() === 'all'" (click)="rosterFilter.set('all')">Todos</button>
              <button type="button" [class.active]="rosterFilter() === 'risk'" (click)="rosterFilter.set('risk')">En riesgo</button>
              <button type="button" [class.active]="rosterFilter() === 'attendance'" (click)="rosterFilter.set('attendance')">Baja asistencia</button>
            </div>
          </div>
          <agm-searchable-table
            [rows]="visibleRosterRows()"
            [columns]="studentColumns"
            [actions]="isAdmin() ? studentActions : null"
            placeholder="Buscar alumno, matricula o correo"
            emptyTitle="Sin alumnos"
            emptyMessage="Selecciona una materia e importa alumnos para ver el listado."
          />
          <ng-template #studentActions let-student>
            <button class="btn ghost small" type="button" (click)="askWithdraw(student)">Revisar baja</button>
          </ng-template>
        </section>
      }

      @if (tab() === 'subjects') {
        <section class="grid-3" style="margin-top: 18px;">
          @for (subject of subjects(); track subject.id) {
            <article class="panel pad subject-card" (click)="selectSubject(subject.id)" tabindex="0">
              <div class="row between">
                <strong>{{ subject.nrc }}</strong>
                <span class="status-badge" [class]="subject.estado === 'abierta' ? 'success' : 'neutral'">{{ subject.estado }}</span>
              </div>
              <h2>{{ subject.nombre }}</h2>
              <p>{{ subject.docente_nombre || 'Docente pendiente' }}</p>
              <small>{{ subject.clave }} | Seccion {{ subject.seccion }} | {{ subject.salon || 'Sin salon' }}</small>
            </article>
          } @empty {
            <agm-empty-state title="Sin materias" message="Las materias provienen de ms-periods despues de importar la programacion." />
          }
        </section>
      }
    }

    <agm-confirmation-modal
      [open]="Boolean(studentToWithdraw())"
      title="Revisar solicitud de baja"
      [message]="'La baja de ' + (studentToWithdraw()?.nombre || 'este alumno') + ' debe aprobarse con flujo administrativo. Para evitar bajas directas sin solicitud, esta pantalla no ejecuta eliminaciones contra el backend.'"
      confirmLabel="Entendido"
      (confirm)="acknowledgeWithdrawalRequest()"
      (cancel)="studentToWithdraw.set(null)"
    />
  `,
  styles: [`
    .subject-card {
      cursor: pointer;
      transition: transform 150ms ease, box-shadow 150ms ease;
    }

    .subject-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--agm-shadow);
    }

    .subject-card h2 {
      margin: 12px 0 7px;
      font-size: 1.05rem;
      line-height: 1.3;
    }

    .subject-card p,
    .subject-card small {
      color: var(--agm-text-soft);
    }

    .roster-toolbar {
      margin-bottom: 12px;
    }

    .roster-toolbar p {
      margin: 4px 0 0;
    }
  `]
})
export class AcademicsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly academics = inject(AcademicsService);
  private readonly grades = inject(GradesService);
  private readonly attendance = inject(AttendanceService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly toasts = inject(ToastService);

  readonly tab = signal<'teachers' | 'students' | 'subjects'>('teachers');
  readonly loading = signal(true);
  readonly importingTeachers = signal(false);
  readonly importingStudents = signal(false);
  readonly error = signal('');
  readonly teachers = signal<Teacher[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly students = signal<Student[]>([]);
  readonly gradeSummary = signal<GradeSummary[]>([]);
  readonly attendanceHistory = signal<AttendanceRecord[]>([]);
  readonly rosterFilter = signal<'all' | 'risk' | 'attendance'>('all');
  readonly selectedSubjectId = signal<number | null>(null);
  readonly studentToWithdraw = signal<Student | null>(null);

  readonly teacherColumns: TableColumn<Teacher>[] = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'email', header: 'Correo' },
    { key: 'ubicacion', header: 'Ubicacion' },
    { key: 'extension', header: 'Extension' }
  ];

  readonly studentRows = computed<StudentRosterRow[]>(() => {
    const sessionCount = new Set(this.attendanceHistory().map((record) => record.session_id)).size;
    return this.students().map((student) => {
      const summary = this.gradeSummary().find((row) => row.alumno_id === student.id);
      const records = this.attendanceHistory().filter((record) => record.student_id === student.id);
      const presentOrLate = records.filter((record) => record.estado === 'Presente' || record.estado === 'Retardo').length;
      const asistencia = sessionCount ? Math.round((presentOrLate / sessionCount) * 100) : null;
      const faltas = sessionCount ? Math.max(0, sessionCount - presentOrLate) : 0;
      const lowGrade = Boolean(summary && summary.promedio_redondeado < 70);
      const lowAttendance = Boolean(asistencia !== null && asistencia < 80);
      return {
        ...student,
        promedio: summary?.promedio_real ?? null,
        asistencia,
        faltas,
        riesgo: lowGrade || lowAttendance ? 'En riesgo' : 'Estable'
      };
    });
  });

  readonly visibleRosterRows = computed(() => {
    const filter = this.rosterFilter();
    if (filter === 'risk') {
      return this.studentRows().filter((student) => student.riesgo === 'En riesgo');
    }
    if (filter === 'attendance') {
      return this.studentRows().filter((student) => student.asistencia !== null && student.asistencia < 80);
    }
    return this.studentRows();
  });

  readonly atRiskCount = computed(() => this.studentRows().filter((student) => student.riesgo === 'En riesgo').length);

  readonly studentColumns: TableColumn<StudentRosterRow>[] = [
    { key: 'matricula', header: 'Matricula' },
    { key: 'nombre', header: 'Nombre' },
    { key: 'email', header: 'Correo' },
    { key: 'promedio', header: 'Promedio', formatter: (row) => row.promedio === null ? '--' : row.promedio.toFixed(1) },
    { key: 'asistencia', header: 'Asistencia', formatter: (row) => row.asistencia === null ? '--' : `${row.asistencia}%` },
    { key: 'faltas', header: 'Faltas' },
    { key: 'riesgo', header: 'Seguimiento', badge: (row) => row.riesgo },
    { key: 'status', header: 'Estado', badge: (row) => row.activo === false ? 'Baja' : row.status }
  ];

  ngOnInit(): void {
    if (!this.isAdmin()) {
      this.tab.set('students');
    }
    this.load();
  }

  isAdmin(): boolean {
    return this.auth.role() === 'admin';
  }

  selectedSubject(): Subject | undefined {
    return this.subjects().find((subject) => subject.id === this.selectedSubjectId());
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      teachers: this.isAdmin() ? this.academics.listTeachers() : of([]),
      subjects: this.subjectScope.listVisibleSubjects()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ teachers, subjects }) => {
        this.teachers.set(teachers);
        this.subjects.set(subjects);
        if (!this.selectedSubjectId() && subjects.length) {
          this.selectedSubjectId.set(subjects[0].id);
          this.loadStudents(subjects[0].id);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error, 'No fue posible cargar informacion academica.'));
        this.loading.set(false);
      }
    });
  }

  selectSubject(id: number | null): void {
    this.selectedSubjectId.set(id);
    this.tab.set('students');
    if (id) {
      this.loadStudents(id);
    } else {
      this.students.set([]);
      this.gradeSummary.set([]);
      this.attendanceHistory.set([]);
    }
  }

  loadStudents(subjectId: number): void {
    forkJoin({
      students: this.academics.listStudentsBySubject(subjectId),
      summary: this.grades.getConcentrado(subjectId),
      attendance: this.attendance.attendanceHistory(subjectId)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ students, summary, attendance }) => {
        this.students.set(students);
        this.gradeSummary.set(summary);
        this.attendanceHistory.set(attendance);
      },
      error: () => {
        this.students.set([]);
        this.gradeSummary.set([]);
        this.attendanceHistory.set([]);
      }
    });
  }

  importTeachers(file: File): void {
    this.importingTeachers.set(true);
    this.academics.importTeachers(file).pipe(
      finalize(() => this.importingTeachers.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.toasts.success('Docentes importados', `${result.detectados ?? 0} detectados`);
        this.load();
      },
      error: (error: unknown) => this.toasts.error('Importacion fallida', errorMessage(error))
    });
  }

  importStudents(file: File): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) {
      this.toasts.warning('Selecciona una materia');
      return;
    }
    this.importingStudents.set(true);
    this.academics.importStudents(subjectId, file).pipe(
      finalize(() => this.importingStudents.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.toasts.success('Alumnos importados', `${result.alumnos_detectados ?? 0} detectados`);
        this.loadStudents(subjectId);
      },
      error: (error: unknown) => this.toasts.error('Importacion fallida', errorMessage(error))
    });
  }

  askWithdraw(student: Student): void {
    this.studentToWithdraw.set(student);
  }

  acknowledgeWithdrawalRequest(): void {
    this.studentToWithdraw.set(null);
    this.toasts.info('Baja directa bloqueada', 'Se requiere flujo de solicitud y aprobacion administrativa.');
  }

  protected readonly Boolean = Boolean;
}
