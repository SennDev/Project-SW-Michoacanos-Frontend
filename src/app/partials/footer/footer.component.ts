import { Component } from '@angular/core';

@Component({
  selector: 'agm-footer',
  standalone: true,
  template: `
    <footer class="footer">
      <span>AGM Academic Grade Management</span>
      <span>SPA en puerto 8080</span>
    </footer>
  `,
  styles: [`
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 28px;
      border-top: 1px solid var(--agm-border);
      color: var(--agm-text-soft);
      font-size: 0.82rem;
    }

    @media (max-width: 640px) {
      .footer {
        flex-direction: column;
        padding: 16px;
      }
    }
  `]
})
export class FooterComponent {}
