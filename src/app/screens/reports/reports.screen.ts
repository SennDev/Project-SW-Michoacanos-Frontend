import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { downloadBlob } from '../../core/utils/file-download';
import { PeriodsService } from '../../services/periods.service';
import { ReportsService } from '../../services/reports.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { Subject } from '../../shared/models/academic.models';
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
              <select [ngModel]="selectedSubjectId()" (ngModelChange)="selectedSubjectId.set($event)">
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
          <h2 class="panel-title">Exportar</h2>
          @if (canExport()) {
            <div class="row wrap">
              <button class="btn primary" type="button" [disabled]="exporting()" (click)="export('calificaciones')">Calificaciones</button>
              <button class="btn primary" type="button" [disabled]="exporting()" (click)="export('asistencias')">Asistencias</button>
            </div>
            <p class="muted" style="margin-top: 12px;">Los archivos se generan en tiempo real desde los microservicios de calificaciones, asistencias, academicos y periodos.</p>
          } @else {
            <agm-empty-state
              title="Exportacion restringida por backend"
              message="Los endpoints de reportes aceptan admin/docente. Para alumno se muestran estadisticas disponibles y la UI queda lista si el backend habilita descargas."
            />
          }
        </article>
      </section>

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
  `
})
export class ReportsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly periods = inject(PeriodsService);
  private readonly reports = inject(ReportsService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly subjects = signal<Subject[]>([]);
  readonly selectedSubjectId = signal<number | null>(null);
  readonly history = signal<DownloadHistoryItem[]>([]);
  readonly teacherStats = signal<TeacherStats[]>([]);
  readonly studentStats = signal<StudentStats[]>([]);

  format: ReportFormat = 'pdf';

  readonly historyColumns: TableColumn<DownloadHistoryItem>[] = [
    { key: 'type', header: 'Tipo' },
    { key: 'subjectId', header: 'Materia ID' },
    { key: 'format', header: 'Formato', badge: (row) => row.format.toUpperCase() },
    { key: 'createdAt', header: 'Fecha', formatter: (row) => new Date(row.createdAt).toLocaleString() }
  ];

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

  load(): void {
    this.loading.set(true);
    this.periods.listSubjects(undefined, 1, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        this.selectedSubjectId.set(this.selectedSubjectId() ?? subjects[0]?.id ?? null);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.toasts.error('No se cargaron materias', errorMessage(error));
        this.loading.set(false);
      }
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
}
