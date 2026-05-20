import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { PeriodsService } from '../../services/periods.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { Period, Subject } from '../../shared/models/academic.models';
import { TableColumn } from '../../shared/models/ui.models';

const STUDY_PLANS = [
  'Ingenieria en Ciencias de la Computacion',
  'Licenciatura en Ciencias de la Computacion',
  'Ingenieria en Tecnologias de la Informacion'
];

function periodDateValidator(control: AbstractControl): ValidationErrors | null {
  const start = control.get('fecha_inicio')?.value as string | null;
  const end = control.get('fecha_fin')?.value as string | null;

  if (!start || !end) {
    return null;
  }

  return start <= end ? null : { dateRange: true };
}

@Component({
  selector: 'agm-periods-screen',
  standalone: true,
  imports: [
    ReactiveFormsModule,
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
      eyebrow="Periodos"
      title="Periodos y programacion academica"
      description="Gestiona ciclos, materias importadas desde PDF y el periodo activo usado por reportes y estadisticas."
    >
      @if (isAdmin()) {
        <button class="btn primary" type="button" (click)="resetForm()">Nuevo periodo</button>
      }
    </agm-page-header>

    @if (error()) {
      <agm-error-state [message]="error()" (retry)="load()" />
    }

    @if (loading()) {
      <agm-loading-skeleton [rows]="5" />
    } @else {
      <section class="grid-3">
        <article class="panel pad" style="grid-column: span 2;">
          <h2 class="panel-title">Periodos registrados</h2>
          <agm-searchable-table
            [rows]="periodRows()"
            [columns]="periodColumns"
            placeholder="Buscar por nombre, plan o fecha"
            [actions]="isAdmin() ? periodActions : null"
            emptyTitle="Sin periodos"
            emptyMessage="Crea un periodo o importa la programacion academica para poblar esta vista."
          />

          <ng-template #periodActions let-period>
            <div class="row">
              <button class="btn ghost small" type="button" (click)="edit(period)">Editar</button>
              <button class="btn danger small" type="button" (click)="askDelete(period)">Eliminar</button>
            </div>
          </ng-template>
        </article>

        @if (isAdmin()) {
          <aside class="panel pad">
            <h2 class="panel-title">{{ editingId() ? 'Editar periodo' : 'Crear periodo' }}</h2>
            <form class="form-grid" [formGroup]="form" (ngSubmit)="save()" novalidate>
              <div class="field">
                <label for="period-name">Nombre</label>
                <input id="period-name" formControlName="nombre" placeholder="Primavera 2026" [attr.aria-invalid]="showControlError('nombre')">
                @if (showControlError('nombre')) {
                  <span class="field-error">El nombre del periodo es obligatorio.</span>
                }
              </div>
              <div class="form-grid cols-2">
                <div class="field">
                  <label for="period-start">Inicio de cursos</label>
                  <input id="period-start" type="date" formControlName="fecha_inicio" [attr.aria-invalid]="showControlError('fecha_inicio') || hasDateRangeError()">
                  @if (showControlError('fecha_inicio')) {
                    <span class="field-error">Selecciona la fecha de inicio.</span>
                  }
                </div>
                <div class="field">
                  <label for="period-end">Fin de cursos</label>
                  <input id="period-end" type="date" formControlName="fecha_fin" [attr.aria-invalid]="showControlError('fecha_fin') || hasDateRangeError()">
                  @if (showControlError('fecha_fin')) {
                    <span class="field-error">Selecciona la fecha de cierre.</span>
                  }
                </div>
              </div>
              @if (hasDateRangeError()) {
                <span class="field-error">La fecha de inicio no puede ser posterior a la fecha de fin.</span>
              }
              <div class="field">
                <label for="period-plan">Plan de estudios</label>
                <select id="period-plan" formControlName="plan_estudios" [attr.aria-invalid]="showControlError('plan_estudios')">
                  <option value="">Selecciona carrera</option>
                  @for (plan of studyPlans; track plan) {
                    <option [value]="plan">{{ plan }}</option>
                  }
                </select>
                @if (showControlError('plan_estudios')) {
                  <span class="field-error">Selecciona una carrera valida.</span>
                }
              </div>
              <p class="form-note">AGM conserva el estado activo desde el backend; esta pantalla ya no fuerza cambios manuales de periodo activo.</p>
              <button class="btn primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saveButtonLabel() }}
              </button>
              @if (saveMessage()) {
                <span class="save-feedback" [class.error]="saveStatus() === 'error'">{{ saveMessage() }}</span>
              }
            </form>
          </aside>
        }
      </section>

      <section class="grid-2" style="margin-top: 18px;">
        @if (isAdmin()) {
          <agm-file-upload-card
            title="Importar programacion PDF"
            hint="Usa el endpoint /periodos/importar con archivo PDF real. AGM usa el periodo vigente que devuelve el backend."
            accept=".pdf"
            actionLabel="Importar PDF"
            [loading]="importing()"
            (upload)="importSchedule($event)"
          />
        }

        <article class="panel pad">
          <h2 class="panel-title">Materias detectadas</h2>
          @if (subjects().length) {
            <div class="metric-list">
              @for (subject of subjects().slice(0, 8); track subject.id) {
                <div class="metric-row">
                  <span>{{ subject.nrc }} - {{ subject.nombre }}</span>
                  <span class="row">
                    <span class="status-badge" [class]="subject.estado === 'abierta' ? 'success' : 'neutral'">{{ subject.estado }}</span>
                    @if (isStudent()) {
                      <button class="btn ghost small" type="button" (click)="askSubjectWithdrawal(subject)">Solicitar baja</button>
                    }
                  </span>
                </div>
              }
            </div>
          } @else {
            <agm-empty-state title="Sin materias" message="Importa la programacion academica o revisa que ms-periods este disponible." />
          }
        </article>
      </section>
    }

    <agm-confirmation-modal
      [open]="Boolean(periodToDelete())"
      title="Eliminar periodo"
      [message]="'Se eliminara ' + (periodToDelete()?.nombre || 'este periodo') + ' junto con sus materias.'"
      confirmLabel="Eliminar"
      (confirm)="deletePeriod()"
      (cancel)="periodToDelete.set(null)"
    />

    <agm-confirmation-modal
      [open]="Boolean(subjectWithdrawal())"
      title="Solicitud de baja"
      [message]="'Para baja de ' + (subjectWithdrawal()?.nombre || 'esta materia') + ', AGM requiere aprobacion administrativa. El backend actual no expone todavia un endpoint de solicitud, por lo que no se elimina tu acceso desde esta pantalla.'"
      confirmLabel="Entendido"
      (confirm)="subjectWithdrawal.set(null)"
      (cancel)="subjectWithdrawal.set(null)"
    />
  `,
  styles: [`
    .form-note,
    .save-feedback {
      color: var(--agm-text-soft);
      font-size: var(--agm-font-size-sm);
      line-height: 1.5;
    }

    .save-feedback {
      color: var(--agm-success);
      font-weight: 800;
    }

    .save-feedback.error {
      color: var(--agm-danger);
    }

    .metric-row .row {
      justify-content: end;
      gap: 8px;
    }

    @media (max-width: 720px) {
      article[style*="grid-column"] {
        grid-column: auto !important;
      }

      .metric-row .row {
        justify-content: start;
      }
    }
  `]
})
export class PeriodsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly periodsService = inject(PeriodsService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly importing = signal(false);
  readonly error = signal('');
  readonly periods = signal<Period[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly editingId = signal<number | null>(null);
  readonly periodToDelete = signal<Period | null>(null);
  readonly subjectWithdrawal = signal<Subject | null>(null);
  readonly saveStatus = signal<'idle' | 'success' | 'error'>('idle');
  readonly saveMessage = signal('');
  readonly studyPlans = STUDY_PLANS;

  readonly periodColumns: TableColumn<Period>[] = [
    { key: 'nombre', header: 'Periodo' },
    { key: 'fecha_inicio', header: 'Inicio' },
    { key: 'fecha_fin', header: 'Fin' },
    { key: 'plan_estudios', header: 'Plan' },
    { key: 'activo', header: 'Estado', badge: (row) => row.activo ? 'Activo' : 'Inactivo' }
  ];

  readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    fecha_inicio: ['', Validators.required],
    fecha_fin: ['', Validators.required],
    plan_estudios: ['', Validators.required]
  }, { validators: periodDateValidator });

  ngOnInit(): void {
    this.load();
  }

  isAdmin(): boolean {
    return this.auth.role() === 'admin';
  }

  isStudent(): boolean {
    return this.auth.role() === 'alumno';
  }

  periodRows(): Period[] {
    return this.periods();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.periodsService.listPeriods().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (periods) => {
        this.periods.set(periods);
        this.loadSubjects(periods.find((period) => period.activo)?.id);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error, 'No fue posible cargar periodos.'));
        this.loading.set(false);
      }
    });
  }

  loadSubjects(periodId?: number): void {
    this.subjectScope.listVisibleSubjects(periodId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        this.loading.set(false);
      },
      error: () => {
        this.subjects.set([]);
        this.loading.set(false);
      }
    });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.saveStatus.set('idle');
    this.saveMessage.set('');
    this.form.reset({
      nombre: '',
      fecha_inicio: '',
      fecha_fin: '',
      plan_estudios: ''
    });
  }

  edit(period: Period): void {
    this.editingId.set(period.id);
    this.form.setValue({
      nombre: period.nombre,
      fecha_inicio: this.toDateInput(period.fecha_inicio),
      fecha_fin: this.toDateInput(period.fecha_fin),
      plan_estudios: this.studyPlans.includes(period.plan_estudios) ? period.plan_estudios : ''
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saveStatus.set('idle');
    this.saveMessage.set('');
    const existingPeriod = this.periods().find((period) => period.id === this.editingId());
    const payload = {
      ...this.form.getRawValue(),
      activo: existingPeriod?.activo ?? true
    };
    const request = this.editingId()
      ? this.periodsService.updatePeriod(this.editingId()!, payload)
      : this.periodsService.createPeriod(payload);

    request.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        const message = this.editingId() ? 'Cambios del periodo guardados' : 'Periodo creado correctamente';
        this.toasts.success(message);
        this.resetForm();
        this.saveStatus.set('success');
        this.saveMessage.set(message);
        this.load();
      },
      error: (error: unknown) => {
        const message = errorMessage(error);
        this.saveStatus.set('error');
        this.saveMessage.set(message);
        this.toasts.error('No se guardo el periodo', message);
      }
    });
  }

  importSchedule(file: File): void {
    this.importing.set(true);
    const activeId = this.periods().find((period) => period.activo)?.id;
    this.periodsService.importSchedule(file, activeId).pipe(
      finalize(() => this.importing.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.toasts.success('Programacion importada', `${result.materias_detectadas ?? 0} materias detectadas`);
        this.load();
      },
      error: (error: unknown) => this.toasts.error('Importacion fallida', errorMessage(error))
    });
  }

  askDelete(period: Period): void {
    this.periodToDelete.set(period);
  }

  askSubjectWithdrawal(subject: Subject): void {
    this.subjectWithdrawal.set(subject);
  }

  deletePeriod(): void {
    const period = this.periodToDelete();
    if (!period) {
      return;
    }
    this.periodsService.deletePeriod(period.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.periodToDelete.set(null);
        this.toasts.success('Periodo eliminado');
        this.load();
      },
      error: (error: unknown) => this.toasts.error('No se elimino el periodo', errorMessage(error))
    });
  }

  protected readonly Boolean = Boolean;

  showControlError(controlName: 'nombre' | 'fecha_inicio' | 'fecha_fin' | 'plan_estudios'): boolean {
    const control = this.form.controls[controlName];
    return Boolean(control.touched && control.invalid);
  }

  hasDateRangeError(): boolean {
    return Boolean(this.form.touched && this.form.hasError('dateRange'));
  }

  saveButtonLabel(): string {
    if (this.saving()) {
      return this.editingId() ? 'Guardando cambios...' : 'Creando periodo...';
    }
    return this.editingId() ? 'Guardar cambios' : 'Crear periodo';
  }

  private toDateInput(value: string): string {
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
  }
}
