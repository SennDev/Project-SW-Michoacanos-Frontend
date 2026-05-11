import { Component, Input } from '@angular/core';

@Component({
  selector: 'agm-kpi-card',
  standalone: true,
  template: `
    <article class="kpi-card" [class]="tone">
      <span class="kpi-label">{{ label }}</span>
      <strong>{{ value }}</strong>
      @if (delta) {
        <small>{{ delta }}</small>
      }
    </article>
  `,
  styles: [`
    .kpi-card {
      min-height: 132px;
      display: grid;
      align-content: space-between;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius);
      background:
        linear-gradient(145deg, color-mix(in srgb, var(--accent, var(--agm-primary)) 5%, transparent), transparent 52%),
        var(--agm-surface);
      box-shadow: var(--agm-shadow-soft);
      overflow: hidden;
      position: relative;
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--accent, var(--agm-primary)) 30%, var(--agm-border));
      box-shadow: var(--agm-shadow);
    }

    .kpi-card::after {
      content: '';
      position: absolute;
      inset: 0 auto auto 0;
      width: 5px;
      height: 100%;
      background: var(--accent, var(--agm-primary));
    }

    .kpi-card strong {
      font-size: 2rem;
      line-height: 1;
      letter-spacing: 0;
      color: var(--agm-text);
    }

    .kpi-label,
    .kpi-card small {
      color: var(--agm-text-soft);
      font-weight: 750;
    }

    .kpi-card.primary { --accent: var(--agm-secondary); }
    .kpi-card.success { --accent: var(--agm-success); }
    .kpi-card.warning { --accent: var(--agm-warning); }
    .kpi-card.danger { --accent: var(--agm-danger); }
    .kpi-card.neutral { --accent: var(--agm-border); }
  `]
})
export class KpiCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() delta = '';
  @Input() tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' = 'primary';
}
