import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly messagesSignal = signal<ToastMessage[]>([]);

  readonly messages = this.messagesSignal.asReadonly();

  success(title: string, message?: string): void {
    this.push('success', title, message);
  }

  error(title: string, message?: string): void {
    this.push('error', title, message);
  }

  info(title: string, message?: string): void {
    this.push('info', title, message);
  }

  warning(title: string, message?: string): void {
    this.push('warning', title, message);
  }

  dismiss(id: number): void {
    this.messagesSignal.update((messages) => messages.filter((message) => message.id !== id));
  }

  private push(tone: ToastTone, title: string, message?: string): void {
    const toast: ToastMessage = { id: this.nextId++, title, message, tone };
    this.messagesSignal.update((messages) => [toast, ...messages].slice(0, 4));
    window.setTimeout(() => this.dismiss(toast.id), 4800);
  }
}
