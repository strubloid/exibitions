# Exibitions

Immersive, scroll-driven art exhibition platform. Visitors browse exhibitions on a single-page vertical scroll site with cinematic GSAP transitions, a poem-line viewer, and golden shimmer card reveals. Admins manage artworks and exhibitions through a built-in admin panel.

**Live:** https://exibit.strubloid.com  
**Local:** http://localhost:8080

---

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 19, TypeScript, Vite 7, React Router 7, Redux Toolkit |
| Animation  | GSAP + ScrollTrigger |
| Styling    | SCSS Modules |
| Backend    | Laravel 11 (PHP 8.3) |
| Auth       | Laravel Sanctum (token-based) |
| Database   | PostgreSQL 16 |
| Images     | GD — server-side WebP conversion + palette extraction |
| Proxy      | Nginx |
| Deploy     | Fly.io (single machine, supervisord, 10GB volume) |
| Dev        | Docker Compose (nginx + frontend + backend + db) |

---

## Quick Start

### Prerequisites
- Docker + Docker Compose v1 (`docker-compose`)
- Node 20+ (for local frontend dev without Docker)
- PHP 8.3+ (for local backend dev without Docker)

### Run with Docker Compose
```bash
cp .env.example .env
docker-compose up --build
```

Open http://localhost:8080

The stack:
- **nginx** (8080:80) — reverse proxy
- **frontend** (Vite dev server, HMR)
- **backend** (Laravel, `php artisan serve`)
- **db** (PostgreSQL 16)

On first run the backend container scaffolds Laravel, runs migrations and seeders automatically.

### Admin Panel
Navigate to `/login` and sign in with the seeded admin credentials (from `.env`):
```
ADMIN_EMAIL=admin@exibitions.com
ADMIN_PASSWORD=secret
```
Then go to `/admin` to manage artworks and exhibitions.

---

## Project Structure

```
frontend/          React SPA (Vite)
  src/
    components/     Exhibitions, ExhibitionView, Gallery, AdminPanel, Login, ArtworkSection
    store/         Redux slices (artworks, exhibitions, auth)
    hooks/         useGsapAnimation
    utils/         extractDominantColor
backend/           Laravel 11 API
  app/
    Http/Controllers/  Artwork, Exhibition, Auth
    Models/           Artwork, Exhibition, User, SiteSetting
    Console/Commands/ Export-to-seeder commands
  database/
    migrations/       10 migrations
    seeders/          Admin, Artwork, Exhibition
nginx/             Dev + production nginx configs
Dockerfile         Multi-stage production image (React build + nginx + PHP + supervisord)
docker-compose.yml Dev orchestration
fly.toml           Fly.io deployment config
project.md         Detailed architecture and phase history
```

---

## API Overview

### Public
- `GET /api/artworks` — list all artworks
- `GET /api/exhibitions` — list all exhibitions
- `GET /api/exhibitions/{slug}` — single exhibition with artworks
- `POST /api/login` — admin login (returns Sanctum token)

### Admin (Bearer token required)
- `POST /api/logout`
- `POST/PUT/DELETE /api/artworks[/{id}]` — CRUD
- `POST /api/artworks/{id}/image` — upload + WebP conversion + palette extraction
- `POST/PUT/DELETE /api/exhibitions[/{id}]` — CRUD
- `POST /api/exhibitions/{id}/image` — cover image upload
- `POST /api/exhibitions/{id}/artworks` — sync artworks to exhibition
- `POST /api/exhibitions/{id}/clipping-screenshot` — clipping screenshot upload

---

## Key Features

### Cinematic Gallery Engine
- Scroll-driven vertical progression through artworks
- Alternating iris clip-path transitions (vertical/horizontal collapse)
- Parallax image drift during hold phases
- Per-artwork dominant color cross-fades the background fog
- Scroll-driven poem viewer — description text revealed line by line with opacity gradient and scale emphasis on the active line
- Snap-to-line scrolling (desktop only)
- Mobile (<768px): simplified opacity cross-fades, shorter scroll distances, no snap
- `prefers-reduced-motion`: same simplified animations

### Exhibitions Homepage
- Each exhibition is a full-screen section with parallax cover image
- Staggered text entrance animations
- Click navigates to individual exhibition page
- Background section: sticky scroll pattern, text cards slide in from alternating sides with golden shimmer sweep
- Press section: clipping cards with click-to-enlarge screenshot modal
- Dominant color extracted from cover image sets the section background

### Exhibition Detail Page
- Cover intro → Gallery of artworks → background section → press clippings
- Scroll-driven rainbow hue (HSL 0→360) on background and clippings sections
- Clipping modal for full screenshot view

### Admin Panel
- Two tabs: Artworks and Exhibitions
- Full CRUD with image upload (auto WebP + palette extraction)
- Clipping screenshots paste-from-clipboard
- Artwork assignment to exhibitions with per-artwork sort order
- Toast feedback on all operations

### Image Processing
- Server-side GD: JPEG/PNG → WebP (Q85 full, Q60 compressed ≤1200px)
- Palette extraction: 3-zone sampling → `['#rrggbb', ...]` stored in artwork metadata
- Frontend Canvas-based dominant color extraction for exhibition backgrounds
- Cache-busting on admin thumbnails

---

## Deployment (Fly.io)

The production image is a single multi-stage Dockerfile:
1. Stage 1: builds the React frontend (`npm run build`)
2. Stage 2: PHP 8.3 CLI + nginx + supervisord — serves the SPA statically and proxies `/api` + `/storage` to `php artisan serve`

```bash
# Deploy
fly deploy

# Set secrets
fly secrets set APP_KEY=... ADMIN_EMAIL=... ADMIN_PASSWORD=... DATABASE_URL=...
```

`fly.toml` configures: region `iad`, internal port 80, force HTTPS, auto-stop/start machines, 1GB RAM, 10GB persistent volume at `/app/storage`.

`entrypoint.production.sh` parses `DATABASE_URL`, writes `.env`, runs migrations and seeders, then starts supervisord.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
APP_NAME=Exibitions
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8080
APP_KEY=

DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=exibitions
DB_USERNAME=exibitions
DB_PASSWORD=secret

POSTGRES_DB=exibitions
POSTGRES_USER=exibitions
POSTGRES_PASSWORD=secret

ADMIN_EMAIL=admin@exibitions.com
ADMIN_PASSWORD=secret

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
LOG_CHANNEL=stderr
```

For fly.io production, set these via `fly secrets set` instead. `DATABASE_URL` is parsed by the entrypoint script.

---

## License

MIT