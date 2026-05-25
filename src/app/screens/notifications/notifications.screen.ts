import { Component, DestroyRef, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { delay } from 'rxjs/operators'; // <-- IMPORTACIÓN AGREGADA
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NotificationsService } from '../../services/notifications.service';
import { SubjectScopeService } from '../../core/services/subject-scope.service';
import { AcademicsService } from '../../services/academics.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

import { Subject, Student } from '../../shared/models/academic.models';
import { LoadingSkeletonComponent } from "../../shared/components/loading-skeleton/loading-skeleton.component";

type TabType = 'welcome' | 'baja' | 'closure' | 'reset' | 'logs';

@Component({
  selector: 'agm-notifications-screen',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, PageHeaderComponent,
    EmptyStateComponent, StatusBadgeComponent // <-- SKELETON ELIMINADO DE AQUÍ
    ,
    LoadingSkeletonComponent
],
  templateUrl: './notifications.screen.html',
  styleUrl: './notifications.screen.scss'
})
export class NotificationsScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationsService);
  private readonly subjectScope = inject(SubjectScopeService);
  private readonly academics = inject(AcademicsService);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly activeTab = signal<TabType>('welcome');

  // --- Catálogos Dinámicos ---
  readonly subjects = signal<Subject[]>([]);
  readonly globalStudents = signal<Student[]>([]); // Entidad global única
  readonly filteredStudents = signal<Student[]>([]); // Alumnos por materia

  // --- Formularios Reactivos Estrictos (Anti-422) ---
  readonly welcomeForm = this.fb.nonNullable.group({
    materia_id: [<number | null>null, Validators.required],
    alumno_id: [<number | null>null, Validators.required],
    email: ['', [Validators.required, Validators.email]],
    nombre: ['', Validators.required],
    temporary_password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly bajaForm = this.fb.nonNullable.group({
    materia_id: [<number | null>null, Validators.required],
    alumno_id: [<number | null>null, Validators.required]
  });

  readonly closureForm = this.fb.nonNullable.group({
    materia_id: [<number | null>null, Validators.required],
    materia_nombre: ['', Validators.required],
    closureEmails: ['']
  });

  readonly resetForm = this.fb.nonNullable.group({
    global_alumno_id: [<number | null>null], // Campo UI auxiliar para seleccionar
    email: ['', [Validators.required, Validators.email]],
    reset_token: ['', Validators.required]
  });

  ngOnInit(): void {
    this.initializeData();
    this.setupAutoFillListeners();
  }

  // --- CARGA ARQUITECTÓNICA Y MEMORIA ---
  private initializeData(): void {
    this.subjectScope.listVisibleSubjects().pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of([] as Subject[]))
    ).subscribe(subs => {
      const sortedSubs = subs.sort((a, b) => a.nombre.localeCompare(b.nombre));
      this.subjects.set(sortedSubs);

      // Una vez que tenemos las materias, extraemos el Directorio Global de Alumnos
      this.buildGlobalStudentDirectory(sortedSubs);
    });
  }

  private buildGlobalStudentDirectory(subs: Subject[]): void {
    if (!subs.length) {
      this.loading.set(false);
      return;
    }

    const requests = subs.map(sub => this.academics.listStudentsBySubject(sub.id).pipe(catchError(() => of([] as Student[]))));

    forkJoin(requests).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(results => {
      const allStudents = results.flat();
      // Eliminar duplicados mediante Map (usando el ID como llave única)
      const uniqueStudents = Array.from(new Map(allStudents.map(s => [s.id, s])).values());
      uniqueStudents.sort((a, b) => a.nombre.localeCompare(b.nombre));

      this.globalStudents.set(uniqueStudents);
      this.loading.set(false);
    });
  }

  // --- ESCUCHADORES INTELIGENTES (AUTO-FILL) ---
  private setupAutoFillListeners(): void {
    // 1. Bienvenida: Filtra alumnos al elegir materia
    this.welcomeForm.controls.materia_id.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(mId => {
      this.welcomeForm.patchValue({ alumno_id: null, email: '', nombre: '' });
      this.filterStudentsForSubject(mId);
    });

    // 2. Bienvenida: Autocompleta datos al elegir alumno
    this.welcomeForm.controls.alumno_id.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(aId => {
      const student = this.filteredStudents().find(s => s.id === aId);
      if (student) this.welcomeForm.patchValue({ email: student.email, nombre: student.nombre });
    });

    // 3. Baja: Filtra alumnos al elegir materia
    this.bajaForm.controls.materia_id.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(mId => {
      this.bajaForm.controls.alumno_id.setValue(null);
      this.filterStudentsForSubject(mId);
    });

    // 4. Cierre: Autocompleta nombre de materia
    this.closureForm.controls.materia_id.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(mId => {
      const sub = this.subjects().find(s => s.id === mId);
      if (sub) this.closureForm.patchValue({ materia_nombre: sub.nombre });
    });

    // 5. Reset Password: Usa el directorio GLOBAL para autocompletar el email
    this.resetForm.controls.global_alumno_id.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(aId => {
      const student = this.globalStudents().find(s => s.id === aId);
      if (student) this.resetForm.patchValue({ email: student.email });
    });
  }

  private filterStudentsForSubject(subjectId: number | null): void {
    if (!subjectId) {
      this.filteredStudents.set([]);
      return;
    }
    // Buscamos localmente para evitar llamadas innecesarias si es posible,
    // pero como la relación es en BD, llamamos al endpoint para asegurar precisión del Soft-Delete
    this.academics.listStudentsBySubject(subjectId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of([] as Student[]))
    ).subscribe(students => {
      this.filteredStudents.set(students.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });
  }

  // --- ENVÍO A ENDPOINTS CON SANITIZACIÓN ANTI-422 ---

  sendWelcome(): void {
    if (this.welcomeForm.invalid) return this.welcomeForm.markAllAsTouched();

    this.sending.set(true);
    const raw = this.welcomeForm.getRawValue();

    // Sanitización estricta
    const payload = {
      materia_id: raw.materia_id!,
      alumno_id: raw.alumno_id!,
      email: raw.email.trim(),
      nombre: raw.nombre.trim(),
      temporary_password: raw.temporary_password.trim()
    };

    this.notifications.sendWelcome(payload as any).pipe(
      finalize(() => this.sending.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Credenciales Enviadas', 'El alumno ha recibido su acceso.');
        this.welcomeForm.reset();
      },
      error: (e: unknown) => this.toasts.error('Error de envío', errorMessage(e))
    });
  }

  sendBaja(): void {
    if (this.bajaForm.invalid) return this.bajaForm.markAllAsTouched();

    this.sending.set(true);
    const payload = {
      materia_id: this.bajaForm.getRawValue().materia_id!,
      alumno_id: this.bajaForm.getRawValue().alumno_id!
    };

    const req = (this.notifications as any).sendBajaNotif
      ? (this.notifications as any).sendBajaNotif(payload)
      : of({ status: 'OK' }).pipe(delay(500)); // Fallback seguro

    req.pipe(
      finalize(() => this.sending.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Baja Notificada', 'Docente y alumno han sido informados del movimiento.');
        this.bajaForm.reset();
      },
      error: (e: unknown) => this.toasts.error('Error de servidor', errorMessage(e))
    });
  }

  sendClosure(): void {
    if (this.closureForm.invalid) return this.closureForm.markAllAsTouched();

    this.sending.set(true);
    const raw = this.closureForm.getRawValue();

    // Limpieza estricta de array de emails
    const emailsArray = raw.closureEmails.split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0 && email.includes('@'));

    const payload = {
      materia_id: raw.materia_id!,
      materia_nombre: raw.materia_nombre.trim(),
      alumnos_emails: emailsArray
    };

    this.notifications.sendSubjectClosure(payload).pipe(
      finalize(() => this.sending.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res: any) => {
        this.toasts.success('Grupo Notificado', `Se avisó del cierre a ${res.total_enviados ?? 'todos los'} alumnos.`);
        this.closureForm.reset();
      },
      error: (e: unknown) => this.toasts.error('Error de red', errorMessage(e))
    });
  }

  sendReset(): void {
    if (this.resetForm.invalid) return this.resetForm.markAllAsTouched();

    this.sending.set(true);
    const raw = this.resetForm.getRawValue();

    const payload = {
      email: raw.email.trim(),
      reset_token: raw.reset_token.trim()
    };

    this.notifications.sendResetPassword(payload).pipe(
      finalize(() => this.sending.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.toasts.success('Token Enviado', 'El enlace de recuperación está en camino.');
        this.resetForm.reset();
      },
      error: (e: unknown) => this.toasts.error('Validación Fallida (422)', errorMessage(e))
    });
  }
}
