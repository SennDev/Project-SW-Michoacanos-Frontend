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
  template: `
    <main class="auth-page">
      <section class="auth-flow-shell">
        <section class="auth-card auth-flow-card">
          <a routerLink="/" class="row brand-row">
            <span class="brand-mark">A</span>
            <span>
              <strong>AGM</strong>
              <small>Recuperacion de acceso</small>
            </span>
          </a>

          <div>
            <p class="section-kicker">Recuperar contrasena</p>
            <h1>Solicita un enlace seguro.</h1>
            <p class="muted">Si el correo existe, AGM generara una recuperacion valida por una hora.</p>
          </div>

          <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label for="recover-email">Correo institucional</label>
              <input id="recover-email" type="email" autocomplete="email" formControlName="email" placeholder="usuario@agm.local">
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <span class="field-error">Ingresa un correo valido.</span>
              }
            </div>

            @if (error()) {
              <div class="login-error" role="alert">{{ error() }}</div>
            }

            <button class="btn primary" type="submit" [disabled]="form.invalid || loading()">
              {{ loading() ? 'Enviando...' : 'Solicitar recuperacion' }}
            </button>
          </form>

          @if (submitted()) {
            <div class="success-panel" role="status">
              <strong>Solicitud registrada</strong>
              <span>Revisa tu correo institucional para continuar.</span>
              @if (resetToken()) {
                <small>En este entorno el backend devolvio un token util para pruebas locales.</small>
                <button class="btn ghost" type="button" (click)="continueWithToken()">Continuar con token</button>
              }
            </div>
          }

          <p class="auth-foot"><a routerLink="/auth/login">Volver al inicio de sesion</a></p>
        </section>
      </section>
    </main>
  `,
  styles: [`
    .auth-flow-shell {
      width: min(560px, 100%);
      margin: auto;
      display: grid;
    }

    .auth-flow-card {
      width: 100%;
      display: grid;
      gap: 24px;
    }

    .brand-row small {
      display: block;
      color: var(--agm-text-soft);
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(1.8rem, 4vw, 2.4rem);
      line-height: 1.05;
    }

    .login-error,
    .success-panel {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-radius: var(--agm-radius-sm);
    }

    .login-error {
      border: 1px solid color-mix(in srgb, var(--agm-danger) 30%, var(--agm-border));
      color: var(--agm-danger);
      background: var(--agm-danger-soft);
      font-weight: 700;
    }

    .success-panel {
      border: 1px solid color-mix(in srgb, var(--agm-success) 30%, var(--agm-border));
      background: var(--agm-success-soft);
    }

    .success-panel span,
    .success-panel small {
      color: var(--agm-text-soft);
    }

    .auth-foot {
      margin: 0;
      color: var(--agm-text-soft);
    }

    .auth-foot a {
      color: var(--agm-primary);
      font-weight: 800;
    }
  `]
})
export class RecoverPasswordScreen {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly resetToken = signal('');
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
      next: (response) => {
        this.submitted.set(true);
        this.resetToken.set(response?.reset_token ?? '');
        this.toasts.success('Solicitud enviada');
      },
      error: (error: unknown) => this.error.set(errorMessage(error, 'No fue posible solicitar la recuperacion.'))
    });
  }

  continueWithToken(): void {
    void this.router.navigate(['/auth/reset'], { queryParams: { token: this.resetToken() } });
  }
}
