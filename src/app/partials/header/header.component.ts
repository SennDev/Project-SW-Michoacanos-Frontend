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
        <button class="btn ghost small logout-btn" type="button" (click)="logout.emit()">Salir</button>
      </div>
    </header>
  `,
  styles: [`
    /* ==========================================================================
       ESTRUCTURA BASE MÓVIL (MOBILE-FIRST)
       ========================================================================== */
     
    .topbar {
      position: sticky;
      top: 0;
      left: 0; /* Ancla forzosa al borde izquierdo */
      right: 0; /* Ancla forzosa al borde derecho */
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      min-height: 64px;
      
      width: 100%;
      box-sizing: border-box;
      padding: 0 8px;
      overflow: hidden; /* Evita que los elementos estiren la barra */
      
      border-bottom: 1px solid var(--agm-border);
      background: linear-gradient(90deg, color-mix(in srgb, var(--agm-surface-glass) 96%, transparent), color-mix(in srgb, var(--agm-primary-soft) 48%, transparent));
      backdrop-filter: blur(18px);
    }

    .topbar-title {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: inherit;
    }

    .brand-mark.small {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: var(--agm-primary, #0f172a);
      color: white;
      font-weight: 800;
      flex-shrink: 0;
    }

    .topbar-title strong {
      display: block;
      line-height: 1.2;
    }

    /* Ocultamos textos secundarios en móvil */
    .topbar-title small,
    .user-chip span:last-child {
      display: none;
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .user-chip {
      display: flex;
      align-items: center;
      padding: 2px;
      border: 1px solid var(--agm-border);
      border-radius: 50%;
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

    .menu-button, .icon-btn {
      display: inline-grid;
      place-items: center;
      min-width: 34px;
      height: 34px;
    }

    /* BLOQUEO ABSOLUTO PARA EL BOTÓN SALIR */
    .logout-btn {
      flex: 0 0 auto !important; /* Prohíbe que el botón crezca o se encoja */
      width: auto !important;
      min-width: 0 !important; 
      padding: 6px 12px !important;
      margin: 0 !important;
      font-size: 0.85rem !important;
      white-space: nowrap !important;
    }

    /* ==========================================================================
       ESCRITORIO Y TABLETS
       ========================================================================== */
    @media (min-width: 920px) {
      .topbar {
        padding: 0 30px;
        min-height: 74px;
        gap: 16px;
        overflow: visible; /* Restauramos en escritorio */
      }

      .menu-button {
        display: none;
      }

      .topbar-actions {
        gap: 10px;
      }

      .user-chip {
        gap: 9px;
        padding: 7px 10px;
        border-radius: 999px;
      }

      .topbar-title > span:not(.brand-mark) {
        display: block !important; /* Aseguramos que el texto vuelva a aparecer */
      }

      .topbar-title small,
      .user-chip span:last-child {
        display: block;
        color: var(--agm-text-soft);
        font-size: 0.76rem;
        margin-top: 2px;
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
    if (role === 'docente') return 'Docente';
    if (role === 'alumno') return 'Alumno';
    return 'Administrador';
  }
}