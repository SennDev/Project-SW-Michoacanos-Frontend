import { Component, Input } from '@angular/core';

@Component({
  selector: 'agm-status-badge',
  standalone: true,
  template: `<span class="status-badge" [class]="tone">{{ label }}</span>`
})
export class StatusBadgeComponent {
  @Input() label = '';
  @Input() tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'neutral';
}
