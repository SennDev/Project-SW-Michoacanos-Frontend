import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';

@Component({
  selector: 'agm-login-screen',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.screen.html',
  styleUrls: ['./login.screen.scss']
})
export class LoginScreen {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['admin@agm.local', [Validators.required, Validators.email]],
    password: ['Admin123!', [Validators.required, Validators.minLength(6)]]
  });

  readonly roles = [
    { title: 'Admin', copy: 'Importaciones, salud del sistema y reportes.' },
    { title: 'Docente', copy: 'Ponderaciones, asistencia QR y concentrados.' },
    { title: 'Alumno', copy: 'Calificaciones, asistencias y reportes.' }
  ];

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form.getRawValue()).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (user) => {
        this.toasts.success('Bienvenido', user.display_name || user.email);
        void this.router.navigate(['/dashboard']);
      },
      error: (error: unknown) => this.error.set(errorMessage(error, 'Credenciales invalidas.'))
    });
  }

  fillDevCredentials(): void {
    this.form.setValue({ email: 'admin@agm.local', password: 'Admin123!' });
  }
}