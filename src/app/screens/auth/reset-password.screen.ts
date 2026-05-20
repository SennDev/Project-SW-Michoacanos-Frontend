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
  template: `
    <main class="auth-page">
      <section class="auth-flow-shell">
        <section class="auth-card auth-flow-card">
          <a routerLink="/" class="row brand-row">
            <span class="brand-mark">A</span>
            <span>
              <strong>AGM</strong>
              <small>Nueva contrasena</small>
            </span>
          </a>

          <div>
            <p class="section-kicker">Restablecer acceso</p>
            <h1>Define tu nueva contrasena.</h1>
            <p class="muted">{{ resetIntro() }}</p>
          </div>

          <div class="flow-steps" aria-label="Proceso de recuperacion">
            <span class="done">1. Correo</span>
            <span class="active">2. Token</span>
            <span>3. Nueva contrasena</span>
          </div>

          @if (!success()) {
            <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
              @if (secureLinkToken()) {
                <div class="security-note" role="status">
                  <strong>Token de enlace detectado</strong>
                  <span>Se oculto del formulario y se retiro de la URL para reducir exposicion.</span>
                </div>
              } @else {
                <div class="field">
                  <label for="token">Token de recuperacion</label>
                  <input id="token" formControlName="token" autocomplete="one-time-code" spellcheck="false" placeholder="Pega aqui el token recibido">
                  @if (form.controls.token.touched && form.controls.token.invalid) {
                    <span class="field-error">Ingresa el token recibido.</span>
                  }
                </div>
              }

              <div class="field">
                <label for="new-password">Nueva contrasena</label>
                <input id="new-password" type="password" autocomplete="new-password" formControlName="new_password" placeholder="Minimo 8 caracteres">
                @if (form.controls.new_password.touched && form.controls.new_password.invalid) {
                  <span class="field-error">Usa al menos 8 caracteres e incluye letras y numeros.</span>
                }
              </div>

              <div class="field">
                <label for="confirm-password">Confirmar contrasena</label>
                <input id="confirm-password" type="password" autocomplete="new-password" formControlName="confirm_password" placeholder="Repite la nueva contrasena">
                @if (form.controls.confirm_password.touched && passwordMismatch()) {
                  <span class="field-error">Las contrasenas deben coincidir.</span>
                }
              </div>

              @if (error()) {
                <div class="login-error" role="alert">{{ error() }}</div>
              }

              <button class="btn primary" type="submit" [disabled]="form.invalid || passwordMismatch() || loading()">
                {{ loading() ? 'Actualizando...' : 'Actualizar contrasena' }}
              </button>
              <a class="btn ghost" routerLink="/auth/recover">Solicitar otro token</a>
            </form>
          } @else {
            <div class="success-panel" role="status">
              <strong>Contrasena actualizada</strong>
              <span>Ya puedes iniciar sesion con tu nueva contrasena.</span>
              <button class="btn ghost" type="button" (click)="goToLogin()">Ir al inicio de sesion</button>
            </div>
          }
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
    .success-panel,
    .security-note,
    .flow-steps {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-radius: var(--agm-radius-sm);
    }

    .flow-steps {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border: 1px solid var(--agm-border);
      background: var(--agm-surface-muted);
    }

    .flow-steps span {
      min-height: 34px;
      display: grid;
      place-items: center;
      border-radius: var(--agm-radius-sm);
      color: var(--agm-text-soft);
      font-size: var(--agm-font-size-sm);
      font-weight: 850;
      text-align: center;
    }

    .flow-steps span.active,
    .flow-steps span.done {
      color: var(--agm-primary);
      background: var(--agm-primary-soft);
    }

    .login-error {
      border: 1px solid color-mix(in srgb, var(--agm-danger) 30%, var(--agm-border));
      color: var(--agm-danger);
      background: var(--agm-danger-soft);
      font-weight: 700;
    }

    .success-panel,
    .security-note {
      border: 1px solid color-mix(in srgb, var(--agm-success) 30%, var(--agm-border));
      background: var(--agm-success-soft);
    }

    .success-panel span,
    .security-note span {
      color: var(--agm-text-soft);
    }

    @media (max-width: 560px) {
      .flow-steps {
        grid-template-columns: 1fr;
      }
    }
  `]
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
