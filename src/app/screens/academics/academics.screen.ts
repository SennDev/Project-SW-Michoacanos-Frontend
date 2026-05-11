import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, finalize, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { AcademicsService } from '../../services/academics.service';
import { PeriodsService } from '../../services/periods.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { Student, Subject, Teacher } from '../../shared/models/academic.models';
import { TableColumn } from '../../shared/models/ui.models';

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
        <button type="button" [class.active]="tab() === 'teachers'" (click)="tab.set('teachers')">Docentes</button>
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
              <div class="metric-row"><span>Docentes</span><strong>{{ teachers().length }}</strong></div>
            </div>
          </article>
        </section>

        <section style="margin-top: 18px;">
          <agm-searchable-table
            [rows]="students()"
            [columns]="studentColumns"
            [actions]="isAdmin() ? studentActions : null"
            placeholder="Buscar alumno, matricula o correo"
            emptyTitle="Sin alumnos"
            emptyMessage="Selecciona una materia e importa alumnos para ver el listado."
          />
          <ng-template #studentActions let-student>
            <button class="btn danger small" type="button" (click)="askWithdraw(student)">Dar baja</button>
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
      title="Dar de baja alumno"
      [message]="'Se registrara la baja de ' + (studentToWithdraw()?.nombre || 'este alumno') + ' en la materia seleccionada.'"
      confirmLabel="Registrar baja"
      (confirm)="withdrawStudent()"
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
  `]
})
export class AcademicsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly academics = inject(AcademicsService);
  private readonly periods = inject(PeriodsService);
  private readonly toasts = inject(ToastService);

  readonly tab = signal<'teachers' | 'students' | 'subjects'>('teachers');
  readonly loading = signal(true);
  readonly importingTeachers = signal(false);
  readonly importingStudents = signal(false);
  readonly error = signal('');
  readonly teachers = signal<Teacher[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly students = signal<Student[]>([]);
  readonly selectedSubjectId = signal<number | null>(null);
  readonly studentToWithdraw = signal<Student | null>(null);

  readonly teacherColumns: TableColumn<Teacher>[] = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'email', header: 'Correo' },
    { key: 'ubicacion', header: 'Ubicacion' },
    { key: 'extension', header: 'Extension' }
  ];

  readonly studentColumns: TableColumn<Student>[] = [
    { key: 'matricula', header: 'Matricula' },
    { key: 'nombre', header: 'Nombre' },
    { key: 'email', header: 'Correo' },
    { key: 'nivel', header: 'Nivel' },
    { key: 'status', header: 'Estado', badge: (row) => row.activo === false ? 'Baja' : row.status }
  ];

  ngOnInit(): void {
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
      teachers: this.auth.role() === 'alumno' ? of([]) : this.academics.listTeachers(),
      subjects: this.periods.listSubjects(undefined, 1, 100)
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
    }
  }

  loadStudents(subjectId: number): void {
    this.academics.listStudentsBySubject(subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (students) => this.students.set(students),
      error: () => this.students.set([])
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

  withdrawStudent(): void {
    const student = this.studentToWithdraw();
    const subjectId = this.selectedSubjectId();
    if (!student || !subjectId) {
      return;
    }
    this.academics.withdrawStudent(student.id, subjectId, 'Baja registrada desde frontend AGM').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.studentToWithdraw.set(null);
        this.toasts.success('Baja registrada');
        this.loadStudents(subjectId);
      },
      error: (error: unknown) => this.toasts.error('No se registro la baja', errorMessage(error))
    });
  }

  protected readonly Boolean = Boolean;
}
