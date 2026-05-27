import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';

@Component({
  selector: 'agm-reset-password-screen',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.screen.html',
  styleUrls: ['./reset-password.screen.scss']
})
export class ResetPasswordScreen implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(false);
  readonly success = signal(false);
  readonly error = signal('');
  readonly secureLinkToken = signal('');
  readonly recoveryEmail = signal('');

  readonly form = this.fb.nonNullable.group({
    token: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)]],
    confirm_password: ['', [Validators.required, Validators.minLength(8)]]
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    this.recoveryEmail.set(this.route.snapshot.queryParamMap.get('email') ?? '');
    if (token) {
      this.secureLinkToken.set(token);
      this.form.controls.token.clearValidators();
      this.form.controls.token.setValue('');
      this.form.controls.token.updateValueAndValidity();
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, document.title, '/auth/reset');
      }
    }
  }

  resetIntro(): string {
    const email = this.recoveryEmail();
    if (email) {
      return `Escribe el token enviado a ${email} y define una contrasena nueva.`;
    }
    return 'Escribe el token de recuperacion y una contrasena nueva. El token debe seguir vigente y no haber sido usado antes.';
  }

  passwordMismatch(): boolean {
    const values = this.form.getRawValue();
    return Boolean(values.confirm_password && values.new_password !== values.confirm_password);
  }

  submit(): void {
    if (this.form.invalid || this.passwordMismatch()) {
      this.form.markAllAsTouched();
      return;
    }

    const { new_password } = this.form.getRawValue();
    const token = this.secureLinkToken() || this.form.controls.token.value.trim();
    this.loading.set(true);
    this.error.set('');
    this.auth.resetPassword({ token, new_password }).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: () => {
        this.success.set(true);
        this.secureLinkToken.set('');
        this.form.reset();
        this.toasts.success('Contrasena actualizada');
      },
      error: (error: unknown) => this.error.set(errorMessage(error, 'No fue posible actualizar la contrasena.'))
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/auth/login']);
  }
}