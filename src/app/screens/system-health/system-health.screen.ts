import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HealthService } from '../../core/services/health.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { SearchableTableComponent } from '../../shared/components/searchable-table/searchable-table.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { HealthStatus } from '../../shared/models/api.models';
import { ChartPoint, TableColumn } from '../../shared/models/ui.models';

@Component({
  selector: 'agm-system-health-screen',
  standalone: true,
  imports: [PageHeaderComponent, KpiCardComponent, ChartCardComponent, SearchableTableComponent, LoadingSkeletonComponent],
  template: `
    <agm-page-header
      eyebrow="Sistema"
      title="Salud de microservicios"
      description="Monitoreo directo a /health para los siete servicios REST consumidos por el frontend."
    >
      <button class="btn primary" type="button" (click)="load()">Actualizar</button>
    </agm-page-header>

    @if (loading()) {
      <agm-loading-skeleton [rows]="5" />
    } @else {
      <section class="grid-4">
        <agm-kpi-card label="Online" [value]="online()" tone="success" />
        <agm-kpi-card label="Offline" [value]="offline()" [tone]="offline() ? 'danger' : 'success'" />
        <agm-kpi-card label="Latencia media" [value]="averageLatency() + ' ms'" tone="warning" />
        <agm-kpi-card label="Conectividad API" [value]="apiScore() + '%'" [tone]="apiScore() === 100 ? 'success' : 'warning'" />
      </section>

      <section class="dependency-grid">
        <article class="dependency-card">
          <span class="status-badge" [class]="postgresStatus() === 'Operativo' ? 'success' : 'warning'">{{ postgresStatus() }}</span>
          <strong>PostgreSQL</strong>
          <p>Estado inferido por disponibilidad de los servicios que dependen de bases por dominio.</p>
        </article>
        <article class="dependency-card">
          <span class="status-badge" [class]="redisStatus() === 'Operativo' ? 'success' : 'warning'">{{ redisStatus() }}</span>
          <strong>Redis</strong>
          <p>Estado inferido por ms-attendance, usado para sesiones QR temporales y anti-duplicados.</p>
        </article>
        <article class="dependency-card">
          <span class="status-badge info">8011-8017</span>
          <strong>REST APIs</strong>
          <p>El frontend valida cada microservicio con llamadas directas a su endpoint /health.</p>
        </article>
      </section>

      <section class="grid-2" style="margin-top: 18px;">
        <agm-chart-card
          title="Latencia por servicio"
          subtitle="Respuesta del endpoint /health"
          [data]="latencyChart()"
        />
        <article class="panel pad service-map">
          <h2 class="panel-title">Mapa operativo</h2>
          <div class="metric-list">
            @for (service of services(); track service.key) {
              <div class="metric-row">
                <span>{{ service.name }} :{{ service.port }}</span>
                <span class="status-badge" [class]="service.status === 'online' ? 'success' : 'danger'">{{ service.status }}</span>
              </div>
            }
          </div>
        </article>
      </section>

      <section style="margin-top: 18px;">
        <agm-searchable-table
          [rows]="services()"
          [columns]="columns"
          placeholder="Buscar servicio o puerto"
          emptyTitle="Sin servicios"
          emptyMessage="No se pudo construir el mapa de salud."
        />
      </section>
    }
  `,
  styles: [`
    .dependency-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 18px;
    }

    .dependency-card {
      display: grid;
      gap: 10px;
      align-content: start;
      min-height: 164px;
      padding: 18px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius);
      background: var(--agm-surface);
      box-shadow: var(--agm-shadow-soft);
    }

    .dependency-card strong {
      font-size: 1.14rem;
    }

    .dependency-card p {
      margin: 0;
      color: var(--agm-text-soft);
      line-height: 1.55;
    }

    .service-map {
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--agm-primary-soft) 58%, transparent), transparent),
        var(--agm-surface);
    }

    @media (max-width: 920px) {
      .dependency-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class SystemHealthScreen implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly health = inject(HealthService);

  readonly loading = signal(true);
  readonly services = signal<HealthStatus[]>([]);

  readonly columns: TableColumn<HealthStatus>[] = [
    { key: 'name', header: 'Servicio' },
    { key: 'port', header: 'Puerto' },
    { key: 'status', header: 'Estado', badge: (row) => row.status },
    { key: 'latencyMs', header: 'Latencia', formatter: (row) => `${row.latencyMs ?? 0} ms` },
    { key: 'message', header: 'Mensaje', formatter: (row) => row.message ?? '' }
  ];

  readonly online = computed(() => this.services().filter((service) => service.status === 'online').length);
  readonly offline = computed(() => this.services().filter((service) => service.status !== 'online').length);
  readonly averageLatency = computed(() => {
    const values = this.services().map((service) => service.latencyMs ?? 0).filter((value) => value > 0);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  });
  readonly apiScore = computed(() => this.services().length ? Math.round((this.online() / this.services().length) * 100) : 0);
  readonly latencyChart = computed<ChartPoint[]>(() => this.services().map((service) => ({
    label: service.name,
    value: service.status === 'online' ? service.latencyMs ?? 1 : 0,
    color: service.status === 'online' ? 'var(--agm-primary)' : 'var(--agm-danger)'
  })));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.health.checkAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((services) => {
      this.services.set(services);
      this.loading.set(false);
    });
  }

  postgresStatus(): string {
    const databaseBacked = this.services().filter((service) => service.key !== 'attendance');
    return databaseBacked.length && databaseBacked.every((service) => service.status === 'online') ? 'Operativo' : 'Validar';
  }

  redisStatus(): string {
    const attendance = this.services().find((service) => service.key === 'attendance');
    return attendance?.status === 'online' ? 'Operativo' : 'Validar';
  }
}
