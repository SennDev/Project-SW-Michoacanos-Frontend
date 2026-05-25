import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'agm-about-screen',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.screen.html',
  styleUrls: ['./about.screen.scss']
})
export class AboutScreen {
  readonly members = [
    { name: 'Fernando', initials: 'F', focus: 'Flujos académicos y validación funcional.' },
    { name: 'Gerson', initials: 'G', focus: 'Frontend, experiencia visual e integración.' },
    { name: 'Rodrigo', initials: 'R', focus: 'Microservicios y arquitectura distribuida.' },
    { name: 'Pablo', initials: 'P', focus: 'Calificaciones, reportes y datos académicos.' },
    { name: 'Bernardo', initials: 'B', focus: 'Asistencia QR, pruebas y estabilidad.' }
  ];

  readonly timeline = [
    { title: 'Ingreso seguro', copy: 'JWT y RBAC delimitan pantallas y acciones desde la sesión.' },
    { title: 'Datos académicos', copy: 'PDF, CSV y XLSX alimentan periodos, docentes, alumnos y materias.' },
    { title: 'Operación diaria', copy: 'Docentes califican, abren asistencias QR y consultan avances.' },
    { title: 'Evidencia final', copy: 'Reportes PDF/XLSX consolidan calificaciones, asistencias y estadísticas.' }
  ];
}