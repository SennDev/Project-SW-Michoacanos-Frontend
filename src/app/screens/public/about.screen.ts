import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'agm-about-screen',
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
          <a routerLink="/">Inicio</a>
          <a routerLink="/" fragment="features">Caracteristicas</a>
          <a routerLink="/" fragment="architecture">Arquitectura</a>
          <a routerLink="/about">Nosotros</a>
          <a routerLink="/" fragment="technology">Tecnologias</a>
          <a class="btn primary small" routerLink="/auth/login">Acceder</a>
        </nav>
      </header>

      <section class="public-section about-hero">
        <div>
          <p class="section-kicker">Nosotros</p>
          <h1 class="section-heading">AGM organiza la vida academica con una arquitectura clara y confiable.</h1>
          <p class="section-copy">
            El proyecto une procesos cotidianos de administracion escolar con una base tecnica moderna: microservicios,
            autenticacion por roles, documentos importables, reportes exportables y asistencia QR.
          </p>
        </div>
        <aside class="panel pad mission-panel">
          <strong>Vision</strong>
          <p>Convertir tareas dispersas de gestion academica en flujos simples, verificables y seguros para instituciones.</p>
          <div class="divider"></div>
          <strong>Principios</strong>
          <p>Claridad operativa, trazabilidad, separacion de dominios y una experiencia digna de un sistema institucional.</p>
        </aside>
      </section>

      <section class="public-section team-section">
        <p class="section-kicker">Equipo</p>
        <h2 class="section-heading">Construido por un equipo enfocado en claridad, utilidad y arquitectura.</h2>
        <p class="section-copy">
          AGM fue desarrollado como una plataforma academica integral, cuidando tanto la experiencia visual como la integracion
          con microservicios, reportes, seguridad por roles y flujos reales de operacion.
        </p>
        <div class="team-grid">
          @for (member of members; track member.name) {
            <article class="team-card">
              <span class="member-avatar" aria-hidden="true">{{ member.initials }}</span>
              <div>
                <strong>{{ member.name }}</strong>
                <p>{{ member.focus }}</p>
              </div>
            </article>
          }
        </div>
      </section>

      <section class="architecture-band">
        <div class="public-section about-grid">
          <article>
            <p class="section-kicker">Proposito</p>
            <h2>Menos friccion administrativa, mas visibilidad academica.</h2>
            <p class="section-copy">
              AGM ayuda a importar datos reales, administrar materias, capturar evaluaciones, tomar asistencia y generar evidencia
              sin depender de hojas sueltas o procesos manuales desconectados.
            </p>
          </article>
          <div class="timeline">
            @for (item of timeline; track item.title; let index = $index) {
              <div class="timeline-item">
                <span class="timeline-dot">{{ index + 1 }}</span>
                <div>
                  <strong>{{ item.title }}</strong>
                  <p class="muted">{{ item.copy }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <section class="public-section">
        <p class="section-kicker">Stack</p>
        <h2 class="section-heading">Frontend moderno, backend distribuido.</h2>
        <div class="feature-grid">
          <article class="feature-card">
            <strong>Angular 20</strong>
            <p>Componentes standalone, rutas lazy-loaded, formularios reactivos y servicios tipados.</p>
          </article>
          <article class="feature-card">
            <strong>Microservicios REST</strong>
            <p>El navegador consume REST por puerto mientras el backend conserva comunicacion interna gRPC.</p>
          </article>
          <article class="feature-card">
            <strong>Infraestructura local</strong>
            <p>PostgreSQL, Redis, Docker y Nginx completan una base lista para demo y despliegue.</p>
          </article>
        </div>
        <div class="row wrap mobile-stack" style="margin-top: 28px;">
          <a class="btn accent" routerLink="/auth/login">Acceder a AGM</a>
          <a class="btn ghost" routerLink="/">Volver al inicio</a>
        </div>
      </section>
    </main>
  `,
  styles: [`
    .about-hero,
    .about-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.72fr);
      gap: 40px;
      align-items: center;
    }

    .mission-panel {
      border-top: 4px solid var(--agm-accent);
    }

    .mission-panel p {
      margin: 8px 0 0;
      color: var(--agm-text-soft);
      line-height: 1.65;
    }

    .about-grid h2 {
      margin: 0;
      font-size: clamp(1.8rem, 3vw, 2.8rem);
      line-height: 1.1;
    }

    .timeline-item p {
      margin: 5px 0 0;
      line-height: 1.5;
    }

    .team-section {
      padding-top: 32px;
    }

    .team-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 14px;
      margin-top: 28px;
    }

    .team-card {
      display: grid;
      gap: 14px;
      align-content: start;
      min-height: 178px;
      padding: 18px;
      border: 1px solid var(--agm-border);
      border-radius: var(--agm-radius);
      background:
        linear-gradient(160deg, color-mix(in srgb, var(--agm-primary-soft) 48%, transparent), transparent),
        var(--agm-surface);
      box-shadow: var(--agm-shadow-soft);
    }

    .member-avatar {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      color: #1f2937;
      background: var(--agm-accent);
      font-weight: 950;
    }

    .team-card strong {
      display: block;
      font-size: 1.05rem;
    }

    .team-card p {
      margin: 7px 0 0;
      color: var(--agm-text-soft);
      line-height: 1.5;
    }

    @media (max-width: 920px) {
      .about-hero,
      .about-grid {
        grid-template-columns: 1fr;
      }

      .team-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .team-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AboutScreen {
  readonly members = [
    { name: 'Fernando', initials: 'F', focus: 'Flujos academicos y validacion funcional.' },
    { name: 'Gerson', initials: 'G', focus: 'Frontend, experiencia visual e integracion.' },
    { name: 'Rodrigo', initials: 'R', focus: 'Microservicios y arquitectura distribuida.' },
    { name: 'Pablo', initials: 'P', focus: 'Calificaciones, reportes y datos academicos.' },
    { name: 'Bernardo', initials: 'B', focus: 'Asistencia QR, pruebas y estabilidad.' }
  ];

  readonly timeline = [
    { title: 'Ingreso seguro', copy: 'JWT y RBAC delimitan pantallas y acciones desde la sesion.' },
    { title: 'Datos academicos', copy: 'PDF, CSV y XLSX alimentan periodos, docentes, alumnos y materias.' },
    { title: 'Operacion diaria', copy: 'Docentes califican, abren asistencias QR y consultan avances.' },
    { title: 'Evidencia final', copy: 'Reportes PDF/XLSX consolidan calificaciones, asistencias y estadisticas.' }
  ];
}
