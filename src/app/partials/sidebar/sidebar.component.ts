import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../../shared/models/ui.models';

@Component({
  selector: 'agm-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.open]="open">
      <div class="sidebar-head">
        <div class="brand-mark">A</div>
        <div>
          <strong>AGM</strong>
          <small>Gestion academica institucional</small>
        </div>
      </div>

      <nav class="nav-list" aria-label="Navegacion principal">
        @for (item of items; track item.route) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
            (click)="closeSidebar.emit()"
          >
            <span class="nav-icon" aria-hidden="true">{{ item.icon[0].toUpperCase() }}</span>
            <span>
              <strong>{{ item.label }}</strong>
              <small>{{ item.description }}</small>
            </span>
          </a>
        }
      </nav>

      <div class="sidebar-note">
        <strong>Arquitectura distribuida</strong>
        <span>REST frontend, gRPC interno, servicios 8011-8017.</span>
      </div>
    </aside>
    @if (open) {
      <button class="sidebar-backdrop" type="button" aria-label="Cerrar navegacion" (click)="closeSidebar.emit()"></button>
    }
  `,
  styles: [`
    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      gap: 24px;
      padding: 24px 18px;
      color: #f8fbff;
      background:
        linear-gradient(180deg, rgba(244, 180, 0, 0.09), transparent 18rem),
        linear-gradient(180deg, var(--agm-sidebar), var(--agm-sidebar-soft));
      box-shadow: 18px 0 48px rgba(0, 31, 63, 0.18);
    }

    .sidebar-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 4px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .sidebar-head strong {
      display: block;
      font-size: 1.1rem;
    }

    .sidebar-head small,
    .nav-list small,
    .sidebar-note span {
      color: rgba(248, 251, 255, 0.72);
      font-size: 0.76rem;
    }

    .nav-list {
      display: grid;
      align-content: start;
      gap: 7px;
      overflow-y: auto;
      padding-right: 2px;
    }

    .nav-list a {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      padding: 11px 10px;
      border-radius: 10px;
      color: rgba(248, 251, 255, 0.84);
      transition: background 160ms ease, color 160ms ease, transform 160ms ease;
    }

    .nav-list a.active,
    .nav-list a:hover {
      color: white;
      background: rgba(255, 255, 255, 0.13);
      transform: translateX(2px);
    }

    .nav-icon {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      color: #fff4cc;
      background: rgba(255, 255, 255, 0.12);
      font-weight: 900;
    }

    .nav-list strong {
      display: block;
      line-height: 1.2;
    }

    .sidebar-note {
      display: grid;
      gap: 4px;
      padding: 14px;
      border: 1px solid rgba(244, 180, 0, 0.18);
      border-radius: var(--agm-radius);
      background: rgba(255, 255, 255, 0.09);
    }

    .sidebar-note strong {
      font-size: 0.86rem;
    }

    .sidebar-backdrop {
      display: none;
    }

    @media (max-width: 920px) {
      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: min(300px, 84vw);
        z-index: 40;
        transform: translateX(-102%);
        transition: transform 180ms ease;
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .sidebar-backdrop {
        position: fixed;
        inset: 0;
        z-index: 35;
        display: block;
        border: 0;
        background: rgba(10, 18, 16, 0.45);
      }
    }
  `]
})
export class SidebarComponent {
  @Input() items: NavItem[] = [];
  @Input() open = false;
  @Output() closeSidebar = new EventEmitter<void>();
}
