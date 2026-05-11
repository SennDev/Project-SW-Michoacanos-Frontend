import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { PeriodsService } from '../../services/periods.service';
import { GradesService } from '../../services/grades.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { Subject } from '../../shared/models/academic.models';
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
        <agm-kpi-card label="Actividades locales" [value]="activities().length" tone="warning" />
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
              <select [(ngModel)]="selectedActivityId">
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
            <h2 class="panel-title">Captura rapida</h2>
            <div class="form-grid">
              <div class="field">
                <label>Actividad ID</label>
                <input type="number" [(ngModel)]="quickActivityId">
              </div>
              <div class="field">
                <label>Alumno ID</label>
                <input type="number" [(ngModel)]="quickStudentId">
              </div>
              <div class="field">
                <label>Calificacion</label>
                <input type="number" min="0" [(ngModel)]="quickScore">
              </div>
              <button class="btn primary" type="button" (click)="saveQuickGrade()">Guardar calificacion</button>
            </div>
          </article>
        </section>
      }

      <section style="margin-top: 18px;">
        <agm-searchable-table
          [rows]="summary()"
          [columns]="summaryColumns"
          placeholder="Buscar alumno o matricula"
          emptyTitle="Sin concentrado"
          emptyMessage="El concentrado se llena cuando existen alumnos y calificaciones para la materia."
        />
      </section>
    }
  `
})
export class GradesScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly periods = inject(PeriodsService);
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

  activityCategoryId: number | null = null;
  activityName = '';
  activityMaxPoints = 100;
  selectedActivityId: number | null = null;
  quickActivityId: number | null = null;
  quickStudentId: number | null = null;
  quickScore: number | null = null;

  readonly summaryColumns: TableColumn<GradeSummary>[] = [
    { key: 'matricula', header: 'Matricula' },
    { key: 'nombre', header: 'Alumno' },
    { key: 'promedio_real', header: 'Promedio real', formatter: (row) => row.promedio_real.toFixed(2) },
    { key: 'promedio_redondeado', header: 'Redondeado' },
    { key: 'promedio_redondeado', header: 'Estado', badge: (row) => row.promedio_redondeado >= 70 ? 'Aprobado' : 'Reprobado' }
  ];

  readonly weightTotal = computed(() => Math.round(this.weightDraft().reduce((sum, item) => sum + Number(item.porcentaje || 0), 0) * 100) / 100);

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
    const rows = this.summary();
    if (!rows.length) {
      return 0;
    }
    return Math.round((rows.reduce((sum, row) => sum + row.promedio_real, 0) / rows.length) * 10) / 10;
  }

  reload(): void {
    this.loading.set(true);
    this.periods.listSubjects(undefined, 1, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    }
  }

  loadSubjectData(subjectId: number, finishLoading = false): void {
    forkJoin({
      weights: this.grades.listWeights(subjectId),
      summary: this.grades.getConcentrado(subjectId)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ weights, summary }) => {
        this.weights.set(weights);
        this.weightDraft.set(weights.map((weight) => ({ nombre: weight.nombre, porcentaje: weight.porcentaje })));
        this.summary.set(summary);
        this.activities.set(this.grades.getLocalActivities(subjectId));
        if (finishLoading) {
          this.loading.set(false);
        }
      },
      error: (error: unknown) => {
        this.toasts.warning('Datos incompletos', errorMessage(error));
        this.weights.set([]);
        this.weightDraft.set([]);
        this.summary.set([]);
        this.activities.set(this.grades.getLocalActivities(subjectId));
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

  saveQuickGrade(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId || !this.quickActivityId || !this.quickStudentId || this.quickScore === null) {
      this.toasts.warning('Completa la captura rapida');
      return;
    }
    this.grades.upsertGrade({
      activity_id: Number(this.quickActivityId),
      student_id: Number(this.quickStudentId),
      score: Number(this.quickScore)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toasts.success('Calificacion guardada');
        this.loadSubjectData(subjectId);
      },
      error: (error: unknown) => this.toasts.error('No se guardo la calificacion', errorMessage(error))
    });
  }
}
