import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { AcademicsService } from '../../services/academics.service';
import { GradesService } from '../../services/grades.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { Student, Subject } from '../../shared/models/academic.models';
import { GradeSummary, LocalActivity, WeightCategory } from '../../shared/models/grade.models';
import { TableColumn } from '../../shared/models/ui.models';

interface WeightDraft {
  nombre: string;
  porcentaje: number;
}

@Component({
  selector: 'agm-grades-screen',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, KpiCardComponent, SearchableTableComponent, FileUploadCardComponent, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <agm-page-header
      eyebrow="Calificaciones"
      title="Ponderaciones, actividades y concentrado"
      description="Configura categorias por materia, registra actividades y consulta promedios calculados por ms-grades."
    >
      <button class="btn ghost" type="button" (click)="reload()">Actualizar</button>
    </agm-page-header>

    @if (loading()) {
      <agm-loading-skeleton [rows]="6" />
    } @else {
      <section class="grid-4">
        <agm-kpi-card label="Materias" [value]="subjects().length" tone="primary" />
        <agm-kpi-card label="Ponderacion total" [value]="weightTotal() + '%'" [tone]="weightTotal() === 100 ? 'success' : 'warning'" />
        <agm-kpi-card label="Actividades creadas" [value]="activities().length" tone="warning" />
        <agm-kpi-card label="Promedio grupal" [value]="groupAverage()" [tone]="groupAverage() >= 70 ? 'success' : 'danger'" />
      </section>

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
            <p class="muted">{{ selectedSubject()?.docente_nombre || 'Docente pendiente' }}</p>
          }
        </article>

        <article class="panel pad" style="grid-column: span 2;">
          <div class="row between">
            <h2 class="panel-title">Ponderaciones</h2>
            @if (canEdit()) {
              <button class="btn ghost small" type="button" (click)="addWeight()">Agregar</button>
            }
          </div>

          @if (weightDraft().length) {
            <div class="stack">
              @for (weight of weightDraft(); track $index; let index = $index) {
                <div class="form-grid cols-2">
                  <div class="field">
                    <label>Categoria</label>
                    <input [disabled]="!canEdit()" [ngModel]="weight.nombre" (ngModelChange)="updateWeight(index, 'nombre', $event)">
                  </div>
                  <div class="field">
                    <label>Porcentaje</label>
                    <input type="number" min="1" max="100" [disabled]="!canEdit()" [ngModel]="weight.porcentaje" (ngModelChange)="updateWeight(index, 'porcentaje', $event)">
                  </div>
                </div>
              }
            </div>
          } @else {
            <agm-empty-state title="Sin ponderaciones" message="Define categorias que sumen exactamente 100 para habilitar actividades." />
          }

          @if (canEdit()) {
            <div class="row between wrap" style="margin-top: 14px;">
              <span class="muted">Total: {{ weightTotal() }}%</span>
              <button class="btn primary" type="button" [disabled]="weightTotal() !== 100 || savingWeights()" (click)="saveWeights()">
                {{ savingWeights() ? 'Guardando...' : 'Guardar ponderaciones' }}
              </button>
            </div>
          }
        </article>
      </section>

      @if (canEdit()) {
        <section class="grade-workflow" style="margin-top: 18px;">
          <article>
            <span>1</span>
            <strong>Configura categorias</strong>
            <small>La suma debe cerrar en 100%.</small>
          </article>
          <article>
            <span>2</span>
            <strong>Crea actividades</strong>
            <small>Define cada entrega o evaluacion.</small>
          </article>
          <article>
            <span>3</span>
            <strong>Captura o importa</strong>
            <small>Guarda puntajes por actividad.</small>
          </article>
        </section>

        <section class="grid-3" style="margin-top: 18px;">
          <article class="panel pad">
            <h2 class="panel-title">Nueva actividad</h2>
            <div class="form-grid">
              <div class="field">
                <label>Categoria guardada</label>
                <select [(ngModel)]="activityCategoryId">
                  <option [ngValue]="null">Selecciona categoria</option>
                  @for (weight of weights(); track weight.id) {
                    <option [ngValue]="weight.id">{{ weight.nombre }} ({{ weight.porcentaje }}%)</option>
                  }
                </select>
              </div>
              <div class="field">
                <label>Nombre</label>
                <input [(ngModel)]="activityName" placeholder="Proyecto final">
              </div>
              <div class="field">
                <label>Maximo de puntos</label>
                <input type="number" min="1" [(ngModel)]="activityMaxPoints">
              </div>
              <button class="btn primary" type="button" [disabled]="creatingActivity()" (click)="createActivity()">Crear actividad</button>
            </div>
          </article>

          <article class="panel pad">
            <h2 class="panel-title">Importar calificaciones</h2>
            <div class="field" style="margin-bottom: 12px;">
              <label>Actividad</label>
              <select [ngModel]="selectedActivityId" (ngModelChange)="selectActivity($event)">
                <option [ngValue]="null">Selecciona actividad</option>
                @for (activity of activities(); track activity.id) {
                  <option [ngValue]="activity.id">{{ activity.nombre }}</option>
                }
              </select>
            </div>
            <agm-file-upload-card
              title="CSV/XLSX de calificaciones"
              hint="Columnas esperadas: matricula y calificacion."
              accept=".csv,.xlsx,.xlsm"
              actionLabel="Importar"
              [loading]="importingGrades()"
              (upload)="importGrades($event)"
            />
          </article>

          <article class="panel pad">
            <h2 class="panel-title">Actividades disponibles</h2>
            @if (activities().length) {
              <div class="activity-list">
                @for (activity of activities(); track activity.id) {
                  <button
                    type="button"
                    [class.active]="selectedActivityId === activity.id"
                    (click)="selectActivity(activity.id)"
                  >
                    <strong>{{ activity.nombre }}</strong>
                    <span>{{ categoryName(activity.categoria_id) }} | {{ activity.max_puntos }} pts</span>
                  </button>
                }
              </div>
            } @else {
              <agm-empty-state title="Sin actividades" message="Crea la primera actividad despues de guardar ponderaciones." />
            }
          </article>
        </section>

        <section class="panel pad capture-panel" style="margin-top: 18px;">
          <div class="row between wrap">
            <div>
              <h2 class="panel-title">Captura por actividad</h2>
              <p class="muted">
                {{ selectedActivity()?.nombre || 'Selecciona una actividad para capturar puntajes.' }}
              </p>
            </div>
            <div class="capture-stats">
              <span>{{ students().length }} alumnos</span>
              <strong>{{ captureAverage() }}</strong>
            </div>
          </div>

          <div class="capture-status">
            <span class="sync-line">
              <span class="sync-dot" aria-hidden="true"></span>
              {{ saveStatusLabel() }}
            </span>
            @if (pendingDraftCount()) {
              <span class="status-badge warning">{{ pendingDraftCount() }} pendientes</span>
            }
          </div>

          @if (selectedActivity() && students().length) {
            <div class="capture-grid">
              @for (student of students(); track student.id) {
                <article>
                  <div>
                    <strong>{{ student.nombre }}</strong>
                    <span>{{ student.matricula }}</span>
                  </div>
                  <span class="average-pill" [class]="averageTone(student.id)">
                    {{ studentAverage(student.id) }}
                  </span>
                  <input
                    type="number"
                    min="0"
                    [max]="selectedActivity()?.max_puntos || 100"
                    [ngModel]="gradeDraft(student.id)"
                    (ngModelChange)="updateGradeDraft(student.id, $event)"
                    placeholder="0"
                  >
                  <button class="btn ghost small" type="button" [disabled]="savingStudent(student.id)" (click)="saveStudentGrade(student)">
                    {{ savingStudent(student.id) ? 'Guardando...' : 'Guardar' }}
                  </button>
                </article>
              }
            </div>
            <div class="row between wrap capture-footer">
              <span class="muted">Los puntajes guardados actualizan el concentrado de la materia.</span>
              <button class="btn primary" type="button" [disabled]="savingBatch() || !hasDrafts()" (click)="saveDraftGrades()">
                {{ savingBatch() ? 'Guardando...' : 'Guardar captura' }}
              </button>
            </div>
          } @else {
            <agm-empty-state
              title="Captura pendiente"
              message="Selecciona una actividad con alumnos inscritos para registrar o actualizar calificaciones."
            />
          }
        </section>
      }

      <section style="margin-top: 18px;">
        <agm-searchable-table
          [rows]="visibleSummary()"
          [columns]="summaryColumns"
          placeholder="Buscar alumno o matricula"
          emptyTitle="Sin concentrado"
          emptyMessage="El concentrado se llena cuando existen alumnos y calificaciones para la materia."
        />
      </section>
    }
  `,
  styles: [`
    .grade-workflow {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .grade-workflow article {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 2px 12px;
      align-items: center;
      padding: 15px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius);
      background: color-mix(in srgb, var(--agm-surface) 88%, var(--agm-primary-soft));
    }

    .grade-workflow span {
      grid-row: span 2;
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: white;
      background: linear-gradient(135deg, var(--agm-primary), var(--agm-secondary));
      font-weight: 900;
    }

    .grade-workflow small,
    .activity-list span,
    .capture-grid span {
      color: var(--agm-text-soft);
    }

    .activity-list {
      display: grid;
      gap: 10px;
    }

    .activity-list button {
      display: grid;
      gap: 3px;
      width: 100%;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius-sm);
      padding: 12px;
      color: inherit;
      background: var(--agm-surface-muted);
      text-align: left;
    }

    .activity-list button.active {
      border-color: var(--agm-secondary);
      background: var(--agm-primary-soft);
    }

    .capture-panel p {
      margin: 3px 0 0;
    }

    .capture-stats {
      display: grid;
      gap: 3px;
      min-width: 120px;
      text-align: right;
    }

    .capture-stats span {
      color: var(--agm-text-soft);
      font-size: 0.82rem;
    }

    .capture-stats strong {
      font-size: 1.25rem;
    }

    .capture-grid {
      display: grid;
      gap: 10px;
      margin-top: 16px;
    }

    .capture-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-top: 14px;
    }

    .capture-grid article {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) auto 110px auto;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius-sm);
      background: var(--agm-surface-muted);
    }

    .capture-grid article div {
      display: grid;
      gap: 3px;
    }

    .capture-grid input {
      width: 100%;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius-sm);
      padding: 10px 12px;
      background: var(--agm-surface);
      color: var(--agm-text);
    }

    .average-pill {
      display: inline-flex;
      min-width: 58px;
      min-height: 30px;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 0 10px;
      font-weight: 850;
      background: var(--agm-surface);
      border: 1px solid var(--agm-border);
    }

    .average-pill.success {
      color: var(--agm-success);
      border-color: color-mix(in srgb, var(--agm-success) 28%, var(--agm-border));
    }

    .average-pill.warning {
      color: var(--agm-warning);
      border-color: color-mix(in srgb, var(--agm-warning) 28%, var(--agm-border));
    }

    .average-pill.danger {
      color: var(--agm-danger);
      border-color: color-mix(in srgb, var(--agm-danger) 28%, var(--agm-border));
    }

    .capture-footer {
      margin-top: 14px;
    }

    @media (max-width: 920px) {
      .grade-workflow {
        grid-template-columns: 1fr;
      }

      .capture-grid article {
        grid-template-columns: 1fr;
      }

      .capture-stats {
        text-align: left;
      }

      .capture-status {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `]
})
export class GradesScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly academics = inject(AcademicsService);
  private readonly grades = inject(GradesService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly savingWeights = signal(false);
  readonly creatingActivity = signal(false);
  readonly importingGrades = signal(false);
  readonly subjects = signal<Subject[]>([]);
  readonly selectedSubjectId = signal<number | null>(null);
  readonly weights = signal<WeightCategory[]>([]);
  readonly weightDraft = signal<WeightDraft[]>([]);
  readonly activities = signal<LocalActivity[]>([]);
  readonly summary = signal<GradeSummary[]>([]);
  readonly students = signal<Student[]>([]);
  readonly draftScores = signal<Record<number, number | null>>({});
  readonly savingStudentIds = signal<number[]>([]);
  readonly savingBatch = signal(false);
  readonly lastSavedAt = signal<Date | null>(null);

  activityCategoryId: number | null = null;
  activityName = '';
  activityMaxPoints = 100;
  selectedActivityId: number | null = null;

  readonly summaryColumns: TableColumn<GradeSummary>[] = [
    { key: 'matricula', header: 'Matricula' },
    { key: 'nombre', header: 'Alumno' },
    { key: 'promedio_real', header: 'Promedio real', formatter: (row) => row.promedio_real.toFixed(2) },
    { key: 'promedio_redondeado', header: 'Redondeado' },
    { key: 'promedio_redondeado', header: 'Estado', badge: (row) => row.promedio_redondeado >= 70 ? 'Aprobado' : 'Reprobado' }
  ];

  readonly weightTotal = computed(() => Math.round(this.weightDraft().reduce((sum, item) => sum + Number(item.porcentaje || 0), 0) * 100) / 100);
  readonly visibleSummary = computed(() => {
    const summary = this.summary();
    const user = this.auth.user();
    return user?.role === 'alumno' && user.profile_id
      ? summary.filter((row) => row.alumno_id === user.profile_id)
      : summary;
  });

  ngOnInit(): void {
    this.reload();
  }

  canEdit(): boolean {
    return this.auth.role() === 'admin' || this.auth.role() === 'docente';
  }

  selectedSubject(): Subject | undefined {
    return this.subjects().find((subject) => subject.id === this.selectedSubjectId());
  }

  groupAverage(): number {
    const rows = this.visibleSummary();
    if (!rows.length) {
      return 0;
    }
    return Math.round((rows.reduce((sum, row) => sum + row.promedio_real, 0) / rows.length) * 10) / 10;
  }

  reload(): void {
    this.loading.set(true);
    this.subjectScope.listVisibleSubjects().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        const initial = this.selectedSubjectId() ?? subjects[0]?.id ?? null;
        this.selectedSubjectId.set(initial);
        if (initial) {
          this.loadSubjectData(initial, true);
        } else {
          this.loading.set(false);
        }
      },
      error: (error: unknown) => {
        this.toasts.error('No se cargaron materias', errorMessage(error));
        this.loading.set(false);
      }
    });
  }

  selectSubject(id: number | null): void {
    this.selectedSubjectId.set(id);
    if (id) {
      this.loadSubjectData(id);
    } else {
      this.weights.set([]);
      this.weightDraft.set([]);
      this.activities.set([]);
      this.summary.set([]);
      this.students.set([]);
      this.draftScores.set({});
    }
  }

  loadSubjectData(subjectId: number, finishLoading = false): void {
    forkJoin({
      weights: this.grades.listWeights(subjectId),
      summary: this.grades.getConcentrado(subjectId),
      students: this.academics.listStudentsBySubject(subjectId)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ weights, summary, students }) => {
        this.weights.set(weights);
        this.weightDraft.set(weights.map((weight) => ({ nombre: weight.nombre, porcentaje: weight.porcentaje })));
        this.summary.set(summary);
        this.students.set(students);
        this.activities.set(this.grades.getLocalActivities(subjectId));
        this.selectedActivityId = this.selectedActivityId ?? this.activities()[0]?.id ?? null;
        this.draftScores.set({});
        if (finishLoading) {
          this.loading.set(false);
        }
      },
      error: (error: unknown) => {
        this.toasts.warning('Datos incompletos', errorMessage(error));
        this.weights.set([]);
        this.weightDraft.set([]);
        this.summary.set([]);
        this.students.set([]);
        this.activities.set(this.grades.getLocalActivities(subjectId));
        this.selectedActivityId = this.activities()[0]?.id ?? null;
        this.draftScores.set({});
        if (finishLoading) {
          this.loading.set(false);
        }
      }
    });
  }

  addWeight(): void {
    this.weightDraft.update((items) => [...items, { nombre: 'Nueva categoria', porcentaje: 0 }]);
  }

  updateWeight(index: number, key: keyof WeightDraft, value: string | number): void {
    this.weightDraft.update((items) => items.map((item, itemIndex) => itemIndex === index
      ? { ...item, [key]: key === 'porcentaje' ? Number(value) : String(value) }
      : item
    ));
  }

  saveWeights(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId || this.weightTotal() !== 100) {
      this.toasts.warning('Ponderacion invalida', 'La suma debe ser exactamente 100.');
      return;
    }
    this.savingWeights.set(true);
    this.grades.saveWeights(subjectId, { items: this.weightDraft() }).pipe(
      finalize(() => this.savingWeights.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Ponderaciones guardadas');
        this.loadSubjectData(subjectId);
      },
      error: (error: unknown) => this.toasts.error('No se guardaron', errorMessage(error))
    });
  }

  createActivity(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId || !this.activityCategoryId || !this.activityName.trim()) {
      this.toasts.warning('Completa la actividad');
      return;
    }
    this.creatingActivity.set(true);
    this.grades.createActivity({
      materia_id: subjectId,
      categoria_id: this.activityCategoryId,
      nombre: this.activityName.trim(),
      max_puntos: Number(this.activityMaxPoints || 100)
    }).pipe(
      finalize(() => this.creatingActivity.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Actividad creada');
        this.activityName = '';
        this.activities.set(this.grades.getLocalActivities(subjectId));
        this.selectedActivityId = this.activities()[0]?.id ?? null;
      },
      error: (error: unknown) => this.toasts.error('No se creo la actividad', errorMessage(error))
    });
  }

  importGrades(file: File): void {
    const activityId = this.selectedActivityId;
    const subjectId = this.selectedSubjectId();
    if (!activityId || !subjectId) {
      this.toasts.warning('Selecciona una actividad');
      return;
    }
    this.importingGrades.set(true);
    this.grades.importGrades(activityId, file).pipe(
      finalize(() => this.importingGrades.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.toasts.success('Calificaciones importadas', `${result.actualizadas} actualizadas`);
        this.loadSubjectData(subjectId);
      },
      error: (error: unknown) => this.toasts.error('Importacion fallida', errorMessage(error))
    });
  }

  selectedActivity(): LocalActivity | undefined {
    return this.activities().find((activity) => activity.id === this.selectedActivityId);
  }

  selectActivity(activityId: number | null): void {
    this.selectedActivityId = activityId;
    this.draftScores.set({});
  }

  categoryName(categoryId: number): string {
    return this.weights().find((weight) => weight.id === categoryId)?.nombre ?? 'Categoria';
  }

  studentAverage(studentId: number): string {
    const summary = this.summary().find((row) => row.alumno_id === studentId);
    return summary ? summary.promedio_real.toFixed(1) : '--';
  }

  averageTone(studentId: number): 'success' | 'warning' | 'danger' {
    const summary = this.summary().find((row) => row.alumno_id === studentId);
    if (!summary) {
      return 'warning';
    }
    if (summary.promedio_redondeado >= 80) {
      return 'success';
    }
    if (summary.promedio_redondeado >= 70) {
      return 'warning';
    }
    return 'danger';
  }

  gradeDraft(studentId: number): number | null {
    return this.draftScores()[studentId] ?? null;
  }

  updateGradeDraft(studentId: number, value: number | string | null): void {
    const parsed = value === null || value === '' ? null : Number(value);
    this.draftScores.update((drafts) => ({ ...drafts, [studentId]: Number.isNaN(parsed) ? null : parsed }));
  }

  captureAverage(): string {
    const scores = Object.values(this.draftScores()).filter((score): score is number => typeof score === 'number');
    if (!scores.length) {
      return '--';
    }
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1);
  }

  hasDrafts(): boolean {
    return Object.values(this.draftScores()).some((score) => typeof score === 'number');
  }

  pendingDraftCount(): number {
    return Object.values(this.draftScores()).filter((score) => typeof score === 'number').length;
  }

  saveStatusLabel(): string {
    if (this.savingBatch() || this.savingStudentIds().length) {
      return 'Guardando cambios...';
    }
    const lastSavedAt = this.lastSavedAt();
    return lastSavedAt
      ? `Guardado ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Sin cambios pendientes';
  }

  savingStudent(studentId: number): boolean {
    return this.savingStudentIds().includes(studentId);
  }

  saveStudentGrade(student: Student): void {
    const subjectId = this.selectedSubjectId();
    const activity = this.selectedActivity();
    const score = this.gradeDraft(student.id);
    if (!subjectId || !activity || score === null) {
      this.toasts.warning('Selecciona actividad y calificacion');
      return;
    }
    this.savingStudentIds.update((ids) => [...ids, student.id]);
    this.grades.upsertGrade({
      activity_id: activity.id,
      student_id: student.id,
      score
    }).pipe(
      finalize(() => this.savingStudentIds.update((ids) => ids.filter((id) => id !== student.id))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Calificacion guardada');
        this.lastSavedAt.set(new Date());
        this.loadSubjectData(subjectId);
      },
      error: (error: unknown) => this.toasts.error('No se guardo la calificacion', errorMessage(error))
    });
  }

  saveDraftGrades(): void {
    const subjectId = this.selectedSubjectId();
    const activity = this.selectedActivity();
    const payloads = Object.entries(this.draftScores())
      .filter(([, score]) => typeof score === 'number')
      .map(([studentId, score]) => ({
        activity_id: activity?.id ?? 0,
        student_id: Number(studentId),
        score: Number(score)
      }));
    if (!subjectId || !activity || !payloads.length) {
      this.toasts.warning('No hay puntajes por guardar');
      return;
    }
    this.savingBatch.set(true);
    forkJoin(payloads.map((payload) => this.grades.upsertGrade(payload))).pipe(
      finalize(() => this.savingBatch.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Captura guardada', `${payloads.length} calificaciones actualizadas`);
        this.lastSavedAt.set(new Date());
        this.loadSubjectData(subjectId);
      },
      error: (error: unknown) => this.toasts.error('No se guardo la captura', errorMessage(error))
    });
  }
}
