import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { AuthService } from '../auth/auth.service';
import { HeaderComponent } from '../../partials/header/header.component';
import { SidebarComponent } from '../../partials/sidebar/sidebar.component';
import { FooterComponent } from '../../partials/footer/footer.component';

@Component({
  selector: 'agm-app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, FooterComponent],
  template: `
    <div class="app-shell">
      <agm-sidebar
        [items]="visibleNavItems()"
        [open]="sidebarOpen()"
        (closeSidebar)="sidebarOpen.set(false)"
      />

      <div class="app-main">
        <agm-header
          [user]="auth.user()"
          (toggleSidebar)="toggleSidebarPanel()"
          (logout)="auth.logout()"
          (toggleTheme)="toggleTheme()"
        />

        <main class="content-wrap" tabindex="-1">
          <router-outlet />
        </main>

        <agm-footer />
      </div>
    </div>
  `
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly sidebarOpen = signal(false);
  readonly visibleNavItems = computed(() => NAV_ITEMS.filter((item) => this.auth.hasAnyRole(item.roles)));

  toggleSidebarPanel(): void {
    this.sidebarOpen.update((open) => !open);
  }

  toggleTheme(): void {
    const root = document.documentElement;
    const nextTheme = root.dataset['theme'] === 'dark' ? 'light' : 'dark';
    root.dataset['theme'] = nextTheme;
    localStorage.setItem('agm.theme', nextTheme);
  }
}
