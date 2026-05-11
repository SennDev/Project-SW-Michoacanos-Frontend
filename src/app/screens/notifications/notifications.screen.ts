import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationsService } from '../../services/notifications.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/error.util';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'agm-notifications-screen',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, KpiCardComponent, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <agm-page-header
      eyebrow="Notificaciones"
      title="Correos, eventos y estado de envio"
      description="Opera los endpoints disponibles de ms-notifications. La bitacora de lectura aun no existe en REST, por eso esta vista conserva un estado claro sin romper la experiencia."
    />

    <section class="grid-4">
      <agm-kpi-card label="Endpoints activos" value="4" tone="primary" />
      <agm-kpi-card label="SMTP local" value="Opcional" tone="warning" />
      <agm-kpi-card label="Bitacora REST" value="Pendiente" tone="neutral" />
      <agm-kpi-card label="Ultimo envio" [value]="lastStatus() || 'N/D'" [tone]="lastStatus() ? 'success' : 'neutral'" />
    </section>

    <section class="grid-3" style="margin-top: 18px;">
      <article class="panel pad">
        <div class="row between">
          <h2 class="panel-title">Bienvenida</h2>
          <agm-status-badge label="/notificaciones/bienvenida" tone="info" />
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Alumno ID</label>
            <input type="number" [(ngModel)]="welcome.alumno_id">
          </div>
          <div class="field">
            <label>Materia ID</label>
            <input type="number" [(ngModel)]="welcome.materia_id">
          </div>
          <div class="field">
            <label>Correo</label>
            <input type="email" [(ngModel)]="welcome.email">
          </div>
          <div class="field">
            <label>Nombre</label>
            <input [(ngModel)]="welcome.nombre">
          </div>
          <button class="btn primary" type="button" [disabled]="sending()" (click)="sendWelcome()">Enviar</button>
        </div>
      </article>

      <article class="panel pad">
        <div class="row between">
          <h2 class="panel-title">Cierre de materia</h2>
          <agm-status-badge label="/notificaciones/cierre-materia" tone="info" />
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Materia ID</label>
            <input type="number" [(ngModel)]="closure.materia_id">
          </div>
          <div class="field">
            <label>Materia</label>
            <input [(ngModel)]="closure.materia_nombre">
          </div>
          <div class="field">
            <label>Correos opcionales</label>
            <textarea rows="4" [(ngModel)]="closureEmails" placeholder="correo1@dominio, correo2@dominio"></textarea>
          </div>
          <button class="btn primary" type="button" [disabled]="sending()" (click)="sendClosure()">Enviar cierre</button>
        </div>
      </article>

      <article class="panel pad">
        <div class="row between">
          <h2 class="panel-title">Reset password</h2>
          <agm-status-badge label="/notificaciones/reset-password" tone="info" />
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Correo</label>
            <input type="email" [(ngModel)]="reset.email">
          </div>
          <div class="field">
            <label>Token</label>
            <input [(ngModel)]="reset.reset_token">
          </div>
          <button class="btn primary" type="button" [disabled]="sending()" (click)="sendReset()">Enviar reset</button>
        </div>
      </article>
    </section>

    <section class="panel pad" style="margin-top: 18px;">
      <div class="row between wrap">
        <h2 class="panel-title">Bitacora de notificaciones</h2>
        <input class="search-input" type="search" placeholder="Buscar por estado o destinatario" disabled>
      </div>
      <agm-empty-state
        title="Endpoint de lectura no disponible"
        message="ms-notifications guarda logs internamente, pero no expone un GET REST para consultarlos. Cuando exista, esta tabla puede conectarse sin cambiar la UI."
      />
    </section>
  `
})
export class NotificationsScreen {
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationsService);
  private readonly toasts = inject(ToastService);

  readonly sending = signal(false);
  readonly lastStatus = signal('');

  welcome = {
    alumno_id: 1,
    materia_id: 1,
    email: '',
    nombre: '',
    temporary_password: ''
  };

  closure = {
    materia_id: 1,
    materia_nombre: ''
  };

  closureEmails = '';

  reset = {
    email: '',
    reset_token: ''
  };

  sendWelcome(): void {
    this.sending.set(true);
    this.notifications.sendWelcome(this.welcome).pipe(
      finalize(() => this.sending.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => this.handleResult('Bienvenida registrada', result.status),
      error: (error: unknown) => this.toasts.error('No se envio', errorMessage(error))
    });
  }

  sendClosure(): void {
    this.sending.set(true);
    this.notifications.sendSubjectClosure({
      ...this.closure,
      alumnos_emails: this.closureEmails.split(',').map((email) => email.trim()).filter(Boolean)
    }).pipe(
      finalize(() => this.sending.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => this.handleResult('Cierre registrado', `${result.status} | ${result.total_enviados ?? 0} destinatarios`),
      error: (error: unknown) => this.toasts.error('No se envio', errorMessage(error))
    });
  }

  sendReset(): void {
    this.sending.set(true);
    this.notifications.sendResetPassword(this.reset).pipe(
      finalize(() => this.sending.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => this.handleResult('Reset registrado', result.status),
      error: (error: unknown) => this.toasts.error('No se envio', errorMessage(error))
    });
  }

  private handleResult(title: string, status: string): void {
    this.lastStatus.set(status);
    this.toasts.success(title, status);
  }
}
