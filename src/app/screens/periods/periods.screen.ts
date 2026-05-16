import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
            <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
              <div class="field">
                <label>Nombre</label>
                <input formControlName="nombre" placeholder="Primavera 2026">
              </div>
              <div class="form-grid cols-2">
                <div class="field">
                  <label>Inicio</label>
                  <input formControlName="fecha_inicio" placeholder="2026-01-08">
                </div>
                <div class="field">
                  <label>Fin</label>
                  <input formControlName="fecha_fin" placeholder="2026-05-30">
                </div>
              </div>
              <div class="field">
                <label>Plan de estudios</label>
                <input formControlName="plan_estudios" placeholder="Ingenieria en Tecnologias de la Informacion">
              </div>
              <label class="row">
                <input type="checkbox" formControlName="activo">
                <span>Marcar como periodo activo</span>
              </label>
              <button class="btn primary" type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Guardando...' : 'Guardar periodo' }}
              </button>
            </form>
          </aside>
        }
      </section>

      <section class="grid-2" style="margin-top: 18px;">
        @if (isAdmin()) {
          <agm-file-upload-card
            title="Importar programacion PDF"
            hint="Usa el endpoint /periodos/importar con archivo PDF real. Si seleccionas un periodo activo, se agregaran materias ahi."
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
                  <span class="status-badge" [class]="subject.estado === 'abierta' ? 'success' : 'neutral'">{{ subject.estado }}</span>
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
  `
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
    plan_estudios: ['', Validators.required],
    activo: [false]
  });

  ngOnInit(): void {
    this.load();
  }

  isAdmin(): boolean {
    return this.auth.role() === 'admin';
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
    this.form.reset({
      nombre: '',
      fecha_inicio: '',
      fecha_fin: '',
      plan_estudios: '',
      activo: false
    });
  }

  edit(period: Period): void {
    this.editingId.set(period.id);
    this.form.setValue({
      nombre: period.nombre,
      fecha_inicio: period.fecha_inicio,
      fecha_fin: period.fecha_fin,
      plan_estudios: period.plan_estudios,
      activo: period.activo
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const request = this.editingId()
      ? this.periodsService.updatePeriod(this.editingId()!, this.form.getRawValue())
      : this.periodsService.createPeriod(this.form.getRawValue());

    request.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toasts.success('Periodo guardado');
        this.resetForm();
        this.load();
      },
      error: (error: unknown) => this.toasts.error('No se guardo el periodo', errorMessage(error))
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
}
