import { Component, DestroyRef, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, interval, of, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { AcademicsService } from '../../services/academics.service';
import { GradesService } from '../../services/grades.service';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { FileUploadCardComponent } from '../../shared/components/file-upload-card/file-upload-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';

import { Student, Subject } from '../../shared/models/academic.models';
import { GradeSummary, LocalActivity, WeightCategory } from '../../shared/models/grade.models';

interface WeightDraft {
  nombre: string;
  porcentaje: number;
}

@Component({
  selector: 'agm-grades-screen',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, PageHeaderComponent, KpiCardComponent,
    FileUploadCardComponent, EmptyStateComponent,
    LoadingSkeletonComponent
  ],
  templateUrl: './grades.screen.html',
  styleUrl: './grades.screen.scss'
})
export class GradesScreen implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  public readonly auth = inject(AuthService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly academics = inject(AcademicsService);
  private readonly grades = inject(GradesService);
  private readonly toasts = inject(ToastService);

  // --- ESTADOS GLOBALES ---
  readonly loading = signal(true);
  readonly savingWeights = signal(false);
  readonly creatingActivity = signal(false);
  readonly importingGrades = signal(false);

  readonly subjects = signal<Subject[]>([]);
  readonly selectedSubjectId = signal<number | null>(null);

  readonly weights = signal<WeightCategory[]>([]);
  readonly weightDraft = signal<WeightDraft[]>([]);
  readonly activities = signal<LocalActivity[]>([]);
  readonly summary = signal<GradeSummary[]>([]);
  readonly students = signal<Student[]>([]);

  // --- ESTADOS DE UI ---
  // Nueva navegación superior para el Docente
  readonly teacherTab = signal<'config' | 'capture' | 'matrix'>('config');

  // --- SISTEMA DE CAPTURA DOCENTE ---
  readonly draftScores = signal<Record<number, number | null>>({});
  // Caché Maestro: Guarda las calificaciones extraídas del backend { actividadId: { alumnoId: calificacion } }
  readonly confirmedScores = signal<Record<number, Record<number, number>>>({});

  readonly savingStudentIds = signal<number[]>([]);
  readonly savingBatch = signal(false);
  readonly lastSavedAt = signal<Date | null>(null);
  readonly syncing = signal(false);
  readonly lastSyncedAt = signal<Date | null>(null);

  activityCategoryId: number | null = null;
  activityName = '';
  activityMaxPoints = 100;
  selectedActivityId: number | null = null;
  private pollSubscription?: Subscription;

  // --- SISTEMA MODO SIMULACIÓN (ALUMNOS) ---
  readonly simulationMode = signal(false);
  readonly simulatedScores = signal<Record<number, number | undefined>>({});

  // --- COMPUTADOS ---
  readonly isTeacher = computed(() => this.auth.role() === 'admin' || this.auth.role() === 'docente');
  readonly isStudent = computed(() => this.auth.role() === 'alumno');

  readonly weightTotal = computed(() => Math.round(this.weightDraft().reduce((sum, item) => sum + Number(item.porcentaje || 0), 0) * 100) / 100);

  readonly visibleSummary = computed(() => {
    const summary = this.summary();
    const user = this.auth.user();
    return this.isStudent() && user?.profile_id
      ? summary.filter((row) => row.alumno_id === user.profile_id)
      : summary;
  });

  readonly myStudentData = computed(() => {
    if (!this.isStudent()) return null;
    const profileId = this.auth.user()?.profile_id;
    const student = this.students().find(s => s.id === profileId);
    const sum = this.visibleSummary()[0];
    return {
      id: profileId || 0,
      matricula: student?.matricula || this.auth.user()?.email?.split('@')[0] || 'N/D',
      nombre: student?.nombre || 'Alumno',
      calificacion: sum ? sum.promedio_redondeado : '--',
      calificacionReal: sum ? sum.promedio_real : 0
    };
  });

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  canEdit(): boolean {
    return this.isTeacher();
  }

  // --- LÓGICA DE APROBACIÓN (ESCALA 6.0 / 60) ---
  isPassing(score: number | string): boolean {
    const val = Number(score);
    if (isNaN(val)) return false;
    return val >= 6.0 || val >= 60;
  }

  getPassFailTone(score: number | string): 'success' | 'danger' | 'warning' {
    if (score === '--' || score === null) return 'warning';
    return this.isPassing(score) ? 'success' : 'danger';
  }

  selectedSubject(): Subject | undefined {
    return this.subjects().find((subject) => subject.id === this.selectedSubjectId());
  }

  groupAverage(): number {
    const rows = this.visibleSummary();
    if (!rows.length) return 0;
    return Math.round((rows.reduce((sum, row) => sum + row.promedio_real, 0) / rows.length) * 10) / 10;
  }

  reload(): void {
    this.loading.set(true);
    this.subjectScope.listVisibleSubjects().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        const sortedSubs = subjects.sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.subjects.set(sortedSubs);
        const initial = this.selectedSubjectId() ?? sortedSubs[0]?.id ?? null;
        this.selectedSubjectId.set(initial);
        if (initial) {
          this.loadSubjectData(initial, true);
          this.startPolling(initial);
        } else {
          this.stopPolling();
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
    if (id) {
      this.loadSubjectData(id);
      this.startPolling(id);
    } else {
      this.stopPolling();
      this.weights.set([]);
      this.weightDraft.set([]);
      this.activities.set([]);
      this.summary.set([]);
      this.students.set([]);
      this.draftScores.set({});
    }
  }

  loadSubjectData(subjectId: number, finishLoading = false): void {
    this.syncing.set(true);
    forkJoin({
      weights: this.grades.listWeights(subjectId).pipe(catchError(() => of([] as WeightCategory[]))),
      summary: this.grades.getConcentrado(subjectId).pipe(catchError(() => of([] as GradeSummary[]))),
      students: this.academics.listStudentsBySubject(subjectId).pipe(catchError(() => of([] as Student[]))),
      activities: of(this.grades.getLocalActivities(subjectId))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ weights, summary, students, activities }) => {
        this.weights.set(weights);
        this.weightDraft.set(weights.map((w) => ({ nombre: w.nombre, porcentaje: w.porcentaje })));
        this.summary.set(summary);
        this.students.set(students.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.activities.set(activities);

        // EXTRACCIÓN DINÁMICA DE CALIFICACIONES INDIVIDUALES DESDE EL BACKEND
        const newConfirmed: Record<number, Record<number, number>> = {};
        summary.forEach(sum => {
          // Buscamos cualquier arreglo de notas (actividades, calificaciones, scores) que mande el backend
          const scoresArray = (sum as any).calificaciones || (sum as any).actividades || (sum as any).scores || [];
          scoresArray.forEach((c: any) => {
            const actId = c.actividad_id || c.id || c.activity_id;
            const pts = c.puntaje ?? c.score ?? c.calificacion ?? c.puntos;
            if (actId !== undefined && pts !== undefined) {
              if (!newConfirmed[actId]) newConfirmed[actId] = {};
              newConfirmed[actId][sum.alumno_id] = Number(pts);
            }
          });
        });

        // Combinamos lo que haya en la caché visual actual con lo nuevo que llegó
        this.confirmedScores.update(curr => ({ ...curr, ...newConfirmed }));

        const stillExists = activities.some((a) => a.id === this.selectedActivityId);
        this.selectedActivityId = stillExists ? this.selectedActivityId : activities[0]?.id ?? null;

        this.lastSyncedAt.set(new Date());
        this.syncing.set(false);
        if (finishLoading) this.loading.set(false);
      },
      error: (error: unknown) => {
        this.toasts.warning('Aviso', 'Algunos datos del periodo están incompletos.');
        this.syncing.set(false);
        if (finishLoading) this.loading.set(false);
      }
    });
  }

  // --- GUARDIÁN DE POLLING (Evita el crasheo al escribir) ---
  hasWeightChanges(): boolean {
    const saved = this.weights();
    const draft = this.weightDraft();
    if (saved.length !== draft.length) return true;
    return draft.some((d, i) => d.nombre !== saved[i].nombre || Number(d.porcentaje) !== Number(saved[i].porcentaje));
  }

  // --- LÓGICA DE PONDERACIONES ---
  addWeight(): void {
    this.weightDraft.update((items) => [...items, { nombre: '', porcentaje: 0 }]);
  }

  removeWeight(index: number): void {
    this.weightDraft.update((items) => items.filter((_, i) => i !== index));
  }

  updateWeightName(index: number, name: string): void {
    this.weightDraft.update((items) => {
      const newItems = [...items];
      newItems[index].nombre = name;
      return newItems;
    });
  }

  updateWeightPercentage(index: number, pct: number | string): void {
    this.weightDraft.update((items) => {
      const newItems = [...items];
      newItems[index].porcentaje = Number(pct) || 0;
      return newItems;
    });
  }

  saveWeights(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId) return;

    const drafts = this.weightDraft().map(w => ({
      nombre: w.nombre.trim(),
      porcentaje: Number(w.porcentaje) || 0
    }));

    if (drafts.some(w => !w.nombre)) return this.toasts.warning('Faltan Datos', 'Todas las categorías deben tener un nombre.');
    if (drafts.some(w => w.porcentaje <= 0)) return this.toasts.warning('Porcentaje Inválido', 'Elimina las categorías vacías.');
    if (this.weightTotal() !== 100) return this.toasts.warning('Suma Incorrecta', 'El total debe ser exactamente 100%.');

    this.savingWeights.set(true);
    this.grades.saveWeights(subjectId, { items: drafts }).pipe(
      finalize(() => this.savingWeights.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Ponderaciones guardadas');
        this.loadSubjectData(subjectId);
      },
      error: (error: unknown) => this.toasts.error('Error al guardar', errorMessage(error))
    });
  }

  createActivity(): void {
    const subjectId = this.selectedSubjectId();
    if (!subjectId || !this.activityCategoryId || !this.activityName.trim()) {
      return this.toasts.warning('Revisa los datos de la actividad');
    }
    this.creatingActivity.set(true);
    this.grades.createActivity({
      materia_id: subjectId,
      categoria_id: this.activityCategoryId,
      nombre: this.activityName.trim(),
      max_puntos: Number(this.activityMaxPoints || 100)
    }).pipe(
      finalize(() => this.creatingActivity.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.toasts.success('Actividad creada exitosamente');
        this.activityName = '';
        this.selectedActivityId = response.id;
        this.loadSubjectData(subjectId);
      },
      error: (error: unknown) => this.toasts.error('Error al crear actividad', errorMessage(error))
    });
  }

  importGrades(file: File): void {
    const activityId = this.selectedActivityId;
    const subjectId = this.selectedSubjectId();
    if (!activityId || !subjectId) return this.toasts.warning('Selecciona una actividad primero');

    this.importingGrades.set(true);
    this.grades.importGrades(activityId, file).pipe(
      finalize(() => this.importingGrades.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        this.toasts.success('Importación exitosa', `${result.actualizadas} calificaciones cargadas.`);
        this.loadSubjectData(subjectId);
      },
      error: (error: unknown) => this.toasts.error('Fallo al importar', errorMessage(error))
    });
  }

  selectActivity(activityId: number | null): void {
    this.selectedActivityId = activityId;
    this.draftScores.set({});
  }

  selectedActivity(): LocalActivity | undefined {
    return this.activities().find((activity) => activity.id === this.selectedActivityId);
  }

  categoryName(categoryId: number): string {
    return this.weights().find((w) => w.id === categoryId)?.nombre ?? 'Categoría';
  }

  // --- OBTENCIÓN UNIVERSAL DE CALIFICACIONES ---
  getScoreForMatrix(activityId: number, studentId: number): string | number {
    const confirmed = this.confirmedScores()[activityId]?.[studentId];
    return confirmed !== undefined ? confirmed : '--';
  }

  displayScore(studentId: number): number | string {
    const actId = this.selectedActivityId;
    const draft = this.draftScores()[studentId];
    if (draft !== undefined) return draft === null ? '' : draft;
    if (!actId) return '';
    const confirmed = this.confirmedScores()[actId]?.[studentId];
    return confirmed !== undefined ? confirmed : '';
  }

  updateGradeDraft(studentId: number, value: string): void {
    let parsed = value === '' ? null : Number(value);
    const maxPoints = this.selectedActivity()?.max_puntos || 100;

    if (parsed !== null && !Number.isNaN(parsed)) {
      // Validar límite superior
      if (parsed > maxPoints) {
        this.toasts.warning(
          'Límite excedido', 
          `El puntaje máximo para esta actividad es de ${maxPoints} puntos.`
        );
        parsed = maxPoints; // Auto-ajusta al límite máximo
      } 
      // Validar límite inferior (no números negativos)
      else if (parsed < 0) {
        parsed = 0;
      }
    }

    this.draftScores.update((drafts) => ({ 
      ...drafts, 
      [studentId]: Number.isNaN(parsed as number) ? null : parsed 
    }));
  }

  captureAverage(): string {
    const actId = this.selectedActivityId;
    if (!actId) return '--';

    const scores = this.students()
      .map(student => {
        const draft = this.draftScores()[student.id];
        if (typeof draft === 'number') return draft;
        return this.confirmedScores()[actId]?.[student.id];
      })
      .filter((score): score is number => typeof score === 'number');

    if (!scores.length) return '--';
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1);
  }

  hasDrafts(): boolean {
    return Object.values(this.draftScores()).some((score) => typeof score === 'number');
  }

  pendingDraftCount(): number {
    return Object.values(this.draftScores()).filter((score) => typeof score === 'number').length;
  }

  savingStudent(studentId: number): boolean {
    return this.savingStudentIds().includes(studentId);
  }

  saveStudentGrade(student: Student): void {
    const subjectId = this.selectedSubjectId();
    const activity = this.selectedActivity();
    const score = this.draftScores()[student.id];

    if (!subjectId || !activity || typeof score !== 'number') return;

    this.savingStudentIds.update((ids) => [...ids, student.id]);
    this.grades.upsertGrade({ activity_id: activity.id, student_id: student.id, score }).pipe(
      finalize(() => this.savingStudentIds.update((ids) => ids.filter((id) => id !== student.id))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.lastSavedAt.set(new Date());

        // Forzamos el guardado en la caché visual para que persista
        this.confirmedScores.update(cs => {
          const next = { ...cs };
          if (!next[activity.id]) next[activity.id] = {};
          next[activity.id][student.id] = score;
          return next;
        });

        this.draftScores.update(drafts => {
          const next = { ...drafts };
          delete next[student.id];
          return next;
        });

        this.toasts.success('Calificación Fijada');
        this.loadSubjectData(subjectId); // Recargamos para actualizar promedios
      },
      error: (err: unknown) => this.toasts.error('Error al fijar', errorMessage(err))
    });
  }

  saveDraftGrades(): void {
    const subjectId = this.selectedSubjectId();
    const activity = this.selectedActivity();

    const payloads = Object.entries(this.draftScores())
      .filter(([, score]) => typeof score === 'number')
      .map(([studentId, score]) => ({
        activity_id: activity?.id ?? 0,
        student_id: Number(studentId),
        score: Number(score)
      }));

    if (!subjectId || !activity || !payloads.length) return;

    this.savingBatch.set(true);
    forkJoin(payloads.map((payload) => this.grades.upsertGrade(payload))).pipe(
      finalize(() => this.savingBatch.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.lastSavedAt.set(new Date());

        this.confirmedScores.update(cs => {
          const next = { ...cs };
          if (!next[activity.id]) next[activity.id] = {};
          payloads.forEach(p => { next[activity.id][p.student_id] = p.score; });
          return next;
        });

        this.draftScores.set({});
        this.toasts.success('Lote Procesado', `Se guardaron ${payloads.length} calificaciones.`);
        this.loadSubjectData(subjectId);
      },
      error: (err: unknown) => this.toasts.error('Error de lote', errorMessage(err))
    });
  }

  saveStatusLabel(): string {
    if (this.savingBatch() || this.savingStudentIds().length) return 'Guardando en la nube...';
    if (this.syncing()) return 'Sincronizando con el servidor...';
    const lastSavedAt = this.lastSavedAt();
    if (lastSavedAt) return `Guardado a las ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return 'Listo para capturar';
  }

  // --- LÓGICA MODO SIMULACIÓN ALUMNO ---
  toggleSimulation(): void {
    if (this.simulationMode()) {
      this.simulationMode.set(false);
      this.simulatedScores.set({});
    } else {
      this.simulationMode.set(true);
    }
  }

  updateSimulatedScore(activityId: number, value: string): void {
    const score = value === '' ? 0 : Number(value);
    this.simulatedScores.update(sim => ({ ...sim, [activityId]: score }));
  }

  studentSimulatedAverage(): string {
    const baseData = this.myStudentData();
    if (!baseData) return '--';

    let totalScore = 0;
    const acts = this.activities();
    if (acts.length === 0) return baseData.calificacion.toString();

    // Promedio dinámico para simulación
    acts.forEach(act => {
      // Intenta usar la simulada, si no existe usa la real, si no existe usa 0
      let currentVal = this.simulatedScores()[act.id];
      if (currentVal === undefined) {
         const realVal = this.getScoreForMatrix(act.id, baseData.id);
         currentVal = realVal === '--' ? 0 : Number(realVal);
      }
      totalScore += (currentVal / act.max_puntos) * 10;
    });

    return (totalScore / acts.length).toFixed(1);
  }

  private startPolling(subjectId: number): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.hasDrafts() && !this.savingBatch() && !this.savingStudentIds().length && !this.hasWeightChanges()) {
        this.loadSubjectData(subjectId);
      }
    });
  }

  private stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = undefined;
  }


  studentAverage(studentId: number): number | string {

  const row = this.summary().find(
    (item) => item.alumno_id === studentId
  );

  if (!row) {
    return '--';
  }

  return Math.round(row.promedio_real * 10) / 10;
}
}
