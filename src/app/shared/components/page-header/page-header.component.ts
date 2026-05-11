import { Component, Input } from '@angular/core';

@Component({
  selector: 'agm-page-header',
  standalone: true,
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        @if (description) {
          <p class="description">{{ description }}</p>
        }
      </div>
      <div class="page-header-actions">
        <ng-content />
      </div>
    </section>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: end;
      margin-bottom: 22px;
      padding-bottom: 18px;
      border-bottom: 1px solid color-mix(in srgb, var(--agm-border) 72%, transparent);
    }

    .eyebrow {
      margin: 0 0 6px;
      color: var(--agm-primary);
      font-size: 0.78rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.9rem, 3.4vw, 3rem);
      line-height: 1.05;
      letter-spacing: 0;
    }

    .description {
      max-width: 780px;
      margin: 10px 0 0;
      color: var(--agm-text-soft);
      line-height: 1.6;
    }

    .page-header-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
    }

    @media (max-width: 720px) {
      .page-header {
        align-items: stretch;
        flex-direction: column;
      }

      .page-header-actions {
        justify-content: stretch;
      }
    }
  `]
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() eyebrow = 'AGM';
  @Input() description = '';
}
