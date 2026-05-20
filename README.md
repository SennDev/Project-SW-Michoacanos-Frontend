# AGM Frontend

Production-quality Angular 20+ SPA for **AGM - Academic Grade Management**.

The app consumes only the REST endpoints exposed by the backend microservices:

| Domain | URL |
| --- | --- |
| Auth | `http://3.94.103.183:8011` |
| Periods | `http://3.94.103.183:8012` |
| Academics | `http://3.94.103.183:8013` |
| Grades | `http://3.94.103.183:8014` |
| Attendance | `http://3.94.103.183:8015` |
| Notifications | `http://3.94.103.183:8016` |
| Reports | `http://3.94.103.183:8017` |

## Features

- Angular 20 standalone application structure.
- Public landing page and about page with institutional AGM branding.
- Lazy-loaded routes for dashboard, periods, academics, grades, attendance, notifications, reports, and system health.
- JWT login flow with bearer-token interceptor, auth guard, role guard, and session service.
- Role-aware navigation for `admin`, `docente`, and `alumno`.
- Typed REST services aligned with the current backend routes.
- Reusable UI components for KPI cards, charts, tables, uploads, modals, badges, skeletons, empty states, error states, and toasts.
- Responsive dashboard shell with sidebar, topbar, content area, and BUAP-inspired theme-ready SCSS design system.
- Polished QR attendance flow with active session state, student QR generation, and teacher scan/register panel.
- Graceful states for backend gaps, including notification log reads and backend resources that do not expose list endpoints yet.

## Local Setup

Install dependencies:

```powershell
npm install
```

Run the Angular dev server on the documented frontend port:

```powershell
npm start
```

Open:

```text
http://3.94.103.183:8080
```

Seeded dev credentials:

```text
email: admin@agm.local
password: Admin123!
```

## Build

```powershell
npm run build
```

The production bundle is generated at:

```text
dist/agm-frontend/browser
```

## Docker / Nginx

Build and serve the SPA on port `8080`:

```powershell
docker build -t agm-frontend .
docker run --rm -p 8080:8080 agm-frontend
```

The included `nginx.conf` handles SPA fallback to `index.html`.

When this repository lives next to the backend repository as:

```text
Project-SW-Michoacanos
Project-SW-Michoacanos-Frontend
```

the backend `docker-compose.yml` also builds this frontend automatically, so one command from the backend repository starts the complete platform:

```powershell
docker compose up --build
```

## Configuration

API URLs live in:

```text
src/environments/environment.ts
src/environments/environment.development.ts
```

Production disables mock fallback. Development keeps the UI resilient while local microservices are starting up, but all domain services remain isolated and typed.

## Notes

- The frontend does not consume gRPC directly.
- The backend currently lacks REST list endpoints for notification logs, activities, and attendance sessions. The UI marks those surfaces clearly and uses local browser history only as a temporary convenience for created activities, sessions, and downloads.
- Student report exports are displayed as backend-restricted because the current report export endpoints allow `admin` and `docente`.
