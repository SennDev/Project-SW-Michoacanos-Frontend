import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../core/services/api-client.service';
import { NotificationPayload, NotificationResult, ResetPasswordPayload, WelcomePayload } from '../shared/models/notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiClientService);

  sendWelcome(payload: WelcomePayload): Observable<NotificationResult> {
    return this.api.post<NotificationResult>('notifications', '/notificaciones/bienvenida', payload);
  }

  sendWithdrawal(payload: NotificationPayload): Observable<NotificationResult> {
    return this.api.post<NotificationResult>('notifications', '/notificaciones/baja', payload);
  }

  sendSubjectClosure(payload: NotificationPayload): Observable<NotificationResult> {
    return this.api.post<NotificationResult>('notifications', '/notificaciones/cierre-materia', payload);
  }

  sendResetPassword(payload: ResetPasswordPayload): Observable<NotificationResult> {
    return this.api.post<NotificationResult>('notifications', '/notificaciones/reset-password', payload);
  }
}
