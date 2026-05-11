import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  ngOnInit(): void {
    const theme = typeof localStorage !== 'undefined' ? localStorage.getItem('agm.theme') : null;
    if (theme === 'dark' && typeof document !== 'undefined') {
      document.documentElement.dataset['theme'] = 'dark';
    }
  }
}
