import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
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
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
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
      @if (isAdmin()) {
        <a class="btn ghost" routerLink="/system-health">Ver salud</a>
      }
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
          @if (isAdmin()) {
            <div>
              <span>Servicios REST</span>
              <strong>{{ onlineCount() }}/{{ state().health.length }}</strong>
            </div>
          }
          <div>
            <span>Materias abiertas</span>
            <strong>{{ openSubjects() }}</strong>
          </div>
        </div>
      </section>

      @if (isTeacher()) {
        <section class="teacher-kpis">
          <agm-kpi-card label="Alumnos" [value]="teacherOverview().totalStudents" delta="Inscritos en tus materias" tone="primary" />
          <agm-kpi-card label="Promedio general" [value]="teacherOverview().overallAverage" [tone]="teacherOverview().overallAverage >= 70 ? 'success' : 'warning'" />
          <agm-kpi-card label="Aprobacion" [value]="teacherOverview().passRate + '%'" [tone]="teacherOverview().passRate >= 70 ? 'success' : 'warning'" />
          <agm-kpi-card label="En riesgo" [value]="teacherOverview().atRiskStudents" [tone]="teacherOverview().atRiskStudents ? 'danger' : 'success'" />
          <agm-kpi-card label="Asistencia" [value]="teacherOverview().attendanceRate + '%'" [tone]="teacherOverview().attendanceRate >= 80 ? 'success' : 'warning'" />
        </section>
      } @else if (isAdmin()) {
        <section class="grid-4">
          <agm-kpi-card label="Periodos" [value]="state().periods.length" delta="Ciclos registrados" tone="primary" />
          <agm-kpi-card label="Materias" [value]="state().subjects.length" delta="Visibles para tu rol" tone="success" />
          <agm-kpi-card label="Docentes" [value]="state().teachers.length || 'N/D'" delta="Directorio academico" tone="warning" />
          <agm-kpi-card label="Servicios online" [value]="onlineCount()" [delta]="state().health.length + ' servicios monitoreados'" [tone]="onlineCount() === state().health.length ? 'success' : 'danger'" />
        </section>
      } @else {
        <section class="grid-3">
          <agm-kpi-card label="Materias" [value]="state().subjects.length" delta="Visibles para tu rol" tone="primary" />
          <agm-kpi-card label="Periodo activo" [value]="activePeriodName()" tone="neutral" />
          <agm-kpi-card label="Reportes" [value]="state().studentStats.length" delta="Materias con estadisticas" tone="success" />
        </section>
      }

      <section class="grid-2" style="margin-top: 18px;">
        <agm-chart-card
          title="Actividad academica"
          subtitle="Materias por periodo activo o importado"
          [data]="subjectChart()"
        />
        @if (isAdmin()) {
          <agm-chart-card
            title="Salud de servicios"
            subtitle="Latencia de health checks locales"
            [data]="healthChart()"
          />
        } @else {
          <article class="panel pad sync-panel">
            <div class="row between wrap">
              <div>
                <h2 class="panel-title">Actualizacion</h2>
                <p class="muted">El panel se sincroniza automaticamente cada 30 segundos.</p>
              </div>
              <span class="sync-line">
                <span class="sync-dot" aria-hidden="true"></span>
                {{ lastUpdatedLabel() }}
              </span>
            </div>
          </article>
        }
      </section>

      <section class="grid-3" style="margin-top: 18px;">
        <article class="panel pad">
          <h2 class="panel-title">Acciones rapidas</h2>
          <div class="quick-actions">
            @for (action of quickActions(); track action.route) {
              <a [routerLink]="action.route" [class]="action.tone">
                <span class="action-code" aria-hidden="true">{{ action.code }}</span>
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

      @if (isTeacher()) {
        <section class="grid-2 teacher-grid" style="margin-top: 18px;">
          <article class="panel pad">
            <div class="row between">
              <h2 class="panel-title">Materias asignadas</h2>
              <a class="btn ghost small" routerLink="/academics">Ver grupos</a>
            </div>
            @if (state().subjects.length) {
              <div class="subject-list">
                @for (subject of state().subjects; track subject.id) {
                  <div class="subject-row">
                    <div>
                      <strong>{{ subject.nombre }}</strong>
                      <span>{{ subject.nrc }} | {{ subject.seccion }} | {{ subject.salon || 'Salon pendiente' }}</span>
                    </div>
                    <span class="status-badge" [class]="subject.estado === 'abierta' ? 'success' : 'neutral'">{{ subject.estado }}</span>
                  </div>
                }
              </div>
            } @else {
              <agm-empty-state title="Sin materias asignadas" message="Cuando exista asignacion docente, apareceran aqui tus grupos activos." />
            }
          </article>

          <article class="panel pad">
            <h2 class="panel-title">Lectura rapida</h2>
            <div class="metric-list">
              <div class="metric-row"><span>Materias activas</span><strong>{{ openSubjects() }}</strong></div>
              <div class="metric-row"><span>Materias con sesiones</span><strong>{{ subjectsWithSessions() }}</strong></div>
              <div class="metric-row"><span>Promedio ponderado</span><strong>{{ teacherOverview().overallAverage }}</strong></div>
              <div class="metric-row"><span>Alumnos con seguimiento</span><strong>{{ teacherOverview().atRiskStudents }}</strong></div>
            </div>
          </article>
        </section>
      }
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
        linear-gradient(135deg, var(--agm-hero-start), var(--agm-hero-end));
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
      grid-template-columns: auto minmax(0, 1fr);
      gap: 3px 12px;
      padding: 14px;
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

    .quick-actions > a > span:not(.action-code) {
      grid-column: 2;
      color: var(--agm-text-soft);
      font-size: 0.84rem;
    }

    .quick-actions strong {
      align-self: end;
    }

    .action-code {
      grid-row: span 2;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: var(--agm-radius-sm);
      background: color-mix(in srgb, var(--agm-primary) 12%, transparent);
      color: var(--agm-primary);
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

    .sync-panel {
      display: grid;
      align-content: center;
    }

    .teacher-kpis {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 16px;
    }

    .subject-list {
      display: grid;
      gap: 10px;
    }

    .subject-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 13px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius-sm);
      background: var(--agm-surface-muted);
    }

    .subject-row strong,
    .subject-row span {
      display: block;
    }

    .subject-row span:not(.status-badge) {
      margin-top: 3px;
      color: var(--agm-text-soft);
      font-size: 0.84rem;
    }

    @media (max-width: 920px) {
      .dashboard-hero {
        grid-template-columns: 1fr;
      }

      .teacher-kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .teacher-kpis {
        grid-template-columns: 1fr;
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
