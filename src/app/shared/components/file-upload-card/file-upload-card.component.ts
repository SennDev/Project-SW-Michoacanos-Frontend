import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'agm-file-upload-card',
  standalone: true,
  template: `
    <article class="upload-card">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ hint }}</p>
      </div>

      <label class="upload-drop">
        <input class="sr-only" type="file" [accept]="accept" (change)="select($event)">
        <span>{{ selectedName() || 'Seleccionar archivo' }}</span>
      </label>

      <button class="btn primary" type="button" [disabled]="!file() || loading" (click)="upload.emit(file()!)">
        {{ loading ? 'Cargando...' : actionLabel }}
      </button>
    </article>
  `,
  styles: [`
    .upload-card {
      display: grid;
      gap: 14px;
      padding: 16px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius);
      background: var(--agm-surface);
    }

    h3 {
      margin: 0 0 5px;
      font-size: 1rem;
    }

    p {
      margin: 0;
      color: var(--agm-text-soft);
      line-height: 1.45;
    }

    .upload-drop {
      display: grid;
      place-items: center;
      min-height: 92px;
      padding: 16px;
      border: 1px dashed var(--agm-border);
      border-radius: var(--agm-radius);
      background: var(--agm-surface-muted);
      color: var(--agm-text-soft);
      font-weight: 800;
      text-align: center;
      cursor: pointer;
    }
  `]
})
export class FileUploadCardComponent {
  @Input() title = 'Importar archivo';
  @Input() hint = 'Carga un archivo compatible.';
  @Input() actionLabel = 'Importar';
  @Input() accept = '.pdf,.csv,.xlsx';
  @Input() loading = false;
  @Output() upload = new EventEmitter<File>();

  readonly file = signal<File | null>(null);
  readonly selectedName = signal('');

  select(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.file.set(file);
    this.selectedName.set(file?.name ?? '');
  }
}
