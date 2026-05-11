import { Component, Input } from '@angular/core';

@Component({
  selector: 'agm-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <strong>{{ title }}</strong>
      <p>{{ message }}</p>
      <ng-content />
    </div>
  `,
  styles: [`
    .empty-state {
      display: grid;
      place-items: center;
      gap: 8px;
      min-height: 180px;
      padding: 24px;
      text-align: center;
      border: 1px dashed var(--agm-border);
      border-radius: var(--agm-radius);
      background: color-mix(in srgb, var(--agm-surface-muted) 48%, transparent);
    }

    .empty-state strong {
      font-size: 1rem;
    }

    .empty-state p {
      max-width: 520px;
      margin: 0;
      color: var(--agm-text-soft);
      line-height: 1.5;
    }
  `]
})
export class EmptyStateComponent {
  @Input() title = 'Sin datos';
  @Input() message = 'Cuando exista informacion disponible aparecera aqui.';
}
