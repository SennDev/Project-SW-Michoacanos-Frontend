import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'agm-error-state',
  standalone: true,
  template: `
    <div class="error-state">
      <div>
        <strong>{{ title }}</strong>
        <p>{{ message }}</p>
      </div>
      @if (retry.observed) {
        <button class="btn ghost small" type="button" (click)="retry.emit()">Reintentar</button>
      }
    </div>
  `,
  styles: [`
    .error-state {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border: 1px solid color-mix(in srgb, var(--agm-danger) 28%, var(--agm-border));
      border-radius: var(--agm-radius);
      color: var(--agm-danger);
      background: color-mix(in srgb, var(--agm-danger) 8%, transparent);
    }

    p {
      margin: 3px 0 0;
      color: var(--agm-text-soft);
    }
  `]
})
export class ErrorStateComponent {
  @Input() title = 'Algo no salio bien';
  @Input() message = 'El servicio no respondio correctamente.';
  @Output() retry = new EventEmitter<void>();
}
