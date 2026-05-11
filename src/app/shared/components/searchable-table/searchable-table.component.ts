import { Component, computed, Input, signal, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableColumn } from '../../models/ui.models';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'agm-searchable-table',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, StatusBadgeComponent, EmptyStateComponent],
  template: `
    <section class="panel table-shell">
      <div class="table-toolbar">
        <input
          class="search-input"
          type="search"
          [placeholder]="placeholder"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
        >
        <ng-content select="[table-actions]" />
      </div>

      @if (filteredRows().length) {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                @for (column of columns; track column.key + column.header) {
                  <th>{{ column.header }}</th>
                }
                @if (actions) {
                  <th>Acciones</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track trackRow(row, $index)) {
                <tr>
                  @for (column of columns; track column.key + column.header) {
                    <td [class]="column.className || ''">
                      @if (column.badge) {
                        <agm-status-badge [label]="column.badge(row)" [tone]="badgeTone(column.badge(row))" />
                      } @else {
                        {{ value(row, column) }}
                      }
                    </td>
                  }
                  @if (actions) {
                    <td>
                      <ng-container *ngTemplateOutlet="actions; context: { $implicit: row }" />
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="table-empty">
          <agm-empty-state [title]="emptyTitle" [message]="emptyMessage" />
        </div>
      }
    </section>
  `,
  styles: [`
    .table-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 14px;
      border-bottom: 1px solid var(--agm-border);
    }

    .search-input {
      max-width: 360px;
    }

    .table-empty {
      padding: 14px;
    }

    @media (max-width: 640px) {
      .table-toolbar {
        align-items: stretch;
        flex-direction: column;
      }

      .search-input {
        max-width: none;
      }
    }
  `]
})
export class SearchableTableComponent<T extends object> {
  @Input() columns: TableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() placeholder = 'Buscar...';
  @Input() emptyTitle = 'Sin registros';
  @Input() emptyMessage = 'No se encontraron resultados para esta vista.';
  @Input() actions: TemplateRef<{ $implicit: T }> | null = null;

  readonly query = signal('');

  readonly filteredRows = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) {
      return this.rows;
    }
    return this.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query));
  });

  value(row: T, column: TableColumn<T>): string | number {
    return column.formatter ? column.formatter(row) : String(row[column.key] ?? '');
  }

  trackRow(row: T, index: number): unknown {
    const record = row as Record<string, unknown>;
    return record['id'] ?? record['session_id'] ?? record['alumno_id'] ?? index;
  }

  badgeTone(value: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    const normalized = value.toLowerCase();
    if (['activo', 'abierta', 'online', 'presente', 'sent', 'logged', 'aprobado'].some((word) => normalized.includes(word))) {
      return 'success';
    }
    if (['retardo', 'pendiente', 'degraded'].some((word) => normalized.includes(word))) {
      return 'warning';
    }
    if (['offline', 'error', 'cerrada', 'baja', 'reprobado'].some((word) => normalized.includes(word))) {
      return 'danger';
    }
    return 'neutral';
  }
}
