import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { downloadBlob } from '../../core/utils/file-download';
import { ReportsService } from '../../services/reports.service';
import { GradesService } from '../../services/grades.service';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

import { Subject } from '../../shared/models/academic.models';
import { GradeSummary } from '../../shared/models/grade.models';
import { ReportFormat, ReportType, StudentStats, TeacherStats } from '../../shared/models/report.models';

@Component({
  selector: 'agm-reports-screen',
  standalone: true,
  imports: [
    CommonModule, FormsModule, PageHeaderComponent, KpiCardComponent,
    EmptyStateComponent, LoadingSkeletonComponent, StatusBadgeComponent
  ],
  templateUrl: './reports.screen.html',
  styleUrl: './reports.screen.scss'
})
export class ReportsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  public readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly reports = inject(ReportsService);
  private readonly grades = inject(GradesService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly subjects = signal<Subject[]>([]);
  readonly selectedSubjectId = signal<number | null>(null);

  readonly teacherStats = signal<TeacherStats[]>([]);
  readonly studentStats = signal<StudentStats[]>([]);
  readonly selectedSummary = signal<GradeSummary[]>([]);

  format: ReportFormat = 'pdf';

  readonly canExport = computed(() => this.auth.role() === 'admin' || this.auth.role() === 'docente');

  readonly atRiskStudents = computed(() => this.selectedSummary().filter((student) => student.promedio_redondeado < 70));

  readonly selectedSubjectAverage = computed(() => {
    const rows = this.selectedSummary();
    if (!rows.length) return '--';
    return (rows.reduce((sum, row) => sum + row.promedio_real, 0) / rows.length).toFixed(1);
  });

  readonly selectedSubject = computed(() => this.subjects().find(s => s.id === this.selectedSubjectId()));

  ngOnInit(): void {
    this.load();
    this.loadRoleStats();
  }

  load(): void {
    this.loading.set(true);
    this.subjectScope.listVisibleSubjects().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        const selected = this.selectedSubjectId() ?? this.subjects()[0]?.id ?? null;
        this.selectedSubjectId.set(selected);

        if (selected) {
          this.loadSelectedSummary(selected);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.toasts.error('Error de sistema', errorMessage(error, 'No fue posible cargar el catálogo de materias.'));
        this.loading.set(false);
      }
    });
  }

  selectSubject(subjectId: number | null): void {
    this.selectedSubjectId.set(subjectId);
    if (subjectId) {
      this.loadSelectedSummary(subjectId);
    } else {
      this.selectedSummary.set([]);
    }
  }

  private loadSelectedSummary(subjectId: number): void {
    this.grades.getConcentrado(subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (summary) => this.selectedSummary.set(summary),
      error: () => this.selectedSummary.set([])
    });
  }

  loadRoleStats(): void {
    const user = this.auth.user();
    if (user?.role === 'docente' && user.profile_id) {
      this.reports.teacherStats(user.profile_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (stats) => this.teacherStats.set(stats),
        error: () => this.teacherStats.set([])
      });
    }
    if (user?.role === 'alumno' && user.profile_id) {
      this.reports.studentStats(user.profile_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (stats) => this.studentStats.set(stats),
        error: () => this.studentStats.set([])
      });
    }
  }

  export(type: ReportType): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) {
      this.toasts.warning('Selección requerida', 'Selecciona una materia primero.');
      return;
    }

    this.exporting.set(true);
    this.reports.exportReport(type, subjectId, this.format).pipe(
      finalize(() => this.exporting.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (blob) => {
        const ext = this.format === 'xlsx' ? 'xlsx' : 'pdf';
        const filename = `Reporte_${type.toUpperCase()}_Grupo_${subjectId}_${new Date().getTime()}.${ext}`;
        downloadBlob(blob, filename);
        this.toasts.success('Generación Exitosa', 'El documento se ha descargado en tu dispositivo.');
      },
      error: (error: unknown) => this.toasts.error('Fallo en la generación', errorMessage(error))
    });
  }
}
