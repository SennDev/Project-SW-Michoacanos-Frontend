import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'agm-confirmation-modal',
  standalone: true,
  template: `
    @if (open) {
      <section class="modal-backdrop" role="presentation" (click)="cancel.emit()">
        <article class="modal-card" role="dialog" aria-modal="true" [attr.aria-label]="title" (click)="$event.stopPropagation()">
          <h2>{{ title }}</h2>
          <p>{{ message }}</p>
          <div class="row between">
            <button class="btn ghost" type="button" (click)="cancel.emit()">Cancelar</button>
            <button class="btn danger" type="button" (click)="confirm.emit()">{{ confirmLabel }}</button>
          </div>
        </article>
      </section>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(13, 24, 20, 0.48);
    }

    .modal-card {
      width: min(440px, 100%);
      padding: 22px;
      border-radius: var(--agm-radius);
      border: 1px solid var(--agm-border);
      background: var(--agm-surface);
      box-shadow: var(--agm-shadow);
    }

    h2 {
      margin: 0 0 8px;
      font-size: 1.2rem;
    }

    p {
      margin: 0 0 18px;
      color: var(--agm-text-soft);
      line-height: 1.55;
    }
  `]
})
export class ConfirmationModalComponent {
  @Input() open = false;
  @Input() title = 'Confirmar accion';
  @Input() message = 'Esta accion no se puede deshacer.';
  @Input() confirmLabel = 'Confirmar';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
}
