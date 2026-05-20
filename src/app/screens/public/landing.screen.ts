import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'agm-landing-screen',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="public-page">
      <header class="public-nav">
        <a routerLink="/" class="row">
          <span class="brand-mark">A</span>
          <span>
            <strong>AGM</strong>
            <small class="muted">Academic Grade Management</small>
          </span>
        </a>
        <nav class="nav-links" aria-label="Navegacion publica">
          <a href="#inicio">Inicio</a>
          <a href="#features">Caracteristicas</a>
          <a href="#architecture">Arquitectura</a>
          <a routerLink="/about">Nosotros</a>
          <a href="#technology">Tecnologias</a>
          <a class="btn primary small" routerLink="/auth/login">Acceder</a>
        </nav>
      </header>

      <section class="public-section landing-hero" id="inicio">
        <div>
          <p class="section-kicker">Plataforma academica institucional</p>
          <h1 class="section-heading">Gestion academica moderna para calificaciones, asistencias y reportes.</h1>
          <p class="section-copy">
            AGM integra autenticacion por roles, importacion de documentos, sesiones QR, ponderaciones, reportes PDF/XLSX
            y monitoreo de microservicios en una experiencia clara para administradores, docentes y alumnos.
          </p>
          <div class="row wrap mobile-stack hero-actions">
            <a class="btn accent" routerLink="/auth/login">Entrar al sistema</a>
            <a class="btn ghost" href="#architecture">Ver arquitectura</a>
          </div>
        </div>

        <aside class="hero-preview" aria-label="Vista previa del panel AGM">
          <div class="hero-preview-header">
            <div>
              <strong>Panel institucional</strong>
              <p class="muted">Servicios REST activos</p>
            </div>
            <span class="status-badge success">Online</span>
          </div>
          <div class="hero-preview-bars">
            <span class="hero-preview-bar" style="--height: 64%"></span>
            <span class="hero-preview-bar" style="--height: 78%"></span>
            <span class="hero-preview-bar" style="--height: 52%"></span>
          </div>
          <div class="hero-preview-row">
            <span>QR asistencia</span>
            <strong>10 min</strong>
          </div>
          <div class="hero-preview-row">
            <span>Reportes generados</span>
            <strong>PDF/XLSX</strong>
          </div>
          <div class="hero-preview-row">
            <span>Roles</span>
            <strong>Admin + Docente + Alumno</strong>
          </div>
        </aside>
      </section>

      <section class="public-section" id="features">
        <p class="section-kicker">Capacidades</p>
        <h2 class="section-heading">Flujos academicos reales, no pantallas aisladas.</h2>
        <p class="section-copy">
          La interfaz respeta los servicios existentes y convierte sus endpoints en flujos comprensibles, trazables y listos para demo.
        </p>
        <div class="feature-grid">
          @for (feature of features; track feature.title) {
            <article class="feature-card">
              <strong>{{ feature.title }}</strong>
              <p>{{ feature.copy }}</p>
            </article>
          }
        </div>
      </section>

      <section class="architecture-band" id="architecture">
        <div class="public-section">
          <p class="section-kicker">Arquitectura</p>
          <h2 class="section-heading">Frontend SPA conectado a siete microservicios REST.</h2>
          <p class="section-copy">
            AGM mantiene el backend como fuente de verdad: el navegador consume REST, los servicios se coordinan internamente con gRPC,
            y cada dominio conserva su responsabilidad.
          </p>
          <div class="feature-grid">
            @for (service of services; track service.port) {
              <article class="feature-card service-card">
                <span class="status-badge info">:{{ service.port }}</span>
                <strong>{{ service.name }}</strong>
                <p>{{ service.copy }}</p>
              </article>
            }
          </div>
        </div>
      </section>

      <section class="public-section">
        <p class="section-kicker">Roles</p>
        <h2 class="section-heading">Una experiencia distinta para cada usuario.</h2>
        <div class="role-grid">
          <article class="feature-card">
            <strong>Administracion</strong>
            <p>Importa periodos, docentes y alumnos; supervisa microservicios; descarga reportes operativos.</p>
          </article>
          <article class="feature-card">
            <strong>Docencia</strong>
            <p>Configura ponderaciones, abre sesiones QR, registra calificaciones y revisa estadisticas por materia.</p>
          </article>
          <article class="feature-card">
            <strong>Alumnado</strong>
            <p>Consulta promedios, asistencias y genera QR para sesiones activas con una vista simple y segura.</p>
          </article>
        </div>
      </section>

      <section class="public-section" id="technology">
        <p class="section-kicker">Tecnologias</p>
        <h2 class="section-heading">Stack moderno para una plataforma extensible.</h2>
        <div class="tech-grid">
          @for (tech of technologies; track tech) {
            <article class="feature-card tech-card">
              <strong>{{ tech }}</strong>
            </article>
          }
        </div>
      </section>

      <section class="public-section about-strip">
        <div>
          <p class="section-kicker">Nosotros</p>
          <h2>AGM nace para ordenar procesos academicos complejos sin perder claridad.</h2>
          <p class="section-copy">
            Su proposito es reducir friccion administrativa, dar visibilidad a docentes y alumnos, y demostrar una arquitectura
            distribuida lista para evolucionar.
          </p>
        </div>
        <a class="btn primary" routerLink="/about">Conocer el proyecto</a>
      </section>
    </main>
  `,
  styles: [`
    .landing-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.02fr) minmax(340px, 0.78fr);
      gap: 48px;
      align-items: center;
      min-height: calc(100vh - 74px);
      padding-top: 48px;
    }

    .hero-actions {
      margin-top: 28px;
    }

    .service-card {
      display: grid;
      align-content: start;
      gap: 10px;
    }

    .tech-card {
      min-height: 92px;
      display: grid;
      place-items: center;
      text-align: center;
    }

    .about-strip {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: center;
      border-top: 1px solid var(--agm-border);
    }

    .about-strip h2 {
      max-width: 820px;
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2.4rem);
      line-height: 1.12;
    }

    @media (max-width: 920px) {
      .landing-hero,
      .about-strip {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LandingScreen {
  readonly features = [
    { title: 'Importaciones academicas', copy: 'Carga PDF, CSV y XLSX para docentes, programacion y alumnos sin duplicar logica en frontend.' },
    { title: 'Calificaciones y ponderaciones', copy: 'Configura pesos, actividades y concentrados desde servicios tipados y protegidos por rol.' },
    { title: 'Asistencia QR', copy: 'Sesiones temporales, tokens firmados y registro de presente o retardo con retroalimentacion clara.' },
    { title: 'Reportes profesionales', copy: 'Exportaciones PDF y XLSX listas para administracion, docencia y evidencias academicas.' },
    { title: 'RBAC con JWT', copy: 'Navegacion, pantallas y acciones respetan los roles emitidos por ms-auth.' },
    { title: 'Monitoreo operativo', copy: 'Vista de salud para validar disponibilidad de REST, dependencias y puntos criticos.' }
  ];

  readonly services = [
    { name: 'ms-auth', port: 8011, copy: 'Login, JWT, usuarios y roles.' },
    { name: 'ms-periods', port: 8012, copy: 'Periodos, materias y programacion academica.' },
    { name: 'ms-academics', port: 8013, copy: 'Docentes, alumnos e inscripciones.' },
    { name: 'ms-grades', port: 8014, copy: 'Ponderaciones, actividades y concentrados.' },
    { name: 'ms-attendance', port: 8015, copy: 'Sesiones QR y registro de asistencia.' },
    { name: 'ms-notifications', port: 8016, copy: 'Correos, avisos y bitacora interna.' },
    { name: 'ms-reports', port: 8017, copy: 'PDF, XLSX y estadisticas.' }
  ];

  readonly technologies = ['Angular 20', 'Standalone Components', 'JWT + RBAC', 'FastAPI REST', 'gRPC interno', 'PostgreSQL', 'Redis', 'Docker + Nginx', 'SCSS Design System'];
}
