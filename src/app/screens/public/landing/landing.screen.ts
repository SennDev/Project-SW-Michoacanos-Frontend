import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'agm-landing-screen',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.screen.html',
  styleUrls: ['./landing.screen.scss']
})
export class LandingScreen {
  // Estado para controlar la visibilidad del menú en dispositivos móviles
  isMenuOpen = false;

  // Método para alternar el menú
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }
  
  scrollTo(event: Event, sectionId: string): void {
    // Evita que el enlace intente cambiar la URL en el navegador
    event.preventDefault(); 
    
    // Busca la sección y hace un scroll suave
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    
    // Cierra el menú en caso de estar en un celular
    this.isMenuOpen = false; 
  }

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
