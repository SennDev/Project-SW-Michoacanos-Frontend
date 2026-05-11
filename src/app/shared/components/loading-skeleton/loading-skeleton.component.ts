import { Component, Input } from '@angular/core';

@Component({
  selector: 'agm-loading-skeleton',
  standalone: true,
  template: `
    <div class="skeleton-list" aria-label="Cargando">
      @for (item of placeholders; track item) {
        <span class="skeleton-line"></span>
      }
    </div>
  `,
  styles: [`
    .skeleton-list {
      display: grid;
      gap: 10px;
    }

    .skeleton-line {
      height: 42px;
      border-radius: var(--agm-radius-sm);
      background: linear-gradient(90deg, var(--agm-surface-muted), color-mix(in srgb, var(--agm-surface-muted) 54%, white), var(--agm-surface-muted));
      background-size: 220% 100%;
      animation: shimmer 1.2s ease-in-out infinite;
    }

    @keyframes shimmer {
      from { background-position: 100% 0; }
      to { background-position: -100% 0; }
    }
  `]
})
export class LoadingSkeletonComponent {
  @Input() rows = 4;

  get placeholders(): number[] {
    return Array.from({ length: this.rows }, (_, index) => index);
  }
}
