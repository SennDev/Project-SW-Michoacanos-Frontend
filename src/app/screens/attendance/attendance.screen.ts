import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { PeriodsService } from '../../services/periods.service';
import { AttendanceService } from '../../services/attendance.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { AttendanceRecord, AttendanceSession, QrPayload } from '../../shared/models/attendance.models';
import { Subject } from '../../shared/models/academic.models';
import { TableColumn } from '../../shared/models/ui.models';

@Component({
  selector: 'agm-attendance-screen',
  standalone: true,
  imports: [FormsModule, SlicePipe, PageHeaderComponent, KpiCardComponent, SearchableTableComponent, LoadingSkeletonComponent, EmptyStateComponent],
  template: `
    <agm-page-header
      eyebrow="Asistencias"
      title="Sesiones QR y registro de asistencia"
      description="Inicia sesiones, genera QR para alumnos y registra presentes o retardos usando los endpoints REST de ms-attendance."
    >
      <button class="btn ghost" type="button" (click)="reload()">Actualizar</button>
    </agm-page-header>

    @if (loading()) {
      <agm-loading-skeleton [rows]="6" />
    } @else {
      <section class="grid-4">
        <agm-kpi-card label="Materias" [value]="subjects().length" tone="primary" />
        <agm-kpi-card label="Sesiones locales" [value]="sessions().length" tone="warning" />
        <agm-kpi-card label="Registros" [value]="history().length" tone="success" />
        <agm-kpi-card label="Presentes" [value]="presentCount()" tone="success" />
      </section>

      <section class="attendance-stage">
        <div>
          <span class="status-badge" [class]="activeSession() ? 'success' : 'neutral'">
            {{ activeSession() ? 'Sesion activa' : 'Sin sesion local activa' }}
          </span>
          <h2>{{ activeSession() ? 'Sesion #' + activeSession()?.session_id : 'Control QR listo para iniciar' }}</h2>
          <p>
            El backend mantiene sesiones temporales y tokens firmados. Docentes inician la sesion y registran el token;
            alumnos generan su QR con el ID de sesion activo.
          </p>
        </div>
        <div class="session-display">
          <span>ID de sesion</span>
          <strong>{{ activeSession()?.session_id || '--' }}</strong>
          <small>Cierre: {{ activeSession()?.closes_at ? (activeSession()?.closes_at | slice:0:16) : 'Pendiente' }}</small>
        </div>
      </section>

      <section class="grid-3" style="margin-top: 18px;">
        <article class="panel pad interactive">
          <h2 class="panel-title">Materia</h2>
          <div class="field">
            <label>Selecciona una materia</label>
            <select [ngModel]="selectedSubjectId()" (ngModelChange)="selectSubject($event)">
              <option [ngValue]="null">Sin seleccion</option>
              @for (subject of subjects(); track subject.id) {
                <option [ngValue]="subject.id">{{ subject.nrc }} - {{ subject.nombre }}</option>
              }
            </select>
          </div>
          @if (selectedSubject()) {
            <div class="divider"></div>
            <strong>{{ selectedSubject()?.nombre }}</strong>
            <p class="muted">{{ selectedSubject()?.docente_nombre || 'Docente pendiente' }}</p>
          }
        </article>

        @if (canManage()) {
          <article class="panel pad interactive">
            <h2 class="panel-title">Control docente</h2>
            <div class="stack">
              <button class="btn primary" type="button" [disabled]="starting()" (click)="startSession()">
                {{ starting() ? 'Iniciando...' : 'Iniciar sesion QR' }}
              </button>
              @if (activeSession()) {
                <div class="teacher-session-card">
                  <strong>Comparte el ID {{ activeSession()?.session_id }}</strong>
                  <span>El alumno genera su QR desde su cuenta y el docente registra el token escaneado.</span>
                </div>
              }
              <div class="field">
                <label>Token QR escaneado</label>
                <textarea rows="4" [(ngModel)]="qrToken" placeholder="Pega aqui el token del alumno"></textarea>
              </div>
              <button class="btn ghost" type="button" [disabled]="registering()" (click)="registerAttendance()">Registrar asistencia</button>
            </div>
          </article>
        }

        @if (isStudent()) {
          <article class="panel pad interactive qr-card">
            <h2 class="panel-title">Mi QR</h2>
            <div class="field">
              <label>ID de sesion activa</label>
              <input type="number" [(ngModel)]="studentSessionId">
            </div>
            <button class="btn primary" type="button" [disabled]="generatingQr()" (click)="generateQr()">Generar QR</button>
            @if (qrPayload()) {
              <div class="qr-frame">
                <img class="qr-image" [src]="'data:image/png;base64,' + qrPayload()?.qr_png_base64" alt="QR de asistencia">
                <span class="status-badge success">QR generado</span>
              </div>
              <textarea rows="3" readonly [value]="qrPayload()?.token"></textarea>
            }
          </article>
        }

        <article class="panel pad interactive">
          <h2 class="panel-title">Sesiones recientes</h2>
          @if (sessions().length) {
            <div class="metric-list">
              @for (session of sessions(); track session.session_id) {
                <div class="metric-row">
                  <span>#{{ session.session_id }} | {{ session.closes_at | slice:0:16 }}</span>
                  <button class="btn ghost small" type="button" [disabled]="session.status === 'cerrada'" (click)="closeSession(session)">Cerrar</button>
                </div>
              }
            </div>
          } @else {
            <agm-empty-state title="Sin sesiones locales" message="El backend no expone listado de sesiones; AGM conserva las creadas desde este navegador." />
          }
        </article>
      </section>

      <section style="margin-top: 18px;">
        <agm-searchable-table
          [rows]="history()"
          [columns]="historyColumns"
          placeholder="Buscar por alumno, sesion o estado"
          emptyTitle="Sin asistencias"
          emptyMessage="Cuando se registren QR para esta materia apareceran aqui."
        />
      </section>
    }
  `,
  styles: [`
    .attendance-stage {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 18px;
      align-items: center;
      margin-top: 18px;
      padding: 22px;
      border: 1px solid color-mix(in srgb, var(--agm-secondary) 22%, var(--agm-border));
      border-radius: var(--agm-radius-lg);
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--agm-primary-soft) 78%, white), var(--agm-surface));
      box-shadow: var(--agm-shadow-soft);
    }

    .attendance-stage h2 {
      margin: 12px 0 8px;
      font-size: clamp(1.45rem, 3vw, 2.2rem);
      line-height: 1.1;
      letter-spacing: 0;
    }

    .attendance-stage p {
      max-width: 820px;
      margin: 0;
      color: var(--agm-text-soft);
      line-height: 1.65;
    }

    .session-display {
      display: grid;
      place-items: center;
      gap: 4px;
      min-height: 150px;
      border-radius: var(--agm-radius);
      color: white;
      background: linear-gradient(145deg, var(--agm-primary), var(--agm-secondary));
      box-shadow: var(--agm-shadow-soft);
      text-align: center;
    }

    .session-display span,
    .session-display small {
      color: rgba(255, 255, 255, 0.72);
      font-weight: 750;
    }

    .session-display strong {
      font-size: 3rem;
      line-height: 1;
    }

    .teacher-session-card {
      display: grid;
      gap: 5px;
      padding: 13px;
      border-radius: var(--agm-radius-sm);
      background: var(--agm-accent-soft);
      color: #1f2937;
    }

    .teacher-session-card span {
      color: #475569;
      font-size: 0.84rem;
      line-height: 1.45;
    }

    .qr-card textarea {
      margin-top: 12px;
    }

    .qr-frame {
      display: grid;
      place-items: center;
      gap: 10px;
      margin-top: 14px;
      padding: 16px;
      border-radius: var(--agm-radius);
      background:
        linear-gradient(180deg, var(--agm-surface), var(--agm-primary-soft));
    }

    .qr-image {
      width: 180px;
      height: 180px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius);
      background: white;
      padding: 10px;
    }

    @media (max-width: 720px) {
      .attendance-stage {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AttendanceScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly periods = inject(PeriodsService);
  private readonly attendance = inject(AttendanceService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly starting = signal(false);
  readonly registering = signal(false);
  readonly generatingQr = signal(false);
  readonly subjects = signal<Subject[]>([]);
  readonly selectedSubjectId = signal<number | null>(null);
  readonly sessions = signal<AttendanceSession[]>([]);
  readonly history = signal<AttendanceRecord[]>([]);
  readonly qrPayload = signal<QrPayload | null>(null);

  qrToken = '';
  studentSessionId: number | null = null;

  readonly historyColumns: TableColumn<AttendanceRecord>[] = [
    { key: 'session_id', header: 'Sesion' },
    { key: 'student_id', header: 'Alumno ID' },
    { key: 'estado', header: 'Estado', badge: (row) => row.estado },
    { key: 'registered_at', header: 'Registrado', formatter: (row) => new Date(row.registered_at).toLocaleString() }
  ];

  ngOnInit(): void {
    this.reload();
  }

  isStudent(): boolean {
    return this.auth.role() === 'alumno';
  }

  canManage(): boolean {
    return this.auth.role() === 'admin' || this.auth.role() === 'docente';
  }

  selectedSubject(): Subject | undefined {
    return this.subjects().find((subject) => subject.id === this.selectedSubjectId());
  }

  activeSession(): AttendanceSession | undefined {
    return this.sessions().find((session) => session.status !== 'cerrada') ?? this.sessions()[0];
  }

  presentCount(): number {
    return this.history().filter((record) => record.estado === 'Presente').length;
  }

  reload(): void {
    this.loading.set(true);
    this.periods.listSubjects(undefined, 1, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        const initial = this.selectedSubjectId() ?? subjects[0]?.id ?? null;
        this.selectedSubjectId.set(initial);
        if (initial) {
          this.loadAttendance(initial, true);
        } else {
          this.loading.set(false);
        }
      },
      error: (error: unknown) => {
        this.toasts.error('No se cargaron materias', errorMessage(error));
        this.loading.set(false);
      }
    });
  }

  selectSubject(id: number | null): void {
    this.selectedSubjectId.set(id);
    this.qrPayload.set(null);
    if (id) {
      this.loadAttendance(id);
    } else {
      this.sessions.set([]);
      this.history.set([]);
    }
  }

  loadAttendance(subjectId: number, finishLoading = false): void {
    this.sessions.set(this.attendance.getLocalSessions(subjectId));
    this.attendance.attendanceHistory(subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (history) => {
        this.history.set(history);
        if (finishLoading) {
          this.loading.set(false);
        }
      },
      error: () => {
        this.history.set([]);
        if (finishLoading) {
          this.loading.set(false);
        }
      }
    });
  }

  startSession(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) {
      this.toasts.warning('Selecciona una materia');
      return;
    }
    this.starting.set(true);
    this.attendance.startSession(subjectId).pipe(
      finalize(() => this.starting.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (session) => {
        this.toasts.success('Sesion iniciada', `ID ${session.session_id}`);
        this.studentSessionId = session.session_id;
        this.sessions.set(this.attendance.getLocalSessions(subjectId));
      },
      error: (error: unknown) => this.toasts.error('No se inicio la sesion', errorMessage(error))
    });
  }

  registerAttendance(): void {
    if (!this.qrToken.trim()) {
      this.toasts.warning('Pega un token QR');
      return;
    }
    const subjectId = this.selectedSubjectId();
    this.registering.set(true);
    this.attendance.registerAttendance(this.qrToken.trim()).pipe(
      finalize(() => this.registering.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.toasts.success('Asistencia registrada', result.estado);
        this.qrToken = '';
        if (subjectId) {
          this.loadAttendance(subjectId);
        }
      },
      error: (error: unknown) => this.toasts.error('No se registro asistencia', errorMessage(error))
    });
  }

  closeSession(session: AttendanceSession): void {
    const subjectId = this.selectedSubjectId();
    this.attendance.closeSession(session.session_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toasts.success('Sesion cerrada');
        if (subjectId) {
          this.sessions.set(this.attendance.getLocalSessions(subjectId));
        }
      },
      error: (error: unknown) => this.toasts.error('No se cerro la sesion', errorMessage(error))
    });
  }

  generateQr(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId || !this.studentSessionId) {
      this.toasts.warning('Selecciona materia y sesion');
      return;
    }
    this.generatingQr.set(true);
    this.attendance.generateQr(subjectId, Number(this.studentSessionId)).pipe(
      finalize(() => this.generatingQr.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (payload) => this.qrPayload.set(payload),
      error: (error: unknown) => this.toasts.error('No se genero QR', errorMessage(error))
    });
  }
}
