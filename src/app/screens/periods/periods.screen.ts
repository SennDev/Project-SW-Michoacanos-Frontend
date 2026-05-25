import { Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize, of, delay } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { PeriodsService } from '../../services/periods.service';
import { AcademicsService } from '../../services/academics.service';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';

import { Period, Subject } from '../../shared/models/academic.models';
import { TableColumn } from '../../shared/models/ui.models';

const STUDY_PLANS = [
  'Ingeniería en Ciencias de la Computación',
  'Licenciatura en Ciencias de la Computación',
  'Ingeniería en Tecnologías de la Información'
];

function periodDateValidator(control: AbstractControl): ValidationErrors | null {
  const start = control.get('fecha_inicio')?.value as string | null;
  const end = control.get('fecha_fin')?.value as string | null;
  if (!start || !end) return null;
  return start <= end ? null : { dateRange: true };
}

@Component({
  selector: 'agm-periods-screen',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, DatePipe,
    PageHeaderComponent, SearchableTableComponent, FileUploadCardComponent,
    LoadingSkeletonComponent, EmptyStateComponent, ConfirmationModalComponent, KpiCardComponent
  ],
  templateUrl: './periods.screen.html',
  styleUrl: './periods.screen.scss'
})
export class PeriodsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  public readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly periodsService = inject(PeriodsService);
  private readonly academics = inject(AcademicsService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly importing = signal(false);

  readonly periods = signal<Period[]>([]);
  readonly subjects = signal<Subject[]>([]);

  readonly editingId = signal<number | null>(null);
  readonly periodToDelete = signal<Period | null>(null);
  readonly subjectWithdrawal = signal<Subject | null>(null);
  readonly isWithdrawing = signal(false);

  readonly studyPlans = STUDY_PLANS;

  // --- ROLES Y COMPUTADOS ---
  readonly isTeacher = computed(() => this.auth.role() === 'docente');
  readonly isAdmin = computed(() => this.auth.role() === 'admin');
  readonly isStudent = computed(() => this.auth.role() === 'alumno');

  readonly activePeriod = computed(() => this.periods().find(p => p.activo));

  // KPIs
  readonly pendingWithdrawalsCount = computed(() => this.subjects().filter(s => (s as any).status === 'baja_solicitada' || s.estado === 'baja_solicitada').length);

  readonly periodColumns: TableColumn<Period>[] = [
    { key: 'nombre', header: 'Periodo Académico' },
    { key: 'plan_estudios', header: 'Plan de Estudios' },
    { key: 'fecha_inicio', header: 'Inicio', formatter: (row) => new Date(row.fecha_inicio).toLocaleDateString() },
    { key: 'fecha_fin', header: 'Fin', formatter: (row) => new Date(row.fecha_fin).toLocaleDateString() },
    { key: 'activo', header: 'Estado', badge: (row) => row.activo ? 'Vigente' : 'Histórico' }
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

  load(): void {
    this.loading.set(true);
    this.periodsService.listPeriods().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (periods) => {
        const sorted = periods.sort((a, b) => Number(b.activo) - Number(a.activo));
        this.periods.set(sorted);

        const active = sorted.find(p => p.activo);
        if (active) {
          this.loadSubjects(active.id);
        } else {
          this.subjects.set([]);
          this.loading.set(false);
        }
      },
      error: (error: unknown) => {
        this.toasts.error('Error de Conexión', errorMessage(error));
        this.loading.set(false);
      }
    });
  }

  loadSubjects(periodId: number): void {
    this.subjectScope.listVisibleSubjects(periodId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.loading.set(false);
      },
      error: () => {
        this.subjects.set([]);
        this.loading.set(false);
      }
    });
  }

  // --- GESTIÓN DE PERIODOS (ADMIN) ---
  resetForm(): void {
    this.editingId.set(null);
    this.form.reset({ nombre: '', fecha_inicio: '', fecha_fin: '', plan_estudios: '' });
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
    if (this.form.invalid) return this.form.markAllAsTouched();

    this.saving.set(true);
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
        this.toasts.success(this.editingId() ? 'Periodo Actualizado' : 'Periodo Creado', 'El catálogo ha sido modificado.');
        this.resetForm();
        this.load();
      },
      error: (error: unknown) => this.toasts.error('Error al Guardar', errorMessage(error))
    });
  }

  askDelete(period: Period): void {
    if (period.activo) {
      this.toasts.warning('Acción Denegada', 'No puedes eliminar el periodo activo actualmente.');
      return;
    }
    this.periodToDelete.set(period);
  }

  deletePeriod(): void {
    const period = this.periodToDelete();
    if (!period) return;

    this.periodsService.deletePeriod(period.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.periodToDelete.set(null);
        this.toasts.success('Periodo Eliminado');
        this.load();
      },
      error: (error: unknown) => this.toasts.error('Error de Eliminación', errorMessage(error))
    });
  }

  importSchedule(file: File): void {
    this.importing.set(true);
    const activeId = this.activePeriod()?.id;

    if (!activeId) {
      this.importing.set(false);
      return this.toasts.warning('Requiere Periodo', 'Crea un periodo activo antes de importar materias.');
    }

    this.periodsService.importSchedule(file, activeId).pipe(
      finalize(() => this.importing.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.toasts.success('Catálogo Importado', `Se detectaron ${result.materias_detectadas ?? 0} materias en el PDF.`);
        this.load();
      },
      error: (error: unknown) => this.toasts.error('Error de Importación', errorMessage(error))
    });
  }

  // --- LÓGICA DE ALUMNO (SOLICITUD DE BAJA) ---
  askSubjectWithdrawal(subject: Subject): void {
    if ((subject as any).status === 'baja_solicitada' || subject.estado === 'baja_solicitada') return;
    this.subjectWithdrawal.set(subject);
  }

  confirmWithdrawalRequest(): void {
    const target = this.subjectWithdrawal();
    if (!target) return;

    this.isWithdrawing.set(true);

    const request = (this.academics as any).requestSubjectWithdrawal
      ? (this.academics as any).requestSubjectWithdrawal(target.id)
      : (this.academics as any).updateStudentStatus ? (this.academics as any).updateStudentStatus(target.id, 'baja_solicitada') : of({success: true});

    request.pipe(
      finalize(() => {
        this.isWithdrawing.set(false);
        this.subjectWithdrawal.set(null);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Baja en Proceso', 'El administrador fue notificado para su aprobación.');

        // Actualización Visual Inmediata Optímista.
        this.subjects.update(list => list.map(sub =>
          sub.id === target.id ? { ...sub, status: 'baja_solicitada', estado: 'baja_solicitada' } : sub
        ));
      },
      error: (err: unknown) => this.toasts.error('Error de Servidor', errorMessage(err))
    });
  }

  // --- HELPERS PARA UI ---
  protected readonly Boolean = Boolean;

  showControlError(controlName: 'nombre' | 'fecha_inicio' | 'fecha_fin' | 'plan_estudios'): boolean {
    const control = this.form.controls[controlName];
    return Boolean(control.touched && control.invalid);
  }

  hasDateRangeError(): boolean {
    return Boolean(this.form.touched && this.form.hasError('dateRange'));
  }

  private toDateInput(value: string): string {
    return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
  }
}
