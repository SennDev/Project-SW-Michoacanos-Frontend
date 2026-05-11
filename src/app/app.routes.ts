import { Routes } from '@angular/router';
import { AppShellComponent } from './core/layout/app-shell.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./screens/public/landing.screen').then((m) => m.LandingScreen)
  },
  {
    path: 'about',
    loadComponent: () => import('./screens/public/about.screen').then((m) => m.AboutScreen)
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./screens/auth/login.screen').then((m) => m.LoginScreen)
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./screens/dashboard/dashboard.screen').then((m) => m.DashboardScreen),
        data: { roles: ['admin', 'docente', 'alumno'] }
      },
      {
        path: 'periods',
        canActivate: [roleGuard],
        loadComponent: () => import('./screens/periods/periods.screen').then((m) => m.PeriodsScreen),
        data: { roles: ['admin', 'docente', 'alumno'] }
      },
      {
        path: 'academics',
        canActivate: [roleGuard],
        loadComponent: () => import('./screens/academics/academics.screen').then((m) => m.AcademicsScreen),
        data: { roles: ['admin', 'docente'] }
      },
      {
        path: 'grades',
        canActivate: [roleGuard],
        loadComponent: () => import('./screens/grades/grades.screen').then((m) => m.GradesScreen),
        data: { roles: ['admin', 'docente', 'alumno'] }
      },
      {
        path: 'attendance',
        canActivate: [roleGuard],
        loadComponent: () => import('./screens/attendance/attendance.screen').then((m) => m.AttendanceScreen),
        data: { roles: ['admin', 'docente', 'alumno'] }
      },
      {
        path: 'notifications',
        canActivate: [roleGuard],
        loadComponent: () => import('./screens/notifications/notifications.screen').then((m) => m.NotificationsScreen),
        data: { roles: ['admin', 'docente'] }
      },
      {
        path: 'reports',
        canActivate: [roleGuard],
        loadComponent: () => import('./screens/reports/reports.screen').then((m) => m.ReportsScreen),
        data: { roles: ['admin', 'docente', 'alumno'] }
      },
      {
        path: 'system-health',
        canActivate: [roleGuard],
        loadComponent: () => import('./screens/system-health/system-health.screen').then((m) => m.SystemHealthScreen),
        data: { roles: ['admin'] }
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
