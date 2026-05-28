import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription, forkJoin, interval, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import jsQR from 'jsqr';

import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { AcademicsService } from '../../services/academics.service';
import { AttendanceService } from '../../services/attendance.service';
import { PeriodsService } from '../../services/periods.service';
import { errorMessage } from '../../core/utils/error.util';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';

import { Period, Student, Subject } from '../../shared/models/academic.models';
import { AttendanceSession, AttendanceRecord, QrPayload } from '../../shared/models/attendance.models';
import { TableColumn } from '../../shared/models/ui.models';

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------

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

type PendingConfirmation = 'start' | 'close';
type RosterTone = 'success' | 'warning' | 'danger';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'agm-attendance-screen',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    FormsModule,
    KpiCardComponent,
    SearchableTableComponent,
    ConfirmationModalComponent,
    DatePipe,
  ],
  templateUrl: './attendance.screen.html',
  styleUrl: './attendance.screen.scss',
})
export class AttendanceScreen implements OnInit, OnDestroy {
  // -------------------------------------------------------------------------
  // ViewChildren – used by the QR scanner (teacher) and canvas fallback
  // -------------------------------------------------------------------------
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  // -------------------------------------------------------------------------
  // DI
  // -------------------------------------------------------------------------
  private readonly destroyRef = inject(DestroyRef);
  public readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly periodsService = inject(PeriodsService);
  private readonly academics = inject(AcademicsService);
  private readonly attendance = inject(AttendanceService);
  private readonly toasts = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  // -------------------------------------------------------------------------
  // Loading / status signals
  // -------------------------------------------------------------------------
  readonly loading = signal(true);
  readonly loadingSubjects = signal(false);
  readonly starting = signal(false);
  readonly closing = signal(false);
  readonly registering = signal(false);
  readonly generatingQr = signal(false);
  readonly syncing = signal(false);
  readonly lastSyncedAt = signal<Date | null>(null);

  // -------------------------------------------------------------------------
  // Scanner signals (teacher only)
  // -------------------------------------------------------------------------
  readonly scannerVisible = signal(false);
  readonly scannerActive = signal(false);
  readonly scannerStarting = signal(false);
  readonly scannerMessage = signal('');
  readonly scannerError = signal(false);

  // -------------------------------------------------------------------------
  // Data signals
  // -------------------------------------------------------------------------
  readonly periods = signal<Period[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly students = signal<Student[]>([]);
  readonly selectedPeriodId = signal<number | null>(null);
  readonly selectedSubjectId = signal<number | null>(null);

  readonly activeSession = signal<AttendanceSession | null>(null);
  readonly history = signal<AttendanceRecord[]>([]);
  readonly qrPayload = signal<QrPayload | null>(null);
  readonly pendingConfirmation = signal<PendingConfirmation | null>(null);

  // -------------------------------------------------------------------------
  // UI state signals
  // -------------------------------------------------------------------------
  readonly rightPanelTab = signal<'live' | 'history'>('live');
  readonly timeLeftLabel = signal('00:00');
  readonly qrTimeLeft = signal(0);

  // Two-way bound form fields (not Signals – used with ngModel)
  qrToken = '';
  studentSessionId: number | null = null;

  // -------------------------------------------------------------------------
  // Private subscriptions
  // -------------------------------------------------------------------------
  private pollSubscription?: Subscription;
  private timerSub?: Subscription;
  private qrRefreshSub?: Subscription;
  private qrCountdownSub?: Subscription;
  private scannerStream?: MediaStream;
  private scannerFrameId?: number;
  /**
   * Tracks the session that triggered an auto-close (timer reached 00:00).
   * Prevents a second close call when the timer fires AND a poll returns the
   * same expired session simultaneously.
   */
  private autoClosingSessionId: number | null = null;

  // =========================================================================
  // Computed signals
  // =========================================================================

  /** Role shortcuts */
  readonly isTeacher = computed(() => {
    const role = this.auth.role();
    return role === 'admin' || role === 'docente';
  });
  readonly isStudent = computed(() => this.auth.role() === 'alumno');

  /** Selected entities */
  readonly selectedPeriod = computed(
    () => this.periods().find((p) => p.id === this.selectedPeriodId()) ?? null,
  );
  readonly selectedSubject = computed(
    () => this.subjects().find((s) => s.id === this.selectedSubjectId()) ?? null,
  );

  /**
   * History visible to the current user.
   * Students see only their own records; teachers see everything.
   */
  readonly visibleHistory = computed(() => {
    const user = this.auth.user();
    if (user?.role === 'alumno' && user.profile_id) {
      return this.history().filter((r) => r.student_id === user.profile_id);
    }
    return this.history();
  });

  /** Rows passed to <agm-searchable-table> */
  readonly historyRows = computed<AttendanceHistoryRow[]>(() => {
    const currentUser = this.auth.user();
    return [...this.visibleHistory()]
      .sort((a, b) => this.recordTimeMs(b) - this.recordTimeMs(a))
      .map((record) => {
        const student = this.students().find((s) => s.id === record.student_id);
        return {
          ...record,
          student_name:
            student?.nombre ?? currentUser?.display_name ?? `Alumno ${record.student_id}`,
          matricula: student?.matricula ?? '--',
        };
      });
  });

  /** Column definitions – differ by role */
  readonly historyColumns = computed<TableColumn<AttendanceHistoryRow>[]>(() => {
    const base: TableColumn<AttendanceHistoryRow>[] = [
      { key: 'session_id', header: 'Sesion' },
      { key: 'estado', header: 'Estado', badge: (row) => row.estado },
      {
        key: 'registered_at',
        header: 'Registrado',
        formatter: (row) => this.formatRecordDate(row),
      },
    ];

    if (this.isStudent()) return base;

    return [
      { key: 'session_id', header: 'Sesion' },
      { key: 'matricula', header: 'Matricula' },
      { key: 'student_name', header: 'Alumno' },
      { key: 'estado', header: 'Estado', badge: (row) => row.estado },
      {
        key: 'registered_at',
        header: 'Registrado',
        formatter: (row) => this.formatRecordDate(row),
      },
    ];
  });

  /** Per-student attendance summary (used for teacher KPIs) */
  readonly studentSummaries = computed<StudentAttendanceSummary[]>(() => {
    const sessionIds = new Set(this.history().map((r) => r.session_id));
    const totalSessions = sessionIds.size;

    return this.students()
      .map((student) => {
        const records = this.history().filter((r) => r.student_id === student.id);
        const present = records.filter((r) => this.isPresent(r.estado)).length;
        const late = records.filter((r) => this.isLate(r.estado)).length;
        const explicitAbsences = records.filter((r) => this.isAbsence(r.estado)).length;
        const absences = Math.max(explicitAbsences, totalSessions - present - late);
        const percentage = totalSessions
          ? Math.round(((present + late) / totalSessions) * 100)
          : 0;
        return { student, present, late, absences, percentage };
      })
      .sort(
        (a, b) =>
          a.percentage - b.percentage ||
          a.student.nombre.localeCompare(b.student.nombre, 'es'),
      );
  });

  /**
   * Live roster for the active session.
   * Only relevant for teacher "Registro en Vivo" tab.
   */
  readonly liveRoster = computed(() => {
    const session = this.activeSession();
    const sessionId = session?.session_id ?? null;
    const records = sessionId
      ? this.history().filter((r) => r.session_id === sessionId)
      : [];

    return this.students().map((student) => {
      const record = records.find((r) => r.student_id === student.id);
      const status = this.rosterStatus(record);
      return { ...student, status: status.label, tone: status.tone };
    });
  });

  /** Count of students already registered in the active session */
  readonly presentCount = computed(
    () =>
      this.liveRoster().filter(
        (s) => s.status === 'PRESENTE' || s.status === 'RETARDO',
      ).length,
  );

  /**
   * Unique session count visible to the current user.
   * IMPORTANT: This is a computed Signal, NOT a plain method, to ensure
   * correct reactivity and memoisation in the template.
   */
  readonly sessionCount = computed(
    () => new Set(this.visibleHistory().map((r) => r.session_id)).size,
  );

  /**
   * Overall attendance rate (%) for the KPI card.
   * • Student  → percentage of their own sessions attended.
   * • Teacher  → average across all enrolled students.
   */
  readonly attendanceRate = computed(() => {
    if (this.isStudent()) {
      const rows = this.visibleHistory();
      if (!rows.length) return 0;
      const attended = rows.filter(
        (r) => this.isPresent(r.estado) || this.isLate(r.estado),
      ).length;
      return Math.round((attended / rows.length) * 100);
    }

    const summaries = this.studentSummaries();
    if (!summaries.length) return 0;
    return Math.round(
      summaries.reduce((sum, s) => sum + s.percentage, 0) / summaries.length,
    );
  });

  // Confirmation modal -------------------------------------------------------

  readonly confirmationTitle = computed(() =>
    this.pendingConfirmation() === 'start'
      ? 'Abrir pase de lista'
      : 'Cerrar pase de lista',
  );

  readonly confirmationMessage = computed(() => {
    if (this.pendingConfirmation() === 'start') {
      return '¿Estás seguro de abrir un pase de lista? Se asignarán faltas por defecto a todos los alumnos.';
    }
    return 'Si cierras antes de tiempo, la sesión concluirá. (Se respetará la lógica del backend para las faltas)';
  });

  readonly confirmationLabel = computed(() =>
    this.pendingConfirmation() === 'start' ? 'Abrir sesión' : 'Cerrar sesión',
  );

  // =========================================================================
  // Lifecycle
  // =========================================================================

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.stopScanner();
    this.clearStudentQrRotation();
  }

  // =========================================================================
  // Public methods – called from template
  // =========================================================================

  /** Hard-reload: re-fetches periods, then subjects, then subject context. */
  reload(): void {
    this.loading.set(true);

    this.periodsService
      .listPeriods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (periods) => {
          const sorted = [...periods].sort(
            (a, b) => Number(b.activo) - Number(a.activo) || b.id - a.id,
          );
          this.periods.set(sorted);

          const current = this.selectedPeriodId();
          const selected =
            current && sorted.some((p) => p.id === current)
              ? current
              : (sorted.find((p) => p.activo)?.id ?? sorted[0]?.id ?? null);

          this.selectedPeriodId.set(selected);

          if (selected) {
            this.loadSubjectsForPeriod(selected, true);
          } else {
            this.clearSubjectContext();
            this.loading.set(false);
          }
        },
        error: (err: unknown) => {
          this.toasts.error('Error', errorMessage(err, 'No fue posible cargar los periodos.'));
          this.loading.set(false);
        },
      });
  }

  /** Called when the teacher changes the period dropdown. */
  onPeriodChange(periodId: number | null): void {
    this.selectedPeriodId.set(periodId);
    this.clearSubjectContext();
    if (periodId) {
      this.loadSubjectsForPeriod(periodId, false);
    }
  }

  /** Called when the subject dropdown changes. */
  selectSubject(subjectId: number | null): void {
    this.selectedSubjectId.set(subjectId);
    this.resetLiveState();

    if (subjectId) {
      this.loadSubjectContext(subjectId, false);
      this.startPolling(subjectId);
    } else {
      this.pollSubscription?.unsubscribe();
      this.history.set([]);
      this.students.set([]);
    }
  }

  // ---- Session lifecycle ---------------------------------------------------

  requestStartSession(): void {
    if (!this.selectedSubjectId()) {
      this.toasts.warning('Selecciona una materia');
      return;
    }
    this.pendingConfirmation.set('start');
  }

  requestCloseSession(): void {
    if (!this.activeSession()) return;
    this.pendingConfirmation.set('close');
  }

  cancelConfirmation(): void {
    this.pendingConfirmation.set(null);
  }

  confirmPendingAction(): void {
    const action = this.pendingConfirmation();
    this.pendingConfirmation.set(null);

    if (action === 'start') {
      this.openSession();
    } else if (action === 'close') {
      this.closeCurrentSession(false);
    }
  }

  // ---- Active-session helpers (template bindings) -------------------------

  /** Human-readable date range for the active session card. */
  activeSessionDateLabel(): string {
    const session = this.activeSession();
    if (!session) return '';

    const start = new Date(this.sessionStartMs(session));
    const closesAt = new Date(this.sessionClosesAtMs(session));
    const dateOpts: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

    return (
      `${start.toLocaleDateString('es-MX', dateOpts)}, ` +
      `de ${start.toLocaleTimeString('es-MX', timeOpts)} ` +
      `a ${closesAt.toLocaleTimeString('es-MX', timeOpts)}`
    );
  }

  // ---- Attendance registration (teacher) ----------------------------------

  registerAttendance(): void {
    const token = this.qrToken.trim();
    if (!token) {
      this.toasts.warning('Token requerido', 'Escanea, sube foto o escribe el token del alumno.');
      return;
    }

    const subjectId = this.selectedSubjectId();
    this.registering.set(true);

    this.attendance
      .registerAttendance(token)
      .pipe(
        finalize(() => this.registering.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toasts.success('Asistencia registrada', 'El alumno fue marcado por el backend.');
          this.qrToken = '';
          if (subjectId) {
            this.refreshSubjectData(subjectId, true);
          }
        },
        error: (err: unknown) => this.toasts.error('Error', errorMessage(err)),
      });
  }

  // ---- Student QR connection ----------------------------------------------

  /**
   * Student enters the session ID broadcast by the teacher and connects.
   * On success the QR + token rotate every 15 seconds via an RxJS interval.
   */
  connectStudentSession(): void {
    const subjectId = this.selectedSubjectId();
    const sessionId = Number(this.studentSessionId);

    if (!subjectId || !Number.isInteger(sessionId) || sessionId <= 0) {
      this.toasts.warning(
        'Falta información',
        'Selecciona una materia e ingresa el ID de sesión proporcionado por tu docente.',
      );
      return;
    }

    // Restart any existing rotation before fetching the first payload
    this.clearStudentQrRotation();
    this.fetchQrPayload(true);
  }

  // ---- Camera scanner (teacher) -------------------------------------------

  /**
   * Opens the device camera, renders frames to the hidden <canvas> and
   * feeds each frame's ImageData to jsQR. Falls back to the manual/photo
   * path automatically when getUserMedia is unavailable.
   */
  async startScanner(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.setScannerMessage(
        'Tu navegador no permite acceder a la cámara. Usa foto o token manual.',
        true,
      );
      this.scannerVisible.set(true);
      return;
    }

    this.scannerVisible.set(true);
    this.scannerStarting.set(true);
    this.scannerError.set(false);
    this.scannerMessage.set('Solicitando permisos de cámara…');
    this.cdr.detectChanges(); // ensure <video> is in the DOM before we set srcObject

    try {
      this.scannerStream = await this.openCameraStream();
      const video = this.videoElement?.nativeElement;

      if (!video) {
        throw new Error('No se encontró la vista previa de la cámara.');
      }

      video.srcObject = this.scannerStream;
      await video.play();

      this.scannerActive.set(true);
      this.setScannerMessage('Cámara activa. Acerca el QR al recuadro.', false);
      this.scanFrame();
    } catch (err: unknown) {
      this.setScannerMessage(this.cameraErrorMessage(err), true);
      this.stopScanner(false);
    } finally {
      this.scannerStarting.set(false);
    }
  }

  /** Stops the camera stream and optionally hides the scanner frame. */
  stopScanner(hide = true): void {
    if (this.scannerFrameId) {
      cancelAnimationFrame(this.scannerFrameId);
      this.scannerFrameId = undefined;
    }

    this.scannerStream?.getTracks().forEach((t) => t.stop());
    this.scannerStream = undefined;
    this.scannerActive.set(false);

    const video = this.videoElement?.nativeElement;
    if (video) {
      video.srcObject = null;
    }

    if (hide) {
      this.scannerVisible.set(false);
    }
  }

  /**
   * File-upload fallback for the QR scanner.
   * Draws the image onto the hidden canvas and passes the pixel data to jsQR.
   */
  async onQrImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // reset so the same file can be re-selected

    if (!file) return;

    this.setScannerMessage('Leyendo QR desde la imagen…', false);

    try {
      const rawValue = await this.decodeQrFromImage(file);
      const token = rawValue ? this.normalizeScannedToken(rawValue) : null;

      if (!token) {
        this.setScannerMessage('No se encontró un QR compatible en la imagen.', true);
        return;
      }

      this.qrToken = token;
      this.setScannerMessage('Token leído desde imagen. Confirma para registrar.', false);
    } catch (err: unknown) {
      this.setScannerMessage(errorMessage(err, 'No fue posible leer la imagen.'), true);
    }
  }

  /** Select-all on the student's read-only token input when focused. */
  selectTokenInput(event: FocusEvent): void {
    (event.target as HTMLInputElement | null)?.select();
  }

  // =========================================================================
  // Private – data loading helpers
  // =========================================================================

  /**
   * Loads the subjects belonging to a period.
   * If `finishLoading` is true it also turns off the global skeleton loader
   * once the initial subject context is ready.
   */
  private loadSubjectsForPeriod(periodId: number, finishLoading: boolean): void {
    this.loadingSubjects.set(true);

    this.subjectScope
      .listVisibleSubjects(periodId)
      .pipe(
        finalize(() => this.loadingSubjects.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (subjects) => {
          const sorted = [...subjects].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es'),
          );
          this.subjects.set(sorted);

          const current = this.selectedSubjectId();
          const selected =
            current && sorted.some((s) => s.id === current)
              ? current
              : (sorted[0]?.id ?? null);

          this.selectedSubjectId.set(selected);

          if (selected) {
            this.loadSubjectContext(selected, finishLoading);
            this.startPolling(selected);
          } else {
            this.clearSubjectContext();
            if (finishLoading) this.loading.set(false);
          }
        },
        error: (err: unknown) => {
          this.subjects.set([]);
          this.clearSubjectContext();
          this.toasts.error(
            'Error',
            errorMessage(err, 'No fue posible cargar las materias del periodo.'),
          );
          if (finishLoading) this.loading.set(false);
        },
      });
  }

  /**
   * Full initial load for a subject: active session check, history, roster.
   *
   * KEY BEHAVIOUR (Persistent Timer):
   * If the teacher refreshes the page (F5), we call `getActiveSession` here.
   * If an open session is returned, we restore `activeSession` and restart the
   * countdown timer from the server-provided `closes_at` timestamp – so the
   * timer never resets on reload.
   */
  private loadSubjectContext(subjectId: number, finishLoading: boolean): void {
    this.syncing.set(true);

    forkJoin({
      activeSession: this.isTeacher()
        ? this.attendance.getActiveSession(subjectId).pipe(catchError(() => of(null)))
        : of(null),
      history: this.attendance
        .attendanceHistory(subjectId)
        .pipe(catchError(() => of([] as AttendanceRecord[]))),
      students: this.isTeacher()
        ? this.academics
            .listStudentsBySubject(subjectId)
            .pipe(catchError(() => of([] as Student[])))
        : of([] as Student[]),
    })
      .pipe(
        finalize(() => {
          this.syncing.set(false);
          if (finishLoading) this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ activeSession, history, students }) => {
        this.history.set(history);
        this.students.set(
          [...students].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        );
        this.lastSyncedAt.set(new Date());

        // Restore the session (and its countdown) if it is still open.
        // This is the critical path for surviving a page refresh.
        this.setActiveSession(
          activeSession && this.isSessionOpen(activeSession) ? activeSession : null,
        );
      });
  }

  /**
   * Lightweight refresh used by polling and post-registration updates.
   * Does NOT reload the full student roster.
   */
  private refreshSubjectData(subjectId: number, silent: boolean): void {
    if (!silent) this.syncing.set(true);

    forkJoin({
      activeSession: this.isTeacher()
        ? this.attendance.getActiveSession(subjectId).pipe(catchError(() => of(null)))
        : of(null),
      history: this.attendance
        .attendanceHistory(subjectId)
        .pipe(catchError(() => of(this.history()))),
    })
      .pipe(
        finalize(() => this.syncing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ activeSession, history }) => {
        this.history.set(history);
        this.lastSyncedAt.set(new Date());

        if (this.isTeacher()) {
          this.setActiveSession(
            activeSession && this.isSessionOpen(activeSession) ? activeSession : null,
          );
        }
      });
  }

  /** Polls the backend every 15 s for live roster updates while on this screen. */
  private startPolling(subjectId: number): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = interval(15_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshSubjectData(subjectId, true));
  }

  // =========================================================================
  // Private – session management
  // =========================================================================

  private openSession(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) return;

    this.starting.set(true);
    this.attendance
      .startSession(subjectId)
      .pipe(
        finalize(() => this.starting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (session) => {
          this.toasts.success(
            'Sesión iniciada',
            `ID ${session.session_id}. Comparte este ID con los alumnos.`,
          );
          this.setActiveSession(session);
          this.refreshSubjectData(subjectId, true);
        },
        error: (err: unknown) => this.toasts.error('Error', errorMessage(err)),
      });
  }

  private closeCurrentSession(fromTimer: boolean): void {
    const session = this.activeSession();
    if (!session) return;
    this.closeSession(session, fromTimer);
  }

  private closeSession(session: AttendanceSession, fromTimer: boolean): void {
    const subjectId = this.selectedSubjectId();
    const sessionId = session.session_id;

    if (fromTimer) {
      this.autoClosingSessionId = sessionId;
    } else {
      this.closing.set(true);
    }

    this.attendance
      .closeSession(sessionId)
      .pipe(
        finalize(() => {
          this.closing.set(false);
          if (this.autoClosingSessionId === sessionId) {
            this.autoClosingSessionId = null;
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toasts.success(
            fromTimer ? 'Sesión expirada' : 'Sesión cerrada',
            fromTimer
              ? 'El pase de lista llegó a 00:00.'
              : 'El pase de lista concluyó correctamente.',
          );
          this.setActiveSession(null);
          this.stopScanner();
          if (subjectId) this.refreshSubjectData(subjectId, true);
        },
        error: (err: unknown) => {
          // Even on error we clear the local state so the UI is consistent.
          this.setActiveSession(null);
          this.stopScanner();
          this.toasts.error('Error al cerrar', errorMessage(err));
        },
      });
  }

  /**
   * Sets the active session and manages the countdown timer.
   *
   * The timer calculates the remaining time using the server-provided
   * `closes_at` field against `Date.now()`.  This means:
   *  - The timer is always accurate even after a page refresh.
   *  - There is no risk of the timer drifting or freezing.
   */
  private setActiveSession(session: AttendanceSession | null): void {
    this.timerSub?.unsubscribe();
    this.timerSub = undefined;
    this.activeSession.set(session);

    if (!session) {
      this.timeLeftLabel.set('00:00');
      return;
    }

    // Tick immediately, then every second
    this.updateSessionTimer(session);
    this.timerSub = interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateSessionTimer(session));
  }

  private updateSessionTimer(session: AttendanceSession): void {
    const diff = this.sessionClosesAtMs(session) - Date.now();

    if (diff <= 0) {
      this.timeLeftLabel.set('00:00');
      this.timerSub?.unsubscribe();
      this.timerSub = undefined;

      // Guard: only auto-close once per session, even if the poll also fires
      if (this.autoClosingSessionId !== session.session_id) {
        this.closeSession(session, true);
      }
      return;
    }

    const minutes = Math.floor(diff / 60_000)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor((diff % 60_000) / 1000)
      .toString()
      .padStart(2, '0');
    this.timeLeftLabel.set(`${minutes}:${seconds}`);
  }

  // =========================================================================
  // Private – student QR rotation
  // =========================================================================

  /**
   * Fetches a fresh QR + token from the backend for the student.
   * `restartRotation` = true on first connect; false on periodic refresh.
   */
  private fetchQrPayload(restartRotation: boolean): void {
    const subjectId = this.selectedSubjectId();
    const sessionId = Number(this.studentSessionId);

    if (!subjectId || !Number.isInteger(sessionId) || sessionId <= 0 || this.generatingQr()) {
      return;
    }

    this.generatingQr.set(true);

    this.attendance
      .generateQr(subjectId, sessionId)
      .pipe(
        finalize(() => this.generatingQr.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (payload) => {
          this.qrPayload.set(payload);
          this.qrTimeLeft.set(15);
          if (restartRotation) {
            this.startStudentQrRotation();
          }
        },
        error: (err: unknown) => {
          this.qrPayload.set(null);
          this.clearStudentQrRotation();
          this.toasts.error('Error', errorMessage(err));
        },
      });
  }

  /**
   * Starts two RxJS intervals:
   *  1. A 1-second countdown displayed next to the QR.
   *  2. A 15-second refresh that calls `fetchQrPayload` for a new token.
   *
   * The rotation exists for security: each token is single-use and short-lived.
   */
  private startStudentQrRotation(): void {
    this.clearStudentQrRotation();
    this.qrTimeLeft.set(15);

    this.qrCountdownSub = interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.qrTimeLeft.update((v) => (v <= 1 ? 15 : v - 1)),
      );

    this.qrRefreshSub = interval(15_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchQrPayload(false));
  }

  private clearStudentQrRotation(): void {
    this.qrRefreshSub?.unsubscribe();
    this.qrCountdownSub?.unsubscribe();
    this.qrRefreshSub = undefined;
    this.qrCountdownSub = undefined;
    this.qrTimeLeft.set(0);
  }

  // =========================================================================
  // Private – cleanup helpers
  // =========================================================================

  private clearSubjectContext(): void {
    this.pollSubscription?.unsubscribe();
    this.selectedSubjectId.set(null);
    this.subjects.set([]);
    this.history.set([]);
    this.students.set([]);
    this.resetLiveState();
  }

  private resetLiveState(): void {
    this.setActiveSession(null);
    this.qrPayload.set(null);
    this.qrToken = '';
    this.stopScanner();
    this.clearStudentQrRotation();
  }

  // =========================================================================
  // Private – camera & jsQR helpers
  // =========================================================================

  /** Tries `environment` (back) camera first; falls back to any camera. */
  private async openCameraStream(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: 'environment' } },
        audio: false,
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
  }

  /**
   * requestAnimationFrame loop that draws the video feed onto the hidden
   * canvas and passes each frame's ImageData to jsQR.
   */
  private scanFrame(): void {
    if (!this.scannerActive()) return;

    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;
    if (!video || !canvas) return;

    if (
      video.readyState === video.HAVE_ENOUGH_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        const token = code?.data ? this.normalizeScannedToken(code.data) : null;

        if (token) {
          this.qrToken = token;
          this.setScannerMessage('QR detectado. Confirma para registrar.', false);
          this.stopScanner(false);
          return;
        }
      }
    }

    this.scannerFrameId = requestAnimationFrame(() => this.scanFrame());
  }

  /** Decodes a QR from an uploaded image file using jsQR. */
  private async decodeQrFromImage(file: File): Promise<string | null> {
    const image = await this.loadImage(await this.fileToDataUrl(file));
    const canvas =
      this.canvasElement?.nativeElement ?? document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No se pudo preparar el lector de imagen.');

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null;
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.onload = () => {
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('El archivo no contiene una imagen válida.'));
      };
      reader.readAsDataURL(file);
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      img.src = src;
    });
  }

  // =========================================================================
  // Private – small utilities
  // =========================================================================

  private setScannerMessage(message: string, error: boolean): void {
    this.scannerMessage.set(message);
    this.scannerError.set(error);
  }

  /**
   * Normalises a raw QR scan value into a clean token string.
   * Handles URL-encoded tokens, JSON payloads, and plain strings.
   */
  private normalizeScannedToken(rawValue: string): string | null {
    const value = rawValue.trim();
    if (!value) return null;

    let token = value;

    // Try URL query-param / hash extraction
    try {
      const url = new URL(value);
      token =
        url.searchParams.get('token') ||
        url.hash.replace(/^#?token=/, '') ||
        value;
    } catch {
      token = value;
    }

    // Try JSON payload
    try {
      const json = JSON.parse(token) as { token?: string; qr?: string; value?: string };
      token = json.token || json.qr || json.value || token;
    } catch {
      token = token.trim();
    }

    const clean = token.replace(/\s+/g, '');
    return clean.length >= 8 ? clean : null;
  }

  private cameraErrorMessage(error: unknown): string {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError')
      return 'Permiso de cámara denegado en tu navegador.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError')
      return 'No se detectó ninguna cámara instalada.';
    if (name === 'NotReadableError')
      return 'La cámara está siendo usada por otra aplicación.';
    return errorMessage(error, 'Fallo de hardware al abrir la cámara.');
  }

  private sessionStartMs(session: AttendanceSession): number {
    const parsed = Date.parse(session.started_at);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  private sessionClosesAtMs(session: AttendanceSession): number {
    const parsed = Date.parse(session.closes_at);
    return Number.isFinite(parsed)
      ? parsed
      : this.sessionStartMs(session) + 10 * 60_000;
  }

  private isSessionOpen(session: AttendanceSession): boolean {
    const status = String(session.status ?? 'abierta').toLowerCase();
    return (
      !['cerrada', 'cerrado', 'closed'].includes(status) &&
      this.sessionClosesAtMs(session) > Date.now()
    );
  }

  private formatRecordDate(row: AttendanceHistoryRow): string {
    const ms = this.recordTimeMs(row);
    return Number.isFinite(ms) ? new Date(ms).toLocaleString('es-MX') : '--';
  }

  private recordTimeMs(record: AttendanceRecord): number {
    const parsed = Date.parse(record.registered_at);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private rosterStatus(record: AttendanceRecord | undefined): {
    label: string;
    tone: RosterTone;
  } {
    if (!record) return { label: 'AUSENTE', tone: 'danger' };
    if (this.isPresent(record.estado)) return { label: 'PRESENTE', tone: 'success' };
    if (this.isLate(record.estado)) return { label: 'RETARDO', tone: 'warning' };
    return { label: 'FALTA', tone: 'danger' };
  }

  private isPresent(value: string): boolean {
    return value.trim().toLowerCase() === 'presente';
  }

  private isLate(value: string): boolean {
    return value.trim().toLowerCase() === 'retardo';
  }

  private isAbsence(value: string): boolean {
    const n = value.trim().toLowerCase();
    return n === 'falta' || n === 'ausente';
  }
}
