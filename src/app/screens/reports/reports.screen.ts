import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
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
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { Subject } from '../../shared/models/academic.models';
import { GradeSummary } from '../../shared/models/grade.models';
import { DownloadHistoryItem, ReportFormat, ReportType, StudentStats, TeacherStats } from '../../shared/models/report.models';
import { TableColumn } from '../../shared/models/ui.models';

@Component({
  selector: 'agm-reports-screen',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, KpiCardComponent, SearchableTableComponent, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <agm-page-header
      eyebrow="Reportes"
      title="Exportaciones PDF y XLSX"
      description="Descarga reportes de calificaciones y asistencias desde ms-reports, con filtros por materia y formato."
    />

    @if (loading()) {
      <agm-loading-skeleton [rows]="5" />
    } @else {
      <section class="grid-4">
        <agm-kpi-card label="Materias" [value]="subjects().length" tone="primary" />
        <agm-kpi-card label="Descargas locales" [value]="history().length" tone="success" />
        <agm-kpi-card label="Formatos" value="PDF/XLSX" tone="warning" />
        <agm-kpi-card label="Rol" [value]="roleLabel()" tone="neutral" />
      </section>

      <section class="grid-3" style="margin-top: 18px;">
        <article class="panel pad">
          <h2 class="panel-title">Filtros</h2>
          <div class="form-grid">
            <div class="field">
              <label>Materia</label>
              <select [ngModel]="selectedSubjectId()" (ngModelChange)="selectSubject($event)">
                <option [ngValue]="null">Selecciona materia</option>
                @for (subject of subjects(); track subject.id) {
                  <option [ngValue]="subject.id">{{ subject.nrc }} - {{ subject.nombre }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Formato</label>
              <select [(ngModel)]="format">
                <option value="pdf">PDF</option>
                <option value="xlsx">XLSX</option>
              </select>
            </div>
          </div>
        </article>

        <article class="panel pad" style="grid-column: span 2;">
          <h2 class="panel-title">Centro de reportes</h2>
          @if (canExport()) {
            <div class="report-grid">
              <article>
                <span class="status-badge success">Disponible</span>
                <h3>Promedio del grupo</h3>
                <p>Concentrado de calificaciones por materia.</p>
                <button class="btn primary" type="button" [disabled]="exporting()" (click)="export('calificaciones')">Generar</button>
              </article>
              <article>
                <span class="status-badge success">Disponible</span>
                <h3>Asistencia del grupo</h3>
                <p>Historial de asistencia por materia.</p>
                <button class="btn primary" type="button" [disabled]="exporting()" (click)="export('asistencias')">Generar</button>
              </article>
              <article>
                <span class="status-badge warning">Vista previa</span>
                <h3>Alumnos en riesgo</h3>
                <p>{{ atRiskStudents().length }} alumnos con promedio menor a 70.</p>
                <button class="btn ghost" type="button" disabled>Sin exportacion REST</button>
              </article>
              <article>
                <span class="status-badge neutral">Pendiente</span>
                <h3>Reporte individual</h3>
                <p>Requiere endpoint dedicado para descarga por alumno.</p>
                <button class="btn ghost" type="button" disabled>No disponible aun</button>
              </article>
            </div>
          } @else {
            <agm-empty-state
              title="Exportacion restringida por backend"
              message="Los endpoints de reportes aceptan admin/docente. Para alumno se muestran estadisticas disponibles y la UI queda lista si el backend habilita descargas."
            />
          }
        </article>
      </section>

      @if (canExport()) {
        <section class="grid-2" style="margin-top: 18px;">
          <article class="panel pad">
            <h2 class="panel-title">Materia seleccionada</h2>
            @if (selectedSubject()) {
              <div class="metric-list">
                <div class="metric-row"><span>Materia</span><strong>{{ selectedSubject()?.nombre }}</strong></div>
                <div class="metric-row"><span>Alumnos en riesgo</span><strong>{{ atRiskStudents().length }}</strong></div>
                <div class="metric-row"><span>Promedio grupal</span><strong>{{ selectedSubjectAverage() }}</strong></div>
              </div>
            } @else {
              <agm-empty-state title="Seleccion pendiente" message="Elige una materia para consultar su resumen." />
            }
          </article>

          <article class="panel pad">
            <h2 class="panel-title">Alumnos en riesgo</h2>
            @if (atRiskStudents().length) {
              <div class="metric-list">
                @for (student of atRiskStudents().slice(0, 5); track student.alumno_id) {
                  <div class="metric-row">
                    <span>{{ student.nombre }}</span>
                    <strong>{{ student.promedio_real.toFixed(1) }}</strong>
                  </div>
                }
              </div>
            } @else {
              <agm-empty-state title="Sin alertas" message="No hay alumnos por debajo de 70 en la materia seleccionada." />
            }
          </article>
        </section>
      }

      @if (teacherStats().length || studentStats().length) {
        <section class="grid-2" style="margin-top: 18px;">
          @for (stat of teacherStats(); track stat.materia_id) {
            <article class="panel pad">
              <h2 class="panel-title">{{ stat.materia }}</h2>
              <div class="metric-list">
                <div class="metric-row"><span>Promedio grupal</span><strong>{{ stat.promedio_grupal }}</strong></div>
                <div class="metric-row"><span>Aprobacion</span><strong>{{ stat.aprobacion }}%</strong></div>
                <div class="metric-row"><span>Sesiones</span><strong>{{ stat.sesiones }}</strong></div>
              </div>
            </article>
          }
          @for (stat of studentStats(); track stat.materia_id) {
            <article class="panel pad">
              <h2 class="panel-title">{{ stat.materia }}</h2>
              <div class="metric-list">
                <div class="metric-row"><span>Promedio actual</span><strong>{{ stat.promedio_actual }}</strong></div>
                <div class="metric-row"><span>Asistencias</span><strong>{{ stat.asistencias }}</strong></div>
              </div>
            </article>
          }
        </section>
      }

      <section style="margin-top: 18px;">
        <agm-searchable-table
          [rows]="history()"
          [columns]="historyColumns"
          placeholder="Buscar por tipo, formato o fecha"
          emptyTitle="Sin descargas recientes"
          emptyMessage="Las descargas generadas desde este navegador se conservaran aqui."
        />
      </section>
    }
  `,
  styles: [`
    .report-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .report-grid article {
      display: grid;
      align-content: start;
      gap: 9px;
      min-height: 180px;
      padding: 16px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius);
      background: var(--agm-surface-muted);
    }

    .report-grid h3,
    .report-grid p {
      margin: 0;
    }

    .report-grid h3 {
      font-size: 1rem;
    }

    .report-grid p {
      color: var(--agm-text-soft);
      line-height: 1.5;
    }

    .report-grid .btn {
      margin-top: auto;
    }

    @media (max-width: 1180px) {
      .report-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .report-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ReportsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly reports = inject(ReportsService);
  private readonly grades = inject(GradesService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly subjects = signal<Subject[]>([]);
  readonly selectedSubjectId = signal<number | null>(null);
  readonly history = signal<DownloadHistoryItem[]>([]);
  readonly teacherStats = signal<TeacherStats[]>([]);
  readonly studentStats = signal<StudentStats[]>([]);
  readonly selectedSummary = signal<GradeSummary[]>([]);

  format: ReportFormat = 'pdf';

  readonly historyColumns: TableColumn<DownloadHistoryItem>[] = [
    { key: 'type', header: 'Tipo' },
    { key: 'subjectId', header: 'Materia ID' },
    { key: 'format', header: 'Formato', badge: (row) => row.format.toUpperCase() },
    { key: 'createdAt', header: 'Fecha', formatter: (row) => new Date(row.createdAt).toLocaleString() }
  ];
  readonly atRiskStudents = computed(() => this.selectedSummary().filter((student) => student.promedio_redondeado < 70));

  ngOnInit(): void {
    this.history.set(this.reports.history());
    this.load();
    this.loadRoleStats();
  }

  canExport(): boolean {
    return this.auth.role() === 'admin' || this.auth.role() === 'docente';
  }

  roleLabel(): string {
    const role = this.auth.role();
    if (role === 'docente') {
      return 'Docente';
    }
    if (role === 'alumno') {
      return 'Alumno';
    }
    return 'Admin';
  }

  selectedSubject(): Subject | undefined {
    return this.subjects().find((subject) => subject.id === this.selectedSubjectId());
  }

  selectedSubjectAverage(): string {
    const rows = this.selectedSummary();
    if (!rows.length) {
      return '--';
    }
    return (rows.reduce((sum, row) => sum + row.promedio_real, 0) / rows.length).toFixed(1);
  }

  load(): void {
    this.loading.set(true);
    this.subjectScope.listVisibleSubjects().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        const selected = this.selectedSubjectId() ?? subjects[0]?.id ?? null;
        this.selectedSubjectId.set(selected);
        if (selected) {
          this.loadSelectedSummary(selected);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.toasts.error('No se cargaron materias', errorMessage(error));
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
      this.toasts.warning('Selecciona una materia');
      return;
    }
    this.exporting.set(true);
    this.reports.exportReport(type, subjectId, this.format).pipe(
      finalize(() => this.exporting.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (blob) => {
        const filename = `${type}_${subjectId}.${this.format}`;
        downloadBlob(blob, filename);
        this.history.set(this.reports.history());
        this.toasts.success('Reporte generado', filename);
      },
      error: (error: unknown) => this.toasts.error('No se genero el reporte', errorMessage(error))
    });
  }

  private loadSelectedSummary(subjectId: number): void {
    this.grades.getConcentrado(subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (summary) => this.selectedSummary.set(summary),
      error: () => this.selectedSummary.set([])
    });
  }
}
