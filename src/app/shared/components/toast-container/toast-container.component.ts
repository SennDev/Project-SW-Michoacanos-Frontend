import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'agm-toast-container',
  standalone: true,
  template: `
    <section class="toast-stack" aria-live="polite" aria-label="Notificaciones">
      @for (toast of toasts.messages(); track toast.id) {
        <article class="toast" [class]="toast.tone">
          <div>
            <strong>{{ toast.title }}</strong>
            @if (toast.message) {
              <p>{{ toast.message }}</p>
            }
          </div>
          <button type="button" aria-label="Cerrar notificacion" (click)="toasts.dismiss(toast.id)">x</button>
        </article>
      }
    </section>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 100;
      display: grid;
      gap: 10px;
      width: min(380px, calc(100vw - 32px));
    }

    .toast {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
      padding: 14px;
      border: 1px solid var(--agm-border);
      border-left-width: 4px;
      border-radius: var(--agm-radius);
      background: var(--agm-surface);
      box-shadow: var(--agm-shadow);
    }

    .toast strong {
      display: block;
    }

    .toast p {
      margin: 3px 0 0;
      color: var(--agm-text-soft);
      font-size: 0.86rem;
    }

    .toast button {
      border: 0;
      background: transparent;
      color: var(--agm-text-soft);
      font-weight: 900;
    }

    .toast.success { border-left-color: var(--agm-success); }
    .toast.error { border-left-color: var(--agm-danger); }
    .toast.warning { border-left-color: var(--agm-warning); }
    .toast.info { border-left-color: var(--agm-info); }
  `]
})
export class ToastContainerComponent {
  readonly toasts = inject(ToastService);
}
