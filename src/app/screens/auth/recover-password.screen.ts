import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';

@Component({
  selector: 'agm-recover-password-screen',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recover-password.screen.html',
  styleUrls: ['./recover-password.screen.scss']
})
export class RecoverPasswordScreen {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.form.getRawValue()).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: () => {
        const email = this.form.controls.email.value.trim();
        this.submitted.set(true);
        this.toasts.success('Token enviado', 'Continua con el token recibido.');
        void this.router.navigate(['/auth/reset'], { queryParams: { email } });
      },
      error: (error: unknown) => this.error.set(errorMessage(error, 'No fue posible solicitar la recuperacion.'))
    });
  }
}