import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HealthService } from '../../core/services/health.service';
import { PeriodsService } from '../../services/periods.service';
import { AcademicsService } from '../../services/academics.service';
import { ReportsService } from '../../services/reports.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { HealthStatus } from '../../shared/models/api.models';
import { Period, Subject, Teacher } from '../../shared/models/academic.models';
import { ChartPoint } from '../../shared/models/ui.models';
import { StudentStats, TeacherStats } from '../../shared/models/report.models';

interface DashboardState {
  periods: Period[];
  subjects: Subject[];
  teachers: Teacher[];
  health: HealthStatus[];
  teacherStats: TeacherStats[];
  studentStats: StudentStats[];
}

@Component({
  selector: 'agm-dashboard-screen',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, KpiCardComponent, ChartCardComponent, LoadingSkeletonComponent, EmptyStateComponent],
  template: `
    <agm-page-header
      eyebrow="Panel"
      [title]="title()"
      [description]="description()"
    >
      <a class="btn primary" routerLink="/reports">Exportar reportes</a>
      <a class="btn ghost" routerLink="/system-health">Ver salud</a>
    </agm-page-header>

    @if (loading()) {
      <agm-loading-skeleton [rows]="6" />
    } @else {
      <section class="dashboard-hero">
        <div>
          <span class="status-badge info">{{ roleLabel() }}</span>
          <h2>{{ heroTitle() }}</h2>
          <p>{{ heroCopy() }}</p>
        </div>
        <div class="hero-rail" aria-label="Resumen operativo">
          <div>
            <span>Periodo activo</span>
            <strong>{{ activePeriodName() }}</strong>
          </div>
          <div>
            <span>Servicios REST</span>
            <strong>{{ onlineCount() }}/{{ state().health.length }}</strong>
          </div>
          <div>
            <span>Materias abiertas</span>
            <strong>{{ openSubjects() }}</strong>
          </div>
        </div>
      </section>

      <section class="grid-4">
        <agm-kpi-card label="Periodos" [value]="state().periods.length" delta="Ciclos registrados" tone="primary" />
        <agm-kpi-card label="Materias" [value]="state().subjects.length" delta="Disponibles por REST" tone="success" />
        <agm-kpi-card label="Docentes" [value]="state().teachers.length || 'N/D'" delta="Directorio academico" tone="warning" />
        <agm-kpi-card label="Servicios online" [value]="onlineCount()" [delta]="state().health.length + ' servicios monitoreados'" [tone]="onlineCount() === state().health.length ? 'success' : 'danger'" />
      </section>

      <section class="grid-2" style="margin-top: 18px;">
        <agm-chart-card
          title="Actividad academica"
          subtitle="Materias por periodo activo o importado"
          [data]="subjectChart()"
        />
        <agm-chart-card
          title="Salud de servicios"
          subtitle="Latencia de health checks locales"
          [data]="healthChart()"
        />
      </section>

      <section class="grid-3" style="margin-top: 18px;">
        <article class="panel pad">
          <h2 class="panel-title">Acciones rapidas</h2>
          <div class="quick-actions">
            @for (action of quickActions(); track action.route) {
              <a [routerLink]="action.route">
                <strong>{{ action.label }}</strong>
                <span>{{ action.description }}</span>
              </a>
            }
          </div>
        </article>

        <article class="panel pad">
          <h2 class="panel-title">Eventos recientes</h2>
          @if (recentEvents().length) {
            <div class="metric-list">
              @for (event of recentEvents(); track event) {
                <div class="metric-row">
                  <span>{{ event }}</span>
                  <span class="status-badge info">REST</span>
                </div>
              }
            </div>
          } @else {
            <agm-empty-state title="Sin eventos" message="Cuando se importen datos o generen reportes se mostraran aqui." />
          }
        </article>

        <article class="panel pad">
          <h2 class="panel-title">Panorama por rol</h2>
          @if (roleStats().length) {
            <div class="metric-list">
              @for (item of roleStats(); track item.label) {
                <div>
                  <div class="metric-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                  <div class="progress"><span [style.--value]="item.percent + '%'"></span></div>
                </div>
              }
            </div>
          } @else {
            <p class="muted">Las estadisticas por rol apareceran cuando existan materias activas.</p>
          }
        </article>
      </section>
    }
  `,
  styles: [`
    .dashboard-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
      gap: 22px;
      align-items: stretch;
      margin-bottom: 18px;
      padding: 24px;
      border: 1px solid color-mix(in srgb, var(--agm-primary) 22%, var(--agm-border));
      border-radius: var(--agm-radius-lg);
      background:
        linear-gradient(135deg, rgba(244, 180, 0, 0.12), transparent 38%),
        linear-gradient(135deg, var(--agm-primary-strong), var(--agm-primary));
      color: white;
      box-shadow: var(--agm-shadow);
      overflow: hidden;
    }

    .dashboard-hero h2 {
      max-width: 760px;
      margin: 14px 0 10px;
      font-size: clamp(1.6rem, 3vw, 2.5rem);
      line-height: 1.08;
      letter-spacing: 0;
    }

    .dashboard-hero p {
      max-width: 760px;
      margin: 0;
      color: rgba(255, 255, 255, 0.76);
      line-height: 1.65;
    }

    .hero-rail {
      display: grid;
      gap: 12px;
    }

    .hero-rail div {
      display: grid;
      gap: 5px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: var(--agm-radius);
      background: rgba(255, 255, 255, 0.1);
    }

    .hero-rail span {
      color: rgba(255, 255, 255, 0.68);
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .hero-rail strong {
      font-size: 1.25rem;
      letter-spacing: 0;
    }

    .quick-actions {
      display: grid;
      gap: 10px;
    }

    .quick-actions a {
      display: grid;
      gap: 3px;
      padding: 12px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius-sm);
      background: var(--agm-surface-muted);
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }

    .quick-actions a:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--agm-secondary) 28%, var(--agm-border));
      box-shadow: var(--agm-shadow-soft);
    }

    .quick-actions span {
      color: var(--agm-text-soft);
      font-size: 0.84rem;
    }

    @media (max-width: 920px) {
      .dashboard-hero {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly periods = inject(PeriodsService);
  private readonly academics = inject(AcademicsService);
  private readonly health = inject(HealthService);
  private readonly reports = inject(ReportsService);

  readonly loading = signal(true);
  readonly state = signal<DashboardState>({
    periods: [],
    subjects: [],
    teachers: [],
    health: [],
    teacherStats: [],
    studentStats: []
  });

  readonly title = computed(() => {
    const user = this.auth.user();
    return user ? `Hola, ${user.display_name}` : 'Dashboard academico';
  });

  readonly description = computed(() => {
    const role = this.auth.role();
    if (role === 'docente') {
      return 'Controla ponderaciones, asistencias QR y reportes de tus materias desde una vista operacional.';
    }
    if (role === 'alumno') {
      return 'Consulta tus calificaciones, asistencias y reportes disponibles en el periodo activo.';
    }
    return 'Supervisa importaciones, materias, usuarios y disponibilidad de los siete microservicios AGM.';
  });

  readonly onlineCount = computed(() => this.state().health.filter((item) => item.status === 'online').length);
  readonly openSubjects = computed(() => this.state().subjects.filter((subject) => subject.estado === 'abierta').length);
  readonly activePeriodName = computed(() => this.state().periods.find((period) => period.activo)?.nombre ?? 'Sin periodo activo');

  readonly subjectChart = computed<ChartPoint[]>(() => {
    const grouped = new Map<number, number>();
    this.state().subjects.forEach((subject) => grouped.set(subject.period_id, (grouped.get(subject.period_id) ?? 0) + 1));
    if (!grouped.size) {
      return this.state().periods.map((period) => ({ label: period.nombre, value: 0 }));
    }
    return Array.from(grouped.entries()).map(([periodId, count]) => ({
      label: this.state().periods.find((period) => period.id === periodId)?.nombre ?? `Periodo ${periodId}`,
      value: count
    }));
  });

  readonly healthChart = computed<ChartPoint[]>(() => this.state().health.map((item) => ({
    label: item.name,
    value: item.status === 'online' ? Math.max(1, item.latencyMs ?? 1) : 0,
    color: item.status === 'online' ? 'var(--agm-primary)' : 'var(--agm-danger)'
  })));

  readonly recentEvents = computed(() => {
    const events: string[] = [];
    const active = this.state().periods.find((period) => period.activo);
    if (active) {
      events.push(`Periodo activo: ${active.nombre}`);
    }
    this.state().subjects.slice(0, 3).forEach((subject) => events.push(`${subject.nrc} - ${subject.nombre}`));
    return events;
  });

  readonly roleStats = computed(() => {
    if (this.auth.role() === 'docente') {
      return this.state().teacherStats.slice(0, 4).map((stat) => ({
        label: stat.materia,
        value: stat.promedio_grupal || 0,
        percent: Math.min(100, stat.aprobacion || 0)
      }));
    }
    if (this.auth.role() === 'alumno') {
      return this.state().studentStats.slice(0, 4).map((stat) => ({
        label: stat.materia,
        value: stat.promedio_actual || 0,
        percent: Math.min(100, stat.promedio_actual || 0)
      }));
    }
    return [
      { label: 'Servicios activos', value: this.onlineCount(), percent: this.state().health.length ? Math.round((this.onlineCount() / this.state().health.length) * 100) : 0 },
      { label: 'Materias abiertas', value: this.state().subjects.filter((subject) => subject.estado === 'abierta').length, percent: 70 }
    ];
  });

  roleLabel(): string {
    const role = this.auth.role();
    if (role === 'docente') {
      return 'Dashboard docente';
    }
    if (role === 'alumno') {
      return 'Dashboard alumno';
    }
    return 'Dashboard admin';
  }

  heroTitle(): string {
    const role = this.auth.role();
    if (role === 'docente') {
      return 'Tus materias, asistencias y evaluaciones en una sola cabina.';
    }
    if (role === 'alumno') {
      return 'Tu avance academico y asistencia siempre visibles.';
    }
    return 'Operacion academica y salud de microservicios bajo control.';
  }

  heroCopy(): string {
    const role = this.auth.role();
    if (role === 'docente') {
      return 'Abre sesiones QR, configura ponderaciones y descarga reportes sin salir del flujo docente.';
    }
    if (role === 'alumno') {
      return 'Consulta tus materias, genera QR para sesiones activas y revisa reportes disponibles.';
    }
    return 'Importaciones, periodos, materias, disponibilidad REST y modulos criticos permanecen visibles para demo y operacion.';
  }

  quickActions(): Array<{ label: string; description: string; route: string }> {
    const role = this.auth.role();
    if (role === 'docente') {
      return [
        { label: 'Capturar calificaciones', description: 'Ponderaciones, actividades y concentrados', route: '/grades' },
        { label: 'Abrir asistencia', description: 'Sesion QR con cierre controlado', route: '/attendance' },
        { label: 'Descargar reportes', description: 'PDF y XLSX por materia', route: '/reports' }
      ];
    }
    if (role === 'alumno') {
      return [
        { label: 'Ver calificaciones', description: 'Promedios y estado academico', route: '/grades' },
        { label: 'Generar QR', description: 'Asistencia para una sesion activa', route: '/attendance' },
        { label: 'Mis reportes', description: 'Descargas disponibles', route: '/reports' }
      ];
    }
    return [
      { label: 'Importar docentes', description: 'Directorio PDF', route: '/academics' },
      { label: 'Importar periodo', description: 'Programacion academica PDF', route: '/periods' },
      { label: 'Revisar salud', description: 'Todos los microservicios', route: '/system-health' }
    ];
  }

  ngOnInit(): void {
    const user = this.auth.user();
    const roleStats$ = user?.role === 'docente' && user.profile_id
      ? this.reports.teacherStats(user.profile_id).pipe(catchError(() => of([])))
      : of([]);
    const studentStats$ = user?.role === 'alumno' && user.profile_id
      ? this.reports.studentStats(user.profile_id).pipe(catchError(() => of([])))
      : of([]);

    forkJoin({
      periods: this.periods.listPeriods().pipe(catchError(() => of([]))),
      subjects: this.periods.listSubjects(undefined, 1, 100).pipe(catchError(() => of([]))),
      teachers: this.auth.role() === 'alumno' ? of([]) : this.academics.listTeachers().pipe(catchError(() => of([]))),
      health: this.health.checkAll(),
      teacherStats: roleStats$,
      studentStats: studentStats$
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      this.state.set(state);
      this.loading.set(false);
    });
  }
}
