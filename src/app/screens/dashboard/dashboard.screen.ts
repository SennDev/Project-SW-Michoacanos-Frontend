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
  templateUrl: './dashboard.screen.html',
  styleUrl: './dashboard.screen.scss',
  animations: [
    trigger('dashboardReveal', [
      transition(':enter', [
        query('.dashboard-command, .subject-filter-bar, .metric-tile, .dashboard-card', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger(35, animate('250ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' })))
        ], { optional: true })
      ])
    ])
  ]
})
export class DashboardScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  public readonly auth = inject(AuthService);
  private readonly periods = inject(PeriodsService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly academics = inject(AcademicsService);
  private readonly grades = inject(GradesService);
  private readonly health = inject(HealthService);
  private readonly reports = inject(ReportsService);

  readonly loading = signal(true);
  readonly state = signal<DashboardState>({ periods: [], subjects: [], teachers: [], health: [], teacherStats: [], studentStats: [] });
  readonly teacherOverview = signal<TeacherOverview>({ totalStudents: 0, overallAverage: 0, passRate: 0, atRiskStudents: 0 });
  readonly lastUpdatedAt = signal<Date | null>(null);

  // --- FILTRO DE MATERIAS (Nuevo requerimiento de calidad) ---
  readonly selectedSubjectId = signal<number | null>(null);

  selectSubject(id: number | null): void {
    this.selectedSubjectId.set(id);
  }

  // --- IDENTIDAD ---
  readonly title = computed(() => {
    const user = this.auth.user();
    return user ? `Hola, ${user.display_name}` : 'Dashboard Institucional';
  });

  readonly activePeriodName = computed(() => this.state().periods.find((p) => p.activo)?.nombre ?? 'Sin semestre activo');
  readonly onlineCount = computed(() => this.state().health.filter((item) => item.status === 'online').length);

  // --- EVALUADORES DE ROL ---
  isAdmin(): boolean { return this.auth.role() === 'admin'; }
  isTeacher(): boolean { return this.auth.role() === 'docente'; }
  isStudent(): boolean { return this.auth.role() === 'alumno'; }

  // --- INTENCIONES ---
  dashboardIntent(): DashboardIntent {
    if (this.isAdmin()) return { label: 'Administración', type: 'Estratégico', objective: 'Supervisión del ecosistema y operaciones.', cadence: 'Auto-sincronización (1m)' };
    if (this.isTeacher()) return { label: 'Operativo', type: 'Analítico', objective: 'Monitoreo de grupos y evaluaciones en curso.', cadence: 'Auto-sincronización (1m)' };
    return { label: 'Estudiante', type: 'Descriptivo', objective: 'Resumen de desempeño académico y asistencias.', cadence: 'Auto-sincronización (1m)' };
  }

  // --- MÉTRICAS OPTIMIZADAS (Cero Redundancia y Sensibles al Filtro) ---
  primaryMetrics(): DashboardMetric[] {
    const sel = this.selectedSubjectId();

    // ADMIN: Sin redundancia de red (eso va en la tarjeta de nodos)
    if (this.isAdmin()) {
      return [
        { label: 'Semestres Activos', value: this.state().periods.filter(p => p.activo).length, context: 'En operación', tone: 'success' },
        { label: 'Semestres Totales', value: this.state().periods.length, context: 'Registrados en BD', tone: 'neutral' },
        { label: 'Materias Base', value: this.state().subjects.length, context: 'Catálogo institucional', tone: 'primary' },
        { label: 'Plantilla Docente', value: this.state().teachers.length, context: 'Usuarios activos', tone: 'neutral' }
      ];
    }

    // DOCENTE: Cambia según si ve todo o una materia específica
    if (this.isTeacher()) {
      if (sel) {
        const stat = this.state().teacherStats.find(s => s.materia_id === sel);
        return [
          { label: 'Promedio del Grupo', value: stat?.promedio_grupal || 'N/D', context: 'Materia seleccionada', tone: 'primary' },
          { label: 'Aprobación', value: stat ? `${stat.aprobacion}%` : 'N/D', context: 'Índice de éxito', tone: stat && stat.aprobacion >= 70 ? 'success' : 'warning' },
          { label: 'Sesiones Totales', value: stat?.sesiones || 0, context: 'Clases registradas', tone: 'neutral' }
        ];
      } else {
        const overview = this.teacherOverview();
        return [
          { label: 'Total Alumnos', value: overview.totalStudents, context: 'Matrícula a tu cargo', tone: 'primary' },
          { label: 'Promedio Global', value: overview.overallAverage, context: 'De todas tus materias', tone: overview.overallAverage >= 70 ? 'success' : 'warning' },
          { label: 'Aprobación Global', value: `${overview.passRate}%`, context: 'Alumnos regulares', tone: overview.passRate >= 70 ? 'success' : 'warning' },
          { label: 'En Riesgo', value: overview.atRiskStudents, context: 'Requieren atención', tone: overview.atRiskStudents ? 'danger' : 'success' }
        ];
      }
    }

    // ALUMNO: Cambia según si ve todo o una materia específica
    if (sel) {
      const stat = this.state().studentStats.find(s => s.materia_id === sel);
      return [
        { label: 'Mi Promedio', value: stat?.promedio_actual || 'N/D', context: 'Materia seleccionada', tone: stat && stat.promedio_actual >= 70 ? 'success' : 'danger' },
        { label: 'Asistencias', value: stat?.asistencias || 0, context: 'Registros válidos', tone: 'success' },
        { label: 'Faltas', value: stat?.faltas || 0, context: 'Inasistencias', tone: 'warning' }
      ];
    } else {
      const stats = this.state().studentStats;
      const avg = stats.length ? (stats.reduce((sum, item) => sum + (item.promedio_actual || 0), 0) / stats.length).toFixed(1) : 'N/D';
      const totalAsistencias = stats.reduce((sum, item) => sum + (item.asistencias || 0), 0);
      return [
        { label: 'Promedio Semestral', value: avg, context: 'Rendimiento general', tone: Number(avg) >= 7.0 ? 'success' : 'danger' },
        { label: 'Asistencias Acumuladas', value: totalAsistencias, context: 'Todas las materias', tone: 'success' },
        { label: 'Materias Inscritas', value: this.state().subjects.length, context: 'Carga académica', tone: 'primary' }
      ];
    }
  }

  // --- GRÁFICA DE PASTEL (Sensible al Filtro y Nula para Admin) ---
  readonly pieChartData = computed(() => {
    if (this.isAdmin()) return null; // Eliminada redundancia para admin

    const sel = this.selectedSubjectId();

    if (this.isTeacher()) {
      const stats = sel ? this.state().teacherStats.filter(s => s.materia_id === sel) : this.state().teacherStats;
      const asist = stats.reduce((sum, s) => sum + (s.asistencias || 0), 0);
      const retar = stats.reduce((sum, s) => sum + (s.retardos || 0), 0);
      const total = (asist + retar) || 1;
      const p1 = Math.round((asist / total) * 100);
      return {
        title: sel ? 'Asistencia del Grupo' : 'Asistencia Global',
        labels: ['Puntual', 'Retardos'], values: [asist, retar],
        colors: ['var(--agm-success)', 'var(--agm-warning)'],
        gradient: `conic-gradient(var(--agm-success) 0% ${p1}%, var(--agm-warning) ${p1}% 100%)`
      };
    }

    // Alumno
    const stats = sel ? this.state().studentStats.filter(s => s.materia_id === sel) : this.state().studentStats;
    const pass = stats.filter(s => (s.promedio_actual || 0) >= 70).length;
    const fail = stats.length - pass;
    const total = stats.length || 1;
    const p1 = Math.round((pass / total) * 100);
    return {
      title: sel ? 'Estatus de la Materia' : 'Balance Semestral',
      labels: ['Aprobado', 'En Riesgo'], values: [pass, fail],
      colors: ['var(--agm-success)', 'var(--agm-danger)'],
      gradient: `conic-gradient(var(--agm-success) 0% ${p1}%, var(--agm-danger) ${p1}% 100%)`
    };
  });

  // --- EXCEPCIONES Y ALERTAS ---
  exceptions(): DashboardException[] {
    let items: DashboardException[] = [];
    const sel = this.selectedSubjectId();

    if (this.isAdmin()) {
      const offline = this.state().health.filter(i => i.status !== 'online');
      if (offline.length) items.push({ label: 'Infraestructura', detail: `${offline.length} microservicio(s) sin conexión.`, tone: 'danger' });
      if (!this.state().periods.some(p => p.activo)) items.push({ label: 'Periodo', detail: 'No hay semestre activo detectado.', tone: 'warning' });
    } else if (this.isTeacher()) {
      if (!sel) {
        const overview = this.teacherOverview();
        if (overview.atRiskStudents) items.push({ label: 'Riesgo Académico', detail: `${overview.atRiskStudents} alumno(s) por debajo del umbral de aprobación.`, tone: 'danger' });
      } else {
        const stat = this.state().teacherStats.find(s => s.materia_id === sel);
        if (stat && stat.aprobacion < 70) items.push({ label: 'Alerta de Grupo', detail: 'El índice de aprobación es menor al 70%.', tone: 'warning' });
      }
    } else {
      const stats = sel ? this.state().studentStats.filter(s => s.materia_id === sel) : this.state().studentStats;
      const low = stats.filter(i => i.promedio_actual && i.promedio_actual < 70);
      if (low.length) items.push({ label: 'Calificaciones', detail: `${low.length} materia(s) en riesgo académico.`, tone: 'danger' });
    }
    return items.slice(0, 3);
  }

  // --- LISTAS DE CONTEXTO ---
  focusTitle(): string {
    if (this.isAdmin()) return 'Directorio Reciente';
    return this.selectedSubjectId() ? 'Detalles de Asignatura' : 'Materias Asignadas';
  }

  focusItems(): Array<{ label: string; detail: string }> {
    if (this.isAdmin()) {
      return this.state().teachers.slice(0, 4).map(t => ({ label: t.nombre, detail: t.email }));
    }
    const sel = this.selectedSubjectId();
    if (this.isTeacher()) {
      const subjects = sel ? this.state().subjects.filter(s => s.id === sel) : this.state().subjects;
      return subjects.slice(0, 4).map(s => ({ label: s.nombre, detail: `NRC: ${s.nrc} | Salón: ${s.salon || 'N/D'}` }));
    }
    const stats = sel ? this.state().studentStats.filter(s => s.materia_id === sel) : this.state().studentStats;
    return stats.slice(0, 4).map(stat => ({ label: stat.materia, detail: `Promedio: ${stat.promedio_actual || 0} | Faltas: ${stat.faltas || 0}` }));
  }

  recommendation(): { priority: string; detail: string; label: string; route: string } {
    if (this.isTeacher()) {
      if (this.teacherOverview().atRiskStudents) return { priority: 'Alta', detail: 'Revisa las calificaciones y alerta a los alumnos en riesgo.', label: 'Ir a Calificaciones', route: '/grades' };
      return { priority: 'Media', detail: 'Mantén el pase de lista actualizado.', label: 'Abrir Asistencia', route: '/attendance' };
    }
    if (this.exceptions().length) return { priority: 'Alta', detail: 'Identifica las materias en riesgo en tu boleta.', label: 'Ver Boleta', route: '/grades' };
    return { priority: 'Normal', detail: 'Genera tu código QR para el próximo pase de lista.', label: 'Generar QR', route: '/attendance' };
  }

  heroTitle(): string { return this.isTeacher() ? 'Operación Docente' : this.isStudent() ? 'Resumen Semestral' : 'Mando Central'; }
  lastUpdatedLabel(): string { return this.lastUpdatedAt() ? `Sincronizado ${this.lastUpdatedAt()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '...'; }

  quickActions() {
    const role = this.auth.role();
    if (role === 'docente') return [
      { label: 'Calificaciones', description: 'Registro y avance', route: '/grades', code: 'C', tone: 'primary' },
      { label: 'Pase de Lista', description: 'Generar sesión QR', route: '/attendance', code: 'Q', tone: 'success' },
      { label: 'Grupos', description: 'Lista de inscritos', route: '/academics', code: 'G', tone: 'info' }
    ];
    if (role === 'alumno') return [
      { label: 'Mi Boleta', description: 'Promedios y estado', route: '/grades', code: 'B', tone: 'primary' },
      { label: 'Escanear QR', description: 'Registrar asistencia', route: '/attendance', code: 'Q', tone: 'success' },
      { label: 'Descargas', description: 'Reportes en PDF', route: '/reports', code: 'R', tone: 'warning' }
    ];
    return [
      { label: 'Docentes', description: 'Gestión de perfiles', route: '/academics', code: 'D', tone: 'primary' },
      { label: 'Semestres', description: 'Apertura y cierres', route: '/periods', code: 'P', tone: 'success' },
      { label: 'Monitoreo', description: 'Logs del sistema', route: '/system-health', code: 'S', tone: 'warning' }
    ];
  }

  ngOnInit(): void {
    this.loadDashboard(true);
    interval(60_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadDashboard(false));
  }

  private loadDashboard(initialLoad: boolean): void {
    const user = this.auth.user();
    forkJoin({
      periods: this.periods.listPeriods().pipe(catchError(() => of([]))),
      subjects: this.subjectScope.listVisibleSubjects().pipe(catchError(() => of([]))),
      teachers: this.isAdmin() ? this.academics.listTeachers().pipe(catchError(() => of([]))) : of([]),
      health: this.isAdmin() ? this.health.checkAll() : of([]),
      teacherStats: this.isTeacher() && user?.profile_id ? this.reports.teacherStats(user.profile_id).pipe(catchError(() => of([]))) : of([]),
      studentStats: this.isStudent() && user?.profile_id ? this.reports.studentStats(user.profile_id).pipe(catchError(() => of([]))) : of([])
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data: any) => {
      this.state.set(data as DashboardState);
      if (user?.role === 'docente') this.loadTeacherOverview(data.subjects, data.teacherStats);
      this.lastUpdatedAt.set(new Date());
      if (initialLoad) this.loading.set(false);
    });
  }

  private loadTeacherOverview(subjects: Subject[], stats: TeacherStats[]): void {
    if (!subjects.length) return;
    forkJoin(subjects.map((s) => forkJoin({
      subject: of(s),
      students: this.academics.listStudentsBySubject(s.id).pipe(catchError(() => of([] as Student[]))),
      summary: this.grades.getConcentrado(s.id).pipe(catchError(() => of([] as GradeSummary[])))
    }))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((packs) => {
      const uniqueStudentIds = new Set(packs.flatMap((p) => p.students.map((st) => st.id)));
      const gradeRows = packs.flatMap((p) => p.summary);
      const atRisk = new Set(gradeRows.filter((r) => r.promedio_redondeado < 70).map((r) => r.alumno_id));
      const avg = gradeRows.length ? Math.round((gradeRows.reduce((sum, r) => sum + r.promedio_real, 0) / gradeRows.length) * 10) / 10 : 0;
      const pass = gradeRows.length ? Math.round((gradeRows.filter((r) => r.promedio_redondeado >= 70).length / gradeRows.length) * 100) : 0;
      this.teacherOverview.set({ totalStudents: uniqueStudentIds.size, overallAverage: avg, passRate: pass, atRiskStudents: atRisk.size });
    });
  }
}
