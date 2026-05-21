import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { catchError, forkJoin, interval, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HealthService } from '../../core/services/health.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { PeriodsService } from '../../services/periods.service';
import { AcademicsService } from '../../services/academics.service';
import { GradesService } from '../../services/grades.service';
import { ReportsService } from '../../services/reports.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { HealthStatus } from '../../shared/models/api.models';
import { Period, Student, Subject, Teacher } from '../../shared/models/academic.models';
import { GradeSummary } from '../../shared/models/grade.models';
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

interface TeacherOverview {
  totalStudents: number;
  overallAverage: number;
  passRate: number;
  atRiskStudents: number;
  attendanceRate: number;
}

interface DashboardMetric {
  label: string;
  value: string | number;
  context: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

interface DashboardIntent {
  label: string;
  type: string;
  objective: string;
  cadence: string;
}

interface DashboardException {
  label: string;
  detail: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

@Component({
  selector: 'agm-dashboard-screen',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, LoadingSkeletonComponent],
  animations: [
    trigger('dashboardReveal', [
      transition(':enter', [
        query('.dashboard-card, .metric-tile, .dashboard-command', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(45, animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })))
        ], { optional: true })
      ])
    ])
  ],
  template: `
    <agm-page-header
      eyebrow="Panel"
      [title]="title()"
      [description]="description()"
    >
      <button class="btn ghost" type="button" (click)="refresh()">Actualizar</button>
      <a class="btn primary" routerLink="/reports">Exportar reportes</a>
      @if (isAdmin()) {
        <a class="btn ghost" routerLink="/system-health">Ver salud</a>
      }
    </agm-page-header>

    @if (loading()) {
      <agm-loading-skeleton [rows]="6" />
    } @else {
      <section class="few-dashboard" [class.admin]="isAdmin()" [class.teacher]="isTeacher()" [class.student]="isStudent()" @dashboardReveal>
        <header class="dashboard-command">
          <div>
            <span class="status-badge info">{{ dashboardIntent().type }}</span>
            <h2>{{ heroTitle() }}</h2>
            <p>{{ dashboardIntent().objective }}</p>
          </div>
          <div class="dashboard-meta" aria-label="Estado de actualizacion">
            <strong>{{ dashboardIntent().label }}</strong>
            <span>{{ dashboardIntent().cadence }}</span>
            <span class="sync-line">
              <span class="sync-dot" aria-hidden="true"></span>
              {{ lastUpdatedLabel() }}
            </span>
          </div>
        </header>

        <section class="signal-strip" aria-label="Indicadores principales">
          @for (metric of primaryMetrics(); track metric.label) {
            <article class="metric-tile" [class]="metric.tone">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
              <small>{{ metric.context }}</small>
            </article>
          }
        </section>

        <section class="dashboard-grid">
          <article class="dashboard-card exceptions-card">
            <div class="section-head">
              <span>Excepciones</span>
              <strong>{{ exceptions().length }}</strong>
            </div>
            @for (item of exceptions(); track item.label) {
              <div class="exception-row" [class]="item.tone">
                <span class="status-badge" [class]="item.tone">{{ item.label }}</span>
                <p>{{ item.detail }}</p>
              </div>
            } @empty {
              <div class="exception-row success">
                <span class="status-badge success">Sin alertas</span>
                <p>Los indicadores principales se mantienen dentro de rango.</p>
              </div>
            }
          </article>

          <article class="dashboard-card trend-card">
            <div class="section-head">
              <span>{{ trendTitle() }}</span>
              <strong>{{ trendValue() }}</strong>
            </div>
            <div class="compact-bars">
              @for (item of trendItems(); track item.label) {
                <div class="compact-bar">
                  <span>{{ item.label }}</span>
                  <div aria-hidden="true"><i [style.width.%]="item.percent"></i></div>
                  <strong>{{ item.value }}</strong>
                </div>
              } @empty {
                <p class="muted">Aun no hay datos suficientes para comparar.</p>
              }
            </div>
          </article>

          <article class="dashboard-card action-card">
            <div class="section-head">
              <span>Acciones</span>
              <strong>{{ quickActions().length }}</strong>
            </div>
            <div class="quick-actions">
              @for (action of quickActions(); track action.route) {
                <a [routerLink]="action.route" [class]="action.tone" [attr.aria-label]="action.label + ': ' + action.description">
                  <span class="action-code" aria-hidden="true">{{ action.code }}</span>
                  <strong>{{ action.label }}</strong>
                  <span>{{ action.description }}</span>
                </a>
              }
            </div>
          </article>

          <article class="dashboard-card focus-card">
            <div class="section-head">
              <span>{{ focusTitle() }}</span>
              <strong>{{ focusItems().length }}</strong>
            </div>
            <div class="focus-list">
              @for (item of focusItems(); track item.label) {
                <div>
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.detail }}</span>
                </div>
              } @empty {
                <p class="muted">{{ focusEmptyMessage() }}</p>
              }
            </div>
          </article>

          @if (isAdmin()) {
            <article class="dashboard-card service-card">
              <div class="section-head">
                <span>Servicios</span>
                <strong>{{ onlineCount() }}/{{ state().health.length }}</strong>
              </div>
              <div class="service-list">
                @for (service of state().health.slice(0, 7); track service.key) {
                  <div>
                    <span>{{ service.name }}</span>
                    <span class="status-badge" [class]="service.status === 'online' ? 'success' : 'danger'">{{ service.status }}</span>
                  </div>
                }
              </div>
            </article>
          } @else {
            <article class="dashboard-card guidance-card">
              <div class="section-head">
                <span>Siguiente mejor accion</span>
                <strong>{{ recommendation().priority }}</strong>
              </div>
              <p>{{ recommendation().detail }}</p>
              <a class="btn primary small" [routerLink]="recommendation().route">{{ recommendation().label }}</a>
            </article>
          }
        </section>
      </section>
    }
  `,
  styles: [`
    .few-dashboard {
      display: grid;
      gap: 14px;
      min-height: min(720px, calc(100vh - 166px));
    }

    .dashboard-command {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
      gap: 18px;
      align-items: stretch;
      padding: 20px;
      border: 1px solid color-mix(in srgb, var(--agm-primary) 22%, var(--agm-border));
      border-radius: var(--agm-radius-lg);
      color: white;
      background:
        linear-gradient(135deg, rgba(244, 180, 0, 0.11), transparent 36%),
        linear-gradient(135deg, var(--agm-hero-start), var(--agm-hero-end));
      box-shadow: var(--agm-shadow);
    }

    .dashboard-command h2 {
      max-width: 860px;
      margin: 10px 0 7px;
      font-size: clamp(1.45rem, 2.4vw, 2.2rem);
      line-height: 1.08;
      letter-spacing: 0;
    }

    .dashboard-command p {
      max-width: 880px;
      margin: 0;
      color: rgba(255, 255, 255, 0.76);
      line-height: 1.55;
    }

    .dashboard-meta {
      display: grid;
      align-content: center;
      gap: 6px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: var(--agm-radius);
      background: rgba(255, 255, 255, 0.1);
    }

    .dashboard-meta strong {
      font-size: 1rem;
    }

    .dashboard-meta span {
      color: rgba(255, 255, 255, 0.74);
      font-size: var(--agm-font-size-sm);
      font-weight: 750;
    }

    .signal-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .metric-tile,
    .dashboard-card {
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius);
      background: var(--agm-panel-bg);
      box-shadow: var(--agm-shadow-soft);
    }

    .metric-tile {
      display: grid;
      align-content: space-between;
      min-height: 116px;
      padding: 16px;
      border-left: 5px solid var(--tile-tone, var(--agm-primary));
    }

    .metric-tile span,
    .metric-tile small,
    .section-head span {
      color: var(--agm-text-soft);
      font-size: var(--agm-font-size-sm);
      font-weight: 800;
    }

    .metric-tile strong {
      margin: 8px 0 5px;
      color: var(--agm-text);
      font-size: clamp(1.75rem, 3.2vw, 2.55rem);
      line-height: 1;
      letter-spacing: 0;
    }

    .metric-tile.primary { --tile-tone: var(--agm-secondary); }
    .metric-tile.success { --tile-tone: var(--agm-success); }
    .metric-tile.warning { --tile-tone: var(--agm-warning); }
    .metric-tile.danger { --tile-tone: var(--agm-danger); }
    .metric-tile.neutral { --tile-tone: var(--agm-border-strong); }

    .dashboard-grid {
      display: grid;
      grid-template-columns: minmax(260px, 0.95fr) minmax(320px, 1.35fr) minmax(280px, 1fr);
      grid-template-areas:
        "exceptions trend actions"
        "focus focus side";
      gap: 12px;
      min-height: 0;
    }

    .dashboard-card {
      min-height: 0;
      padding: 16px;
      overflow: hidden;
    }

    .exceptions-card { grid-area: exceptions; }
    .trend-card { grid-area: trend; }
    .action-card { grid-area: actions; }
    .focus-card { grid-area: focus; }
    .service-card,
    .guidance-card { grid-area: side; }

    .section-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .section-head strong {
      color: var(--agm-text);
      font-size: 1.35rem;
      line-height: 1;
    }

    .exception-row {
      display: grid;
      gap: 7px;
      padding: 10px 0;
      border-top: 1px solid var(--agm-border);
    }

    .exception-row:first-of-type {
      border-top: 0;
      padding-top: 0;
    }

    .exception-row p,
    .guidance-card p {
      margin: 0;
      color: var(--agm-text-soft);
      line-height: 1.45;
      font-size: var(--agm-font-size-sm);
    }

    .compact-bars {
      display: grid;
      gap: 11px;
    }

    .compact-bar {
      display: grid;
      grid-template-columns: minmax(92px, 0.8fr) minmax(0, 1fr) 52px;
      gap: 10px;
      align-items: center;
      font-size: var(--agm-font-size-sm);
    }

    .compact-bar > span {
      color: var(--agm-text-soft);
      font-weight: 800;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .compact-bar > div {
      height: 9px;
      overflow: hidden;
      border-radius: var(--agm-radius-pill);
      background: var(--agm-chart-track);
    }

    .compact-bar i {
      display: block;
      height: 100%;
      min-width: 3px;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--agm-primary), var(--agm-accent));
    }

    .compact-bar strong {
      text-align: right;
    }

    .quick-actions {
      display: grid;
      gap: 9px;
    }

    .quick-actions a {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 2px 10px;
      align-items: center;
      padding: 11px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius-sm);
      background: var(--agm-surface-muted);
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }

    .quick-actions a:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--agm-secondary) 30%, var(--agm-border));
      box-shadow: var(--agm-shadow-soft);
    }

    .quick-actions > a > span:not(.action-code) {
      grid-column: 2;
      color: var(--agm-text-soft);
      font-size: var(--agm-font-size-xs);
      line-height: 1.35;
    }

    .action-code {
      grid-row: span 2;
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: var(--agm-radius-sm);
      color: var(--agm-primary);
      background: var(--agm-primary-soft);
      font-weight: 900;
    }

    .quick-actions a.warning .action-code {
      color: var(--agm-warning);
      background: var(--agm-warning-soft);
    }

    .quick-actions a.success .action-code {
      color: var(--agm-success);
      background: var(--agm-success-soft);
    }

    .quick-actions a.info .action-code {
      color: var(--agm-info);
      background: var(--agm-info-soft);
    }

    .focus-list,
    .service-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
    }

    .focus-list div,
    .service-list div {
      display: grid;
      gap: 3px;
      padding: 10px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius-sm);
      background: var(--agm-surface-muted);
    }

    .focus-list span,
    .service-list span:first-child {
      color: var(--agm-text-soft);
      font-size: var(--agm-font-size-xs);
      line-height: 1.35;
    }

    .service-list {
      grid-template-columns: 1fr;
    }

    .service-list div {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }

    .guidance-card {
      display: grid;
      align-content: space-between;
      gap: 12px;
    }

    @media (min-width: 1181px) {
      .few-dashboard {
        max-height: calc(100vh - 150px);
      }
    }

    @media (max-width: 1180px) {
      .signal-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dashboard-grid {
        grid-template-columns: 1fr 1fr;
        grid-template-areas:
          "exceptions trend"
          "actions actions"
          "focus side";
      }
    }

    @media (max-width: 760px) {
      .dashboard-command,
      .signal-strip,
      .dashboard-grid,
      .focus-list {
        grid-template-columns: 1fr;
      }

      .dashboard-grid {
        grid-template-areas:
          "exceptions"
          "trend"
          "actions"
          "focus"
          "side";
      }
    }
  `]
})
export class DashboardScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly periods = inject(PeriodsService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly academics = inject(AcademicsService);
  private readonly grades = inject(GradesService);
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
  readonly teacherOverview = signal<TeacherOverview>({
    totalStudents: 0,
    overallAverage: 0,
    passRate: 0,
    atRiskStudents: 0,
    attendanceRate: 0
  });
  readonly lastUpdatedAt = signal<Date | null>(null);

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
  readonly subjectsWithSessions = computed(() => this.state().teacherStats.filter((stat) => stat.sesiones > 0).length);

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

  isAdmin(): boolean {
    return this.auth.role() === 'admin';
  }

  isTeacher(): boolean {
    return this.auth.role() === 'docente';
  }

  isStudent(): boolean {
    return this.auth.role() === 'alumno';
  }

  dashboardIntent(): DashboardIntent {
    if (this.isAdmin()) {
      return {
        label: 'Vista estratégica',
        type: 'Estratégico',
        objective: 'Responder de un vistazo si la operación académica está cubierta, activa y sin fallas críticas.',
        cadence: 'Resumen institucional'
      };
    }
    if (this.isTeacher()) {
      return {
        label: 'Vista operativa',
        type: 'Operativo + analítico',
        objective: 'Priorizar clases, asistencia, captura de calificaciones y alumnos que requieren seguimiento.',
        cadence: 'Sincronización cada 30 s'
      };
    }
    return {
      label: 'Vista personal',
      type: 'Descriptivo',
      objective: 'Mostrar progreso académico, materias visibles y acciones personales sin información administrativa.',
      cadence: 'Sincronización cada 30 s'
    };
  }

  primaryMetrics(): DashboardMetric[] {
    if (this.isAdmin()) {
      const totalServices = this.state().health.length;
      return [
        { label: 'Periodos', value: this.state().periods.length, context: 'Ciclos registrados', tone: this.state().periods.length ? 'primary' : 'warning' },
        { label: 'Materias', value: this.state().subjects.length, context: `${this.openSubjects()} abiertas`, tone: this.state().subjects.length ? 'success' : 'warning' },
        { label: 'Docentes', value: this.state().teachers.length || 'N/D', context: 'Directorio académico', tone: this.state().teachers.length ? 'primary' : 'warning' },
        { label: 'Servicios', value: totalServices ? `${this.onlineCount()}/${totalServices}` : 'N/D', context: 'Microservicios online', tone: totalServices && this.onlineCount() !== totalServices ? 'danger' : 'success' }
      ];
    }

    if (this.isTeacher()) {
      const overview = this.teacherOverview();
      return [
        { label: 'Alumnos', value: overview.totalStudents, context: 'En tus materias', tone: overview.totalStudents ? 'primary' : 'warning' },
        { label: 'Promedio', value: overview.overallAverage, context: 'General ponderado', tone: overview.overallAverage >= 70 ? 'success' : 'warning' },
        { label: 'Aprobación', value: `${overview.passRate}%`, context: 'Alumnos sobre umbral', tone: overview.passRate >= 70 ? 'success' : 'warning' },
        { label: 'En riesgo', value: overview.atRiskStudents, context: 'Requieren seguimiento', tone: overview.atRiskStudents ? 'danger' : 'success' }
      ];
    }

    const stats = this.state().studentStats;
    const average = stats.length
      ? Math.round((stats.reduce((sum, item) => sum + (item.promedio_actual || 0), 0) / stats.length) * 10) / 10
      : 0;
    const attendanceCount = stats.reduce((sum, item) => sum + (item.asistencias || 0), 0);
    return [
      { label: 'Materias', value: this.state().subjects.length, context: 'Inscritas o visibles', tone: this.state().subjects.length ? 'primary' : 'warning' },
      { label: 'Promedio', value: average || 'N/D', context: 'Actual reportado', tone: average >= 70 ? 'success' : average ? 'danger' : 'neutral' },
      { label: 'Asistencias', value: attendanceCount, context: 'Registros acumulados', tone: attendanceCount ? 'success' : 'warning' },
      { label: 'Reportes', value: stats.length, context: 'Materias con estadística', tone: stats.length ? 'primary' : 'neutral' }
    ];
  }

  exceptions(): DashboardException[] {
    const items: DashboardException[] = [];
    if (this.isAdmin()) {
      const offline = this.state().health.filter((item) => item.status !== 'online');
      if (offline.length) {
        items.push({ label: 'Servicios', detail: `${offline.length} microservicio(s) requieren revisión.`, tone: 'danger' });
      }
      if (!this.state().periods.some((period) => period.activo)) {
        items.push({ label: 'Periodo', detail: 'No hay periodo activo detectado para reportes y materias.', tone: 'warning' });
      }
      if (!this.state().subjects.length) {
        items.push({ label: 'Materias', detail: 'Aún no hay materias importadas o visibles.', tone: 'warning' });
      }
      return items;
    }

    if (this.isTeacher()) {
      const overview = this.teacherOverview();
      if (!this.state().subjects.length) {
        items.push({ label: 'Asignación', detail: 'No hay materias asignadas a tu perfil.', tone: 'warning' });
      }
      if (overview.atRiskStudents) {
        items.push({ label: 'Riesgo', detail: `${overview.atRiskStudents} alumno(s) por debajo del umbral.`, tone: 'danger' });
      }
      if (overview.attendanceRate && overview.attendanceRate < 80) {
        items.push({ label: 'Asistencia', detail: `Asistencia global en ${overview.attendanceRate}%, debajo del objetivo.`, tone: 'warning' });
      }
      return items;
    }

    const low = this.state().studentStats.filter((item) => item.promedio_actual && item.promedio_actual < 70);
    if (low.length) {
      items.push({ label: 'Calificaciones', detail: `${low.length} materia(s) requieren atención académica.`, tone: 'danger' });
    }
    if (!this.state().studentStats.length) {
      items.push({ label: 'Datos', detail: 'Aún no hay estadísticas personales disponibles.', tone: 'info' });
    }
    return items;
  }

  trendTitle(): string {
    if (this.isAdmin()) {
      return 'Distribución académica';
    }
    if (this.isTeacher()) {
      return 'Rendimiento por materia';
    }
    return 'Avance personal';
  }

  trendValue(): string | number {
    if (this.isAdmin()) {
      return this.state().subjects.length;
    }
    if (this.isTeacher()) {
      return `${this.teacherOverview().passRate}%`;
    }
    return this.state().studentStats.length;
  }

  trendItems(): Array<{ label: string; value: string | number; percent: number }> {
    if (this.isAdmin()) {
      const points = this.subjectChart();
      const max = Math.max(1, ...points.map((item) => item.value));
      return points.slice(0, 5).map((item) => ({ label: item.label, value: item.value, percent: Math.round((item.value / max) * 100) }));
    }
    if (this.isTeacher()) {
      return this.state().teacherStats.slice(0, 5).map((item) => ({
        label: item.materia,
        value: item.promedio_grupal || 0,
        percent: Math.min(100, Math.round(item.aprobacion || 0))
      }));
    }
    return this.state().studentStats.slice(0, 5).map((item) => ({
      label: item.materia,
      value: item.promedio_actual || 0,
      percent: Math.min(100, Math.round(item.promedio_actual || 0))
    }));
  }

  focusTitle(): string {
    if (this.isAdmin()) {
      return 'Foco institucional';
    }
    if (this.isTeacher()) {
      return 'Grupos asignados';
    }
    return 'Materias visibles';
  }

  focusItems(): Array<{ label: string; detail: string }> {
    if (this.isAdmin()) {
      return this.state().periods.slice(0, 4).map((period) => ({
        label: period.nombre,
        detail: `${period.activo ? 'Activo' : 'Registrado'} | ${period.plan_estudios}`
      }));
    }
    return this.state().subjects.slice(0, 4).map((subject) => ({
      label: subject.nombre,
      detail: `${subject.nrc} | ${subject.seccion} | ${subject.salon || 'Salón pendiente'}`
    }));
  }

  focusEmptyMessage(): string {
    if (this.isAdmin()) {
      return 'Importa o crea periodos para activar el seguimiento institucional.';
    }
    return 'Cuando existan materias visibles para tu rol, aparecerán aquí.';
  }

  recommendation(): { priority: string; detail: string; label: string; route: string } {
    if (this.isTeacher()) {
      if (this.teacherOverview().atRiskStudents) {
        return { priority: 'Alta', detail: 'Revisa calificaciones y alumnos con riesgo antes de cerrar la semana.', label: 'Ir a calificaciones', route: '/grades' };
      }
      return { priority: 'Media', detail: 'Mantén asistencia QR y reportes al día para tus grupos activos.', label: 'Abrir asistencia', route: '/attendance' };
    }
    if (this.exceptions().length) {
      return { priority: 'Alta', detail: 'Revisa los indicadores marcados antes de continuar.', label: 'Ver detalle', route: '/grades' };
    }
    return { priority: 'Normal', detail: 'Consulta tus reportes disponibles o genera QR cuando el docente abra sesión.', label: 'Mis reportes', route: '/reports' };
  }

  refresh(): void {
    this.loadDashboard(false);
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

  lastUpdatedLabel(): string {
    const value = this.lastUpdatedAt();
    return value ? `Actualizado ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sincronizando...';
  }

  quickActions(): Array<{ label: string; description: string; route: string; code: string; tone: 'primary' | 'success' | 'warning' | 'info' }> {
    const role = this.auth.role();
    if (role === 'docente') {
      return [
        { label: 'Capturar calificaciones', description: 'Ponderaciones, actividades y concentrados', route: '/grades', code: 'C', tone: 'primary' },
        { label: 'Abrir asistencia', description: 'Sesion QR con cierre controlado', route: '/attendance', code: 'Q', tone: 'success' },
        { label: 'Descargar reportes', description: 'PDF y XLSX por materia', route: '/reports', code: 'R', tone: 'warning' },
        { label: 'Gestionar grupos', description: 'Alumnos inscritos y materias', route: '/academics', code: 'G', tone: 'info' }
      ];
    }
    if (role === 'alumno') {
      return [
        { label: 'Ver calificaciones', description: 'Promedios y estado academico', route: '/grades', code: 'C', tone: 'primary' },
        { label: 'Generar QR', description: 'Asistencia para una sesion activa', route: '/attendance', code: 'Q', tone: 'success' },
        { label: 'Mis reportes', description: 'Descargas disponibles', route: '/reports', code: 'R', tone: 'warning' }
      ];
    }
    return [
      { label: 'Importar docentes', description: 'Directorio PDF', route: '/academics', code: 'D', tone: 'primary' },
      { label: 'Importar periodo', description: 'Programacion academica PDF', route: '/periods', code: 'P', tone: 'success' },
      { label: 'Revisar salud', description: 'Todos los microservicios', route: '/system-health', code: 'S', tone: 'warning' }
    ];
  }

  ngOnInit(): void {
    this.loadDashboard(true);
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadDashboard(false));
  }

  private loadDashboard(initialLoad: boolean): void {
    const user = this.auth.user();
    const roleStats$ = user?.role === 'docente' && user.profile_id
      ? this.reports.teacherStats(user.profile_id).pipe(catchError(() => of([])))
      : of([]);
    const studentStats$ = user?.role === 'alumno' && user.profile_id
      ? this.reports.studentStats(user.profile_id).pipe(catchError(() => of([])))
      : of([]);

    forkJoin({
      periods: this.periods.listPeriods().pipe(catchError(() => of([]))),
      subjects: this.subjectScope.listVisibleSubjects().pipe(catchError(() => of([]))),
      teachers: this.auth.role() === 'alumno' ? of([]) : this.academics.listTeachers().pipe(catchError(() => of([]))),
      health: this.isAdmin() ? this.health.checkAll() : of([]),
      teacherStats: roleStats$,
      studentStats: studentStats$
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      this.state.set(state);
      if (user?.role === 'docente') {
        this.loadTeacherOverview(state.subjects, state.teacherStats);
      }
      this.lastUpdatedAt.set(new Date());
      if (initialLoad) {
        this.loading.set(false);
      }
    });
  }

  private loadTeacherOverview(subjects: Subject[], stats: TeacherStats[]): void {
    if (!subjects.length) {
      this.teacherOverview.set({
        totalStudents: 0,
        overallAverage: 0,
        passRate: 0,
        atRiskStudents: 0,
        attendanceRate: 0
      });
      return;
    }

    forkJoin(subjects.map((subject) => forkJoin({
      subject: of(subject),
      students: this.academics.listStudentsBySubject(subject.id).pipe(catchError(() => of([] as Student[]))),
      summary: this.grades.getConcentrado(subject.id).pipe(catchError(() => of([] as GradeSummary[])))
    }))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((packs) => {
      const uniqueStudentIds = new Set(packs.flatMap((pack) => pack.students.map((student) => student.id)));
      const gradeRows = packs.flatMap((pack) => pack.summary);
      const atRiskStudentIds = new Set(gradeRows.filter((row) => row.promedio_redondeado < 70).map((row) => row.alumno_id));
      const overallAverage = gradeRows.length
        ? Math.round((gradeRows.reduce((sum, row) => sum + row.promedio_real, 0) / gradeRows.length) * 10) / 10
        : 0;
      const passRate = gradeRows.length
        ? Math.round((gradeRows.filter((row) => row.promedio_redondeado >= 70).length / gradeRows.length) * 100)
        : 0;
      const attendanceSlots = packs.reduce((sum, pack) => {
        const sessions = stats.find((stat) => stat.materia_id === pack.subject.id)?.sesiones ?? 0;
        return sum + (sessions * pack.students.length);
      }, 0);
      const attendedSlots = stats.reduce((sum, stat) => sum + stat.asistencias + stat.retardos, 0);
      const attendanceRate = attendanceSlots
        ? Math.min(100, Math.round((attendedSlots / attendanceSlots) * 100))
        : 0;

      this.teacherOverview.set({
        totalStudents: uniqueStudentIds.size,
        overallAverage,
        passRate,
        atRiskStudents: atRiskStudentIds.size,
        attendanceRate
      });
    });
  }
}
