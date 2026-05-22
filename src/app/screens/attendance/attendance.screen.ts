import { ChangeDetectorRef, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe, UpperCasePipe, DatePipe } from '@angular/common';
import { Subscription, forkJoin, interval, of } from 'rxjs';
import { catchError, delay, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { AcademicsService } from '../../services/academics.service';
import { AttendanceService } from '../../services/attendance.service';
import { errorMessage } from '../../core/utils/error.util';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';

import { Student, Subject } from '../../shared/models/academic.models';
import { AttendanceSession, AttendanceRecord, QrPayload } from '../../shared/models/attendance.models';
import { TableColumn } from '../../shared/models/ui.models';

interface AttendanceHistoryRow extends AttendanceRecord {
  student_name: string;
  matricula: string;
}

interface StudentAttendanceSummary {
  student: Student;
  present: number;
  late: number;
  absences: number;
  percentage: number;
}

interface BarcodeDetectorResult { rawValue?: string; }
interface BarcodeDetectorLike { detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>; }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

@Component({
  selector: 'agm-attendance-screen',
  standalone: true,
  imports: [
    PageHeaderComponent, LoadingSkeletonComponent, EmptyStateComponent,
    FormsModule, KpiCardComponent, SearchableTableComponent, SlicePipe, UpperCasePipe, DatePipe
  ],
  templateUrl: './attendance.screen.html',
  styleUrl: './attendance.screen.scss'
})
export class AttendanceScreen implements OnInit, OnDestroy {
  @ViewChild('scannerVideo') scannerVideo?: ElementRef<HTMLVideoElement>;

  private readonly destroyRef = inject(DestroyRef);
  public readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly academics = inject(AcademicsService);
  private readonly attendance = inject(AttendanceService);
  private readonly toasts = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  // --- Estados Principales ---
  readonly loading = signal(true);
  readonly starting = signal(false);
  readonly registering = signal(false);
  readonly generatingQr = signal(false);
  readonly syncing = signal(false);

  readonly lastSyncedAt = signal<Date | null>(null);
  readonly scannerVisible = signal(false);
  readonly scannerActive = signal(false);
  readonly scannerStarting = signal(false);
  readonly scannerMessage = signal('');
  readonly scannerError = signal(false);

  readonly subjects = signal<Subject[]>([]);
  readonly selectedSubjectId = signal<number | null>(null);

  readonly activeSession = signal<any | null>(null);
  readonly sessions = signal<AttendanceSession[]>([]);
  readonly history = signal<AttendanceRecord[]>([]);
  readonly students = signal<Student[]>([]);
  readonly qrPayload = signal<QrPayload | null>(null);

  readonly rightPanelTab = signal<'live' | 'history'>('live');

  qrToken = '';
  studentSessionId: number | null = null;
  readonly qrTimeLeft = signal(0);

  private pollSubscription?: Subscription;
  private qrInterval: any;
  private scannerStream?: MediaStream;
  private scannerFrameId?: number;
  private detector?: BarcodeDetectorLike;

  readonly isTeacher = computed(() => this.auth.role() === 'admin' || this.auth.role() === 'docente');
  readonly isStudent = computed(() => this.auth.role() === 'alumno');

  readonly visibleHistory = computed(() => {
    const user = this.auth.user();
    return user?.role === 'alumno' && user.profile_id
      ? this.history().filter((record) => record.student_id === user.profile_id)
      : this.history();
  });

  readonly visibleStudents = computed(() => {
    const user = this.auth.user();
    return user?.role === 'alumno' && user.profile_id
      ? this.students().filter((student) => student.id === user.profile_id)
      : this.students();
  });

  readonly historyRows = computed<AttendanceHistoryRow[]>(() => this.visibleHistory().map((record) => {
    const student = this.students().find((item) => item.id === record.student_id);
    return {
      ...record,
      student_name: student?.nombre ?? `Alumno ${record.student_id}`,
      matricula: student?.matricula ?? '--'
    };
  }));

  readonly studentSummaries = computed<StudentAttendanceSummary[]>(() => {
    const sessionIds = new Set(this.visibleHistory().map((record) => record.session_id));
    const totalSessions = sessionIds.size;
    return this.visibleStudents().map((student) => {
      const records = this.visibleHistory().filter((record) => record.student_id === student.id);
      const present = records.filter((record) => record.estado === 'Presente' || (record as any).status === 'presente').length;
      const late = records.filter((record) => record.estado === 'Retardo' || (record as any).status === 'retardo').length;
      const absences = Math.max(0, totalSessions - present - late);
      const percentage = totalSessions ? Math.round(((present + late) / totalSessions) * 100) : 0;
      return { student, present, late, absences, percentage };
    }).sort((a, b) => a.percentage - b.percentage || a.student.nombre.localeCompare(b.student.nombre, 'es'));
  });

  readonly historyColumns: TableColumn<AttendanceHistoryRow>[] = [
    { key: 'session_id', header: 'Sesión' },
    { key: 'matricula', header: 'Matrícula' },
    { key: 'student_name', header: 'Alumno' },
    { key: 'estado', header: 'Estado', badge: (row) => row.estado },
    { key: 'registered_at', header: 'Registrado', formatter: (row) => new Date(row.registered_at || (row as any).created_at).toLocaleString() }
  ];

  readonly liveRoster = computed(() => {
    const list = this.students();
    const session = this.activeSession();
    if (!session) return list.map(s => ({ ...s, status: 'AUSENTE', tone: 'danger' }));

    return list.map(s => {
      const record = this.visibleHistory().find(r => r.session_id === session.session_id && r.student_id === s.id);
      return {
        ...s,
        status: record ? 'PRESENTE' : 'AUSENTE',
        tone: record ? 'success' : 'danger'
      };
    });
  });

  readonly presentCount = computed(() => this.liveRoster().filter(s => s.status === 'PRESENTE').length);

  // --- Temporizador Global Docente ---
  readonly timeLeftLabel = signal('10:00');
  private timerSub?: Subscription;

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.stopScanner();
    this.clearQrTimer();
    if (this.timerSub) this.timerSub.unsubscribe();
  }

  sessionCount(): number {
    return new Set(this.visibleHistory().map((record) => record.session_id)).size || this.sessions().length;
  }

  attendanceRate(): number {
    const summaries = this.studentSummaries();
    if (!summaries.length) return 0;
    return Math.round(summaries.reduce((sum, item) => sum + item.percentage, 0) / summaries.length);
  }

  // --- Formato de Fecha y Duración 10 minutos ---
  activeSessionDateLabel(): string {
    const session = this.activeSession();
    if (!session) return '';

    const start = new Date((session as any).created_at || (session as any).creado_en || Date.now());
    const closesAt = new Date(start.getTime() + 600000); // 10 minutos

    const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

    const dateStr = start.toLocaleDateString('es-MX', dateOpts);
    const startStr = start.toLocaleTimeString('es-MX', timeOpts);
    const endStr = closesAt.toLocaleTimeString('es-MX', timeOpts);

    return `${dateStr}, de ${startStr} a ${endStr}`;
  }

  reload(): void {
    this.loading.set(true);
    const currentActiveSession = this.activeSession();

    this.subjectScope.listVisibleSubjects().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        const sortedSubs = subjects.sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.subjects.set(sortedSubs);

        const initial = this.selectedSubjectId() ?? sortedSubs[0]?.id ?? null;
        this.selectedSubjectId.set(initial);

        if (initial) {
          if (currentActiveSession) this.activeSession.set(currentActiveSession);
          this.loadAttendance(initial, true);
          this.startPolling(initial);
        } else {
          this.loading.set(false);
        }
      },
      error: (error: unknown) => {
        this.toasts.error('Error', errorMessage(error));
        this.loading.set(false);
      }
    });
  }

  selectSubject(id: number | null): void {
    this.selectedSubjectId.set(id);
    this.qrPayload.set(null);
    this.activeSession.set(null);
    this.clearQrTimer();

    if (id) {
      this.loadAttendance(id);
      this.startPolling(id);
    } else {
      this.pollSubscription?.unsubscribe();
      this.sessions.set([]);
      this.history.set([]);
      this.students.set([]);
    }
  }

  loadAttendance(subjectId: number, finishLoading = false): void {
    this.sessions.set(this.attendance.getLocalSessions(subjectId));
    this.syncing.set(true);
    this.attendance.attendanceHistory(subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (history) => {
        this.history.set(history);
        this.lastSyncedAt.set(new Date());
        this.syncing.set(false);
        this.loadStudents(subjectId, finishLoading);
      },
      error: () => {
        this.history.set([]);
        this.syncing.set(false);
        this.loadStudents(subjectId, finishLoading);
      }
    });
  }

  private startPolling(subjectId: number): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = interval(15_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.syncing.set(true);
      this.attendance.attendanceHistory(subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (history) => {
          this.history.set(history);
          this.lastSyncedAt.set(new Date());
          this.syncing.set(false);
        },
        error: () => this.syncing.set(false)
      });
    });
  }

  private loadStudents(subjectId: number, finishLoading = false): void {
    this.academics.listStudentsBySubject(subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (students) => {
        this.students.set(students.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        if (finishLoading) this.loading.set(false);
      },
      error: () => {
        this.students.set([]);
        if (finishLoading) this.loading.set(false);
      }
    });
  }

  // --- FLUJO DOCENTE ---
  startSession(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) return this.toasts.warning('Selecciona una materia');

    this.starting.set(true);

    // Conexión real, sin mocks falsos
    this.attendance.startSession(subjectId).pipe(
      finalize(() => this.starting.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (session: any) => {
        this.toasts.success('Sesión iniciada', `ID ${session.session_id}. Díctale este ID a los alumnos.`);
        this.setActiveSession(session);
        this.sessions.set(this.attendance.getLocalSessions(subjectId));
      },
      error: (error: unknown) => this.toasts.error('Error', errorMessage(error))
    });
  }

  private setActiveSession(session: any | null): void {
    this.activeSession.set(session);
    if (this.timerSub) this.timerSub.unsubscribe();

    if (session) {
      this.timerSub = interval(1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        const createdAt = new Date(session.created_at || session.creado_en || Date.now()).getTime();
        const expiresAt = createdAt + 600000; // 10 Minutos exactos
        const diff = expiresAt - Date.now();

        if (diff <= 0) {
          this.closeSession();
        } else {
          const m = Math.floor(diff / 60000).toString().padStart(2, '0');
          const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
          this.timeLeftLabel.set(`${m}:${s}`);
        }
      });
    } else {
      this.timeLeftLabel.set('00:00');
    }
  }

  closeSession(): void {
    const session = this.activeSession();
    if (!session) return;
    const subjectId = this.selectedSubjectId();
    this.loading.set(true);

    // Conexión real, sin mocks falsos
    this.attendance.closeSession(session.session_id || session.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Sesión cerrada correctamente');
        this.activeSession.set(null);
        this.stopScanner();
        if (this.timerSub) this.timerSub.unsubscribe();

        if (subjectId) {
          this.sessions.set(this.attendance.getLocalSessions(subjectId));
          this.loadAttendance(subjectId, true);
        } else {
          this.loading.set(false);
        }
      },
      error: (error: unknown) => {
        this.toasts.error('Error al cerrar', errorMessage(error));
        this.loading.set(false);
      }
    });
  }

  registerAttendance(): void {
    if (!this.qrToken.trim()) return this.toasts.warning('Pega un token QR');

    const subjectId = this.selectedSubjectId();
    this.registering.set(true);

    // Conexión real, sin mocks falsos
    this.attendance.registerAttendance(this.qrToken.trim()).pipe(
      finalize(() => this.registering.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Asistencia Registrada', 'El alumno fue marcado como presente.');
        this.qrToken = '';
        if (subjectId) this.loadAttendance(subjectId);
      },
      error: (error: unknown) => this.toasts.error('Error', errorMessage(error))
    });
  }

  // --- FLUJO ALUMNO (QR Dinámico 15 Segundos) ---
  generateQr(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId || !this.studentSessionId) {
      return this.toasts.warning('Falta Información', 'Ingresa el ID de sesión proporcionado por tu docente.');
    }
    this.fetchQrPayload();
  }

  private fetchQrPayload(): void {
    const subjectId = this.selectedSubjectId()!;
    this.generatingQr.set(true);

    // Conexión real, sin mocks falsos
    this.attendance.generateQr(subjectId, Number(this.studentSessionId)).pipe(
      finalize(() => this.generatingQr.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (payload) => {
        this.qrPayload.set(payload as QrPayload);
        this.startQrTimer();
      },
      error: (error: unknown) => {
        // Limpiamos el ID introducido para que el alumno intente de nuevo
        this.studentSessionId = null;
        this.toasts.error('Error', errorMessage(error));
      }
    });
  }

  private startQrTimer(): void {
    this.clearQrTimer();
    this.qrTimeLeft.set(15);

    this.qrInterval = setInterval(() => {
      const current = this.qrTimeLeft() - 1;
      if (current <= 0) {
        this.clearQrTimer();
        this.fetchQrPayload();
      } else {
        this.qrTimeLeft.set(current);
      }
    }, 1000);
  }

  private clearQrTimer(): void {
    if (this.qrInterval) {
      clearInterval(this.qrInterval);
      this.qrInterval = null;
    }
  }

  // --- ESCÁNER ORIGINAL INTACTO CON FALLBACK ROBUSTO ---
  async startScanner(): Promise<void> {
    const Detector = (window as Window & typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!navigator.mediaDevices?.getUserMedia) return this.setScannerMessage('Tu navegador deniega el acceso a la cámara.', true);

    this.scannerVisible.set(true);
    this.scannerStarting.set(true);
    this.scannerError.set(false);
    this.scannerMessage.set('Solicitando permisos...');
    this.cdr.detectChanges();

    try {
      try {
        this.scannerStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' } },
          audio: false
        });
      } catch (e) {
        this.scannerStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
      const video = this.scannerVideo?.nativeElement;
      if (!video) throw new Error('No se encontró la vista previa de la cámara.');

      video.srcObject = this.scannerStream;
      await video.play();

      if (Detector) {
        this.detector = new Detector({ formats: ['qr_code'] });
        this.scannerActive.set(true);
        this.setScannerMessage('Cámara activa. Escanea un QR válido.', false);
        this.scanFrame();
      } else {
        this.scannerActive.set(true);
        this.setScannerMessage('Dispositivo sin Auto-Escaneo. Usa la cámara de apoyo visual y captura manual.', false);
      }

    } catch (error: unknown) {
      this.setScannerMessage(this.cameraErrorMessage(error), true);
      this.stopScanner(false);
    } finally {
      this.scannerStarting.set(false);
    }
  }

  stopScanner(hide = true): void {
    if (this.scannerFrameId) {
      cancelAnimationFrame(this.scannerFrameId);
      this.scannerFrameId = undefined;
    }
    this.scannerStream?.getTracks().forEach((track) => track.stop());
    this.scannerStream = undefined;
    this.detector = undefined;
    this.scannerActive.set(false);
    if (hide) this.scannerVisible.set(false);
  }

  private scanFrame(): void {
    const video = this.scannerVideo?.nativeElement;
    if (!video || !this.detector || !this.scannerActive()) return;

    void this.detector.detect(video).then((codes) => {
      const rawValue = codes.find((code) => code.rawValue)?.rawValue?.trim();
      const token = rawValue ? this.normalizeScannedToken(rawValue) : null;

      if (token) {
        this.qrToken = token;
        this.setScannerMessage('¡QR Detectado! Presiona Confirmar.', false);
        this.stopScanner(false);
        return;
      }
      if (rawValue) {
        this.setScannerMessage('El QR no es compatible con el sistema.', true);
      }
      this.scannerFrameId = requestAnimationFrame(() => this.scanFrame());
    }).catch(() => {
      this.scannerFrameId = requestAnimationFrame(() => this.scanFrame());
    });
  }

  private setScannerMessage(message: string, error: boolean): void {
    this.scannerMessage.set(message);
    this.scannerError.set(error);
  }

  private normalizeScannedToken(rawValue: string): string | null {
    const value = rawValue.trim();
    let token = value;
    try {
      const url = new URL(value);
      token = url.searchParams.get('token') || url.hash.replace(/^#token=/, '') || value;
    } catch {
      token = value;
    }
    const clean = token.replace(/\s+/g, '');
    try {
      const padded = clean.padEnd(clean.length + ((4 - clean.length % 4) % 4), '=');
      const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(decoded) as { p?: string; s?: string };
      return payload.p && payload.s ? clean : null;
    } catch {
      return null;
    }
  }

  private cameraErrorMessage(error: unknown): string {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Permiso de cámara denegado en tu navegador.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se detectó ninguna cámara instalada.';
    if (name === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación.';
    return errorMessage(error, 'Fallo de hardware al abrir la cámara.');
  }
}
