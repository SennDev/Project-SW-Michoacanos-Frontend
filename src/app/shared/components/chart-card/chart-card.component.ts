import { Component, Input } from '@angular/core';
import { ChartPoint } from '../../models/ui.models';

@Component({
  selector: 'agm-chart-card',
  standalone: true,
  template: `
    <article class="panel pad chart-card interactive">
      <div class="row between">
        <div>
          <h2 class="panel-title">{{ title }}</h2>
          @if (subtitle) {
            <p class="muted">{{ subtitle }}</p>
          }
        </div>
      </div>

      @if (data.length) {
        <div class="bar-chart">
          @for (point of data; track point.label) {
            <div class="bar-row">
              <span>{{ point.label }}</span>
              <div class="bar-track" aria-hidden="true">
                <span [style.width.%]="width(point.value)" [style.background]="point.color || 'var(--agm-primary)'"></span>
              </div>
              <strong>{{ point.value }}</strong>
            </div>
          }
        </div>
      } @else {
        <p class="muted">No hay datos suficientes para graficar.</p>
      }
    </article>
  `,
  styles: [`
    .chart-card .muted {
      margin: 0;
    }

    .bar-chart {
      display: grid;
      gap: 14px;
      margin-top: 16px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 98px minmax(0, 1fr) 46px;
      gap: 10px;
      align-items: center;
      font-size: 0.86rem;
    }

    .bar-row > span:first-child {
      color: var(--agm-text-soft);
      font-weight: 750;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar-row strong {
      text-align: right;
    }

    .bar-track {
      height: 11px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--agm-surface-muted);
    }

    .bar-track span {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: inherit;
      box-shadow: 0 5px 14px color-mix(in srgb, var(--agm-primary) 18%, transparent);
    }
  `]
})
export class ChartCardComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() data: ChartPoint[] = [];

  width(value: number): number {
    const max = Math.max(1, ...this.data.map((point) => point.value));
    return Math.round((value / max) * 100);
  }
}
