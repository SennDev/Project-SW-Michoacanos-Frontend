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
  template: `
    <main class="auth-page">
      <section class="login-shell">
        <aside class="login-story">
          <a routerLink="/" class="row brand-row">
            <span class="brand-mark">A</span>
            <span>
              <strong>AGM</strong>
              <small>Academic Grade Management</small>
            </span>
          </a>
          <div>
            <p class="section-kicker">Acceso institucional</p>
            <h1>Gestion academica clara, segura y conectada.</h1>
            <p>
              Ingresa al panel segun tu rol para administrar periodos, registrar asistencias QR,
              capturar calificaciones y generar reportes.
            </p>
          </div>
          <div class="role-hints" aria-label="Roles disponibles">
            @for (role of roles; track role.title) {
              <article>
                <strong>{{ role.title }}</strong>
                <span>{{ role.copy }}</span>
              </article>
            }
          </div>
        </aside>

        <section class="auth-card">
          <div>
            <p class="section-kicker">Bienvenido</p>
            <h2>Iniciar sesion</h2>
            <p class="login-copy">Usa tus credenciales institucionales para continuar.</p>
          </div>

        <form class="form-grid login-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Correo institucional</label>
            <input id="email" type="email" autocomplete="email" formControlName="email" placeholder="admin@agm.local">
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <span class="field-error">Ingresa un correo valido.</span>
            }
          </div>

          <div class="field">
            <label for="password">Contrasena</label>
            <input id="password" type="password" autocomplete="current-password" formControlName="password" placeholder="Admin123!">
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <span class="field-error">La contrasena debe tener al menos 6 caracteres.</span>
            }
          </div>

          <a class="forgot-link" routerLink="/auth/recover">Olvide mi contrasena</a>

          @if (error()) {
            <div class="login-error" role="alert">{{ error() }}</div>
          }

          <button class="btn primary" type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Entrando...' : 'Iniciar sesion' }}
          </button>

          <button class="btn ghost" type="button" (click)="fillDevCredentials()">
            Usar credenciales dev
          </button>
        </form>

        <p class="auth-foot">
          SPA conectada a microservicios REST locales. <a routerLink="/">Volver al inicio</a>
        </p>
        </section>
      </section>
    </main>
  `,
  styles: [`
    .login-shell {
      width: min(1120px, 100%);
      margin: auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 440px);
      gap: 28px;
      align-items: stretch;
    }

    .login-story {
      display: grid;
      align-content: space-between;
      gap: 34px;
      min-height: 620px;
      padding: 34px;
      border: 1px solid color-mix(in srgb, var(--agm-primary) 18%, var(--agm-border));
      border-radius: var(--agm-radius-lg);
      color: #ffffff;
      background:
        linear-gradient(135deg, rgba(244, 180, 0, 0.16), transparent 38%),
        linear-gradient(145deg, var(--agm-primary-strong), var(--agm-primary) 48%, var(--agm-secondary));
      box-shadow: var(--agm-shadow);
      overflow: hidden;
      position: relative;
    }

    .login-story::after {
      content: '';
      position: absolute;
      right: 34px;
      bottom: 34px;
      width: 220px;
      height: 220px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 32px;
      transform: rotate(10deg);
    }

    .brand-row {
      position: relative;
      z-index: 1;
    }

    .brand-row small,
    .login-story p {
      color: rgba(255, 255, 255, 0.78);
    }

    h1,
    h2 {
      margin: 0;
      letter-spacing: 0;
    }

    h1 {
      position: relative;
      z-index: 1;
      max-width: 680px;
      font-size: clamp(2.3rem, 5vw, 4rem);
      line-height: 1.02;
    }

    h2 {
      font-size: 2rem;
      line-height: 1.08;
    }

    .login-copy {
      margin: 8px 0 0;
      color: var(--agm-text-soft);
    }

    .role-hints {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .role-hints article {
      min-height: 110px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: var(--agm-radius);
      background: rgba(255, 255, 255, 0.09);
      backdrop-filter: blur(10px);
    }

    .role-hints strong {
      display: block;
      margin-bottom: 6px;
    }

    .role-hints span {
      color: rgba(255, 255, 255, 0.72);
      font-size: 0.86rem;
      line-height: 1.45;
    }

    .auth-card {
      align-self: center;
    }

    .login-form {
      margin-top: 24px;
    }

    .login-error {
      padding: 12px;
      border: 1px solid color-mix(in srgb, var(--agm-danger) 30%, var(--agm-border));
      border-radius: var(--agm-radius-sm);
      color: var(--agm-danger);
      background: color-mix(in srgb, var(--agm-danger) 8%, transparent);
      font-weight: 700;
    }

    .forgot-link {
      justify-self: start;
      color: var(--agm-primary);
      font-weight: 800;
    }

    .auth-foot {
      margin-top: 20px;
      color: var(--agm-text-soft);
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .auth-foot a {
      color: var(--agm-primary);
      font-weight: 800;
    }

    @media (max-width: 920px) {
      .login-shell {
        grid-template-columns: 1fr;
      }

      .auth-card {
        order: -1;
      }

      .login-story {
        min-height: auto;
        gap: 22px;
        padding: 24px;
      }

      h1 {
        font-size: clamp(1.9rem, 8vw, 2.6rem);
      }
    }

    @media (max-width: 640px) {
      .role-hints {
        grid-template-columns: 1fr;
      }

      .role-hints article {
        min-height: auto;
      }
    }
  `]
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
