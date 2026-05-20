import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthUser } from '../../shared/models/auth.models';

@Component({
  selector: 'agm-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="topbar">
      <button class="icon-btn menu-button" type="button" aria-label="Abrir navegacion" (click)="toggleSidebar.emit()">
        <span aria-hidden="true">|||</span>
      </button>

      <a routerLink="/dashboard" class="topbar-title">
        <span class="brand-mark small">A</span>
        <span>
          <strong>AGM</strong>
          <small>Academic Grade Management</small>
        </span>
      </a>

      <div class="topbar-actions">
        <button class="icon-btn" type="button" aria-label="Cambiar tema" title="Cambiar tema" (click)="toggleTheme.emit()">
          <span aria-hidden="true">Aa</span>
        </button>
        <div class="user-chip" aria-label="Sesion actual">
          <span class="avatar" aria-hidden="true">{{ initials }}</span>
          <span>
            <strong>{{ user?.display_name || 'Usuario AGM' }}</strong>
            <small>{{ roleLabel }}</small>
          </span>
        </div>
        <button class="btn ghost small" type="button" (click)="logout.emit()">Salir</button>
      </div>
    </header>
  `,
  styles: [`
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 74px;
      padding: 0 30px;
      border-bottom: 1px solid var(--agm-border);
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--agm-surface-glass) 96%, transparent), color-mix(in srgb, var(--agm-primary-soft) 48%, transparent));
      backdrop-filter: blur(18px);
    }

    .topbar-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .topbar-title strong,
    .user-chip strong {
      display: block;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .topbar-title small,
    .user-chip small {
      display: block;
      color: var(--agm-text-soft);
      font-size: 0.76rem;
      margin-top: 2px;
    }

    .brand-mark.small {
      width: 34px;
      height: 34px;
      border-radius: 8px;
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 10px;
      border: 1px solid var(--agm-border);
      border-radius: 999px;
      background: var(--agm-surface-glass);
      box-shadow: var(--agm-shadow-soft);
    }

    .avatar {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: white;
      background: linear-gradient(135deg, var(--agm-primary), var(--agm-secondary));
      font-weight: 900;
      font-size: 0.82rem;
    }

    .menu-button {
      display: none;
    }

    @media (max-width: 920px) {
      .topbar {
        padding: 0 16px;
      }

      .menu-button {
        display: inline-grid;
      }

      .topbar-title small,
      .user-chip span:last-child {
        display: none;
      }
    }
  `]
})
export class HeaderComponent {
  @Input() user: AuthUser | null = null;
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() toggleTheme = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  get initials(): string {
    const name = this.user?.display_name || this.user?.email || 'AGM';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A';
  }

  get roleLabel(): string {
    const role = this.user?.role;
    if (role === 'docente') {
      return 'Docente';
    }
    if (role === 'alumno') {
      return 'Alumno';
    }
    return 'Administrador';
  }
}
