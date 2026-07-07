# Project Plan: Exibitions — Full-Stack Art Showcase Web Application

## Overview
A production-ready, containerized, full-stack art exhibition platform for immersive, scroll-driven storytelling. Built for high performance, security, and a luxury gallery experience. Visitors browse exhibitions on a single-page vertical scroll site; each exhibition contains an intro cover, a background section, a press/clippings section, and a scroll-driven poem gallery of artworks.

**Live production:** https://exibit.strubloid.com
**Local development:** http://localhost:8080

---

## Stack & Architecture
- **Frontend:** React 19 + TypeScript + Vite 7 + React Router 7
- **State:** Redux Toolkit (artworks, exhibitions, auth slices)
- **Animation:** GSAP + ScrollTrigger (clip-path iris transitions, parallax, scroll-driven poem viewer, card slide-ins with golden shimmer)
- **Styling:** SCSS Modules (mobile-first, responsive), custom PNG cursor, edge vignette, film grain
- **Backend:** Laravel 11 (PHP 8.3) — RESTful JSON API
- **Auth:** Laravel Sanctum (token-based admin auth)
- **Database:** PostgreSQL 16
- **Image processing:** GD (server-side WebP conversion, dual-quality full + compressed, dominant-color palette extraction)
- **Reverse Proxy:** Nginx
- **Containerization:** Docker + Docker Compose (dev), single-image multi-stage Dockerfile (production)
- **Process manager:** Supervisord (nginx + php artisan serve in one fly.io machine)
- **Deployment:** Fly.io (single machine, 1GB RAM, 10GB persistent volume)

---

## Folder Structure
```
/
├── frontend/                 React + Vite SPA
│   ├── src/
│   │   ├── App.tsx           Routes (/, /exhibition/:slug, /login, /admin)
│   │   ├── main.tsx          Redux Provider + root render
│   │   ├── components/
│   │   │   ├── Exhibitions/    Homepage — full-screen exhibition sections
│   │   │   ├── ExhibitionView/  Individual exhibition page
│   │   │   ├── Gallery/         Scroll-driven poem gallery engine
│   │   │   ├── AdminPanel/      CRUD admin UI (artworks + exhibitions)
│   │   │   ├── Login/           Sanctum token login
│   │   │   ├── ArtworkSection/  Legacy single-artwork section (useGsapAnimation)
│   │   │   └── CustomCursor/    (empty — reserved)
│   │   ├── store/              Redux slices (artworks, exhibitions, auth)
│   │   ├── hooks/              useGsapAnimation
│   │   ├── utils/              extractDominantColor (Canvas API)
│   │   └── styles/             global.scss
│   ├── vite.config.ts         Proxy /api → backend:8000
│   └── package.json
├── backend/                  Laravel 11 app
│   ├── app/
│   │   ├── Http/Controllers/  Artwork, Exhibition, Auth
│   │   ├── Models/            Artwork, Exhibition, User, SiteSetting
│   │   └── Console/Commands/  Export-to-seeder commands
│   ├── database/
│   │   ├── migrations/        10 migrations (users, cache, jobs, artworks, exhibitions, pivot, tokens, settings, compressed images, background+clippings)
│   │   └── seeders/           Admin, Artwork, Exhibition
│   ├── routes/api.php
│   ├── config/                Laravel + Sanctum config
│   ├── Dockerfile             Dev image (scaffolds Laravel on first run)
│   ├── entrypoint.sh          Dev entrypoint
│   └── composer.json
├── nginx/
│   ├── default.conf           Dev proxy (frontend:5173, backend:8000)
│   └── production.conf        Production (static SPA + proxy to 127.0.0.1:8000)
├── Dockerfile                 Multi-stage: React build → nginx + PHP + supervisord
├── docker-compose.yml         Dev orchestration (nginx, frontend, backend, db)
├── entrypoint.production.sh   Fly.io entrypoint (writes .env, runs migrations/seeds, starts supervisord)
├── supervisord.conf           nginx + php artisan serve
├── fly.toml                   Fly.io app config (region iad, port 80, 1GB VM, 10GB volume)
├── .env.example               Shared config template
└── project.md                This file
```

---

## Database Schema (PostgreSQL)

### `users`
- id, name, email (unique), email_verified_at, password, is_admin (bool), remember_token, timestamps

### `artworks`
- id, title, description (text, nullable), image (nullable), image_compressed (nullable), sort_order (int, default 0), animation_style (default 'fade'), metadata (JSON, nullable — stores `palette` array), timestamps

### `exhibitions`
- id, name, description (text, nullable), background (text, nullable), clippings (JSON, nullable — array of `{title, screenshot_image}`), slug (unique), cover_image (nullable), cover_image_compressed (nullable), sort_order (int, default 0), timestamps

### `artwork_exhibition` (pivot)
- exhibition_id (FK, cascade delete), artwork_id (FK, cascade delete), sort_order (int, default 0)
- Primary key: (exhibition_id, artwork_id)

### `site_settings`
- id, key (unique), value (text, nullable), timestamps

### Laravel default tables
- `personal_access_tokens` (Sanctum), `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `sessions`, `password_reset_tokens`

---

## API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/artworks`           | List all artworks (ordered by sort_order) |
| GET  | `/api/exhibitions`        | List all exhibitions (ordered by sort_order) |
| GET  | `/api/exhibitions/{slug}` | Get single exhibition with its artworks (via pivot, ordered by sort_order) |
| POST | `/api/login`              | Admin login, returns Sanctum token |

### Admin (requires `Authorization: Bearer <token>`)
| Method | Path | Description |
|--------|------|-------------|
| POST  | `/api/logout`                          | Revoke current token |
| POST  | `/api/artworks`                        | Create artwork |
| PUT   | `/api/artworks/{artwork}`              | Update artwork |
| DELETE| `/api/artworks/{artwork}`              | Delete artwork |
| POST  | `/api/artworks/{artwork}/image`        | Upload image — converts to WebP (Q85 full + Q60 compressed ≤1200px), extracts palette, updates metadata |
| POST  | `/api/exhibitions`                     | Create exhibition (slug auto-generated from name if not provided) |
| PUT   | `/api/exhibitions/{exhibition}`        | Update exhibition (name, description, background, clippings, slug, sort_order) |
| DELETE| `/api/exhibitions/{exhibition}`        | Delete exhibition |
| POST  | `/api/exhibitions/{exhibition}/image`  | Upload cover image — WebP full + compressed |
| POST  | `/api/exhibitions/{exhibition}/clipping-screenshot` | Upload clipping screenshot as WebP |
| POST  | `/api/exhibitions/{exhibition}/artworks` | Sync artworks to exhibition (pivot with sort_order) |

### Artisan commands
- `php artisan artworks:export-seeder` — export current artworks to seeder-format PHP array
- `php artisan artworks:export-exibitions` — export current exhibitions to seeder-format PHP array

---

## Frontend Components

### App.tsx — Routing
- `/`                → Exhibitions (homepage)
- `/exhibition/:slug`→ ExhibitionView (lazy-loaded)
- `/login`           → Login (lazy-loaded)
- `/admin`           → AdminPanel (lazy-loaded, ProtectedRoute requires auth token)

### Exhibitions (Homepage)
- Fetches all exhibitions via Redux (`fetchExhibitions`)
- If no exhibitions exist, falls back to global artworks Gallery
- Each exhibition renders as a full-screen (100vh) section:
  - Cover image with parallax (GSAP yPercent -8 → 8)
  - Staggered text entrance (index counter, name, short description, "Enter →" CTA)
  - Background button → smooth-scrolls to background card section
  - Press button → smooth-scrolls to clipping card section
  - Click navigates to `/exhibition/:slug`
- Background section: sticky pattern, masonry grid of text cards (split by `\n`), dominant-color background extracted from cover image, cards slide in from alternating sides with golden shimmer sweep + brightness fade-in
- Press section: sticky pattern, masonry grid of clipping cards (title + screenshot image), click opens modal with full screenshot
- Mobile (< 768px): cards animate in rows of 3, shorter scroll distances

### ExhibitionView (individual exhibition page)
- Fetches single exhibition by slug via Redux (`fetchExhibition`)
- Renders: intro (cover + name + description + scroll CTA) → Gallery (artworks) → background section → clippings section
- Background section identical design to homepage but with scroll-driven rainbow background (hue 0→360 via HSL)
- Clippings section also gets scroll-driven rainbow background
- Clipping click opens modal

### Gallery (Cinematic Poem Engine)
- Single sticky viewport; all artwork images stacked as absolute layers
- Container height = N × (per-artwork scroll space) computed dynamically
- Scroll timing knobs (desktop): 80vh per image transition, 7vh settle before poem, 8vh per poem line
- Mobile knobs: 40vh transition, 3vh settle, 4vh per poem line
- Transition directions alternate every 4 artworks: vertical iris (collapse to horizontal center line) → horizontal iris (collapse to vertical center line)
- Each transition: clip-path collapse/expand, inner image scale breath (1.05→1 enter, 1→0.97 exit), info fade+y
- Parallax hold phase: inner image drifts yPercent 1.5 → -1.5 during full visibility
- Color fog: body background cross-fades to artwork's palette[0] color on entry
- Poem viewer: artwork description split into lines by `\n`, blank lines collapse to single spacers, stanzas form naturally. Up to 7 lines visible simultaneously with opacity gradient (active 100%, neighbors 50%→25%→0%), active line scaled 1.3×, scroll advances current line, snap to real lines only (disabled on mobile)
- Mobile (< 768px): simplified opacity cross-fades replace clip-path iris, no scroll snapping, no swipe-to-jump, reduced scroll distances
- `prefers-reduced-motion`: same simplified animations
- Touch swipe jump-to-nearest-artwork enabled only on non-mobile touch devices (tablets)

### AdminPanel
- Two tabs: Artworks and Exhibitions
- Artworks tab: create/edit/delete artworks, upload image (auto WebP + palette extraction), sort order, animation style (fade | mask-reveal | parallax)
- Exhibitions tab: create/edit/delete exhibitions, cover image upload, background textarea, clippings manager (title + paste-from-clipboard screenshot as base64), slug (auto if empty), sort order, artwork assignment panel with checkboxes + per-artwork sort order
- All operations show success/error toast (3-second auto-dismiss)
- Image cache-busting on thumbnails (`?t=${updated_at}&r=${random}`)

### Login
- Sanctum token login form, stores token in localStorage (`admin_token`), redirects to /admin on success

### ArtworkSection (legacy)
- Single artwork section with `useGsapAnimation` hook (mask-reveal / parallax / fade)
- Used only by older code paths; Gallery supersedes it

---

## Image Handling
- Server-side GD conversion: JPEG/PNG/WebP → WebP
- Artworks: full-quality WebP (Q85) + compressed WebP (≤1200px longest edge, Q60), stored at `/storage/artworks/{id}.webp` and `{id}-compressed.webp`
- Exhibitions: cover image full + compressed, stored at `/storage/exhibitions/exhibition-{id}.webp`
- Clippings: screenshot WebP at `/storage/exhibitions/clippings/`
- Palette extraction: GD samples 3 zones (full image, center crop, bottom third), each reduced to 1×1 pixel, returns `['#rrggbb', ...]` stored in `artworks.metadata.palette`
- Frontend `extractDominantColor`: Canvas API downsample to 50×50, average all pixels, darkened 30% for background contrast
- Image cache-busting on admin thumbnails

---

## Docker & Deployment

### Local Development (docker-compose)
```
docker-compose up --build
```
- **URL:** http://localhost:8080  (nginx maps host port 8080 → container 80)
- Services:
  - **nginx** — reverse proxy: `/` → frontend:5173, `/api` and `/storage` → backend:8000
  - **frontend** — node:20-alpine, `npm install && npm run dev` (Vite dev server on 5173), proxies `/api` → backend:8000
  - **backend** — builds from backend/Dockerfile, entrypoint.sh scaffolds Laravel on first run, runs migrations + seeders, starts `php artisan serve` on 8000
  - **db** — postgres:16-alpine, credentials from .env
- Volumes: db-data (Postgres), storage-data (uploaded images)
- Hot reload: frontend via Vite HMR, backend via bind mount

### Production (fly.io — single multi-stage image)
- **Dockerfile**: Stage 1 builds React frontend (`npm run build` → dist/), Stage 2 is php:8.3-cli with nginx + supervisord
- **entrypoint.production.sh**: parses `DATABASE_URL` into individual vars, writes `/app/.env` from fly.io secrets, runs `migrate` + `db:seed`, starts supervisord (nginx + php artisan serve)
- **nginx/production.conf**: serves React SPA from `/usr/share/nginx/html` (try_files → index.html for SPA routing), proxies `/api` and `/storage` to `127.0.0.1:8000`
- **fly.toml**: app `exibitions`, region `iad`, internal_port 80, force_https, auto_stop/start machines, 1GB RAM shared CPU, 10GB persistent volume at `/app/storage`
- **Production URL:** https://exibit.strubloid.com

---

## Seeders
- **AdminUserSeeder**: creates admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env (defaults: admin@exibitions.com / secret)
- **ArtworkSeeder**: seeds 6 sample artworks (Agony, Arousal, Longing, Recognition, Hope, Fading Away) with poems and palette metadata — only if table empty
- **ExhibitionSeeder**: seeds 1 sample exhibition (Morte e Vida Severina) — only if table empty
- **DatabaseSeeder**: calls all three in order

---

## Environment Variables (.env / .env.example)

### App
- `APP_NAME`, `APP_ENV`, `APP_DEBUG`, `APP_URL`, `APP_TIMEZONE`, `APP_LOCALE`, `APP_KEY`

### Database (local)
- `DB_CONNECTION` (default pgsql), `DB_HOST` (default db), `DB_PORT` (default 5432), `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`

### Database (fly.io)
- `DATABASE_URL` — parsed by entrypoint.production.sh

### Postgres container
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

### Admin
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`

### Session / Cache / Logging
- `SESSION_DRIVER` (default file), `SESSION_LIFETIME`, `CACHE_STORE` (default file), `QUEUE_CONNECTION` (default sync), `LOG_CHANNEL` (default stderr), `LOG_LEVEL`

---

## Design Aesthetic
- Minimal, dark luxury — black background (#000), Georgia serif font, white text
- Cinematic, spatial, high-end gallery feel
- Edge vignette (radial gradient, softer on mobile)
- Custom PNG cursor
- Per-artwork dominant color cross-fades the background fog
- Golden shimmer sweeps across background/clipping cards as they slide in
- No external SaaS dependencies

---

## Phases (historical record — all completed)

### Phase 1 — Hello World on fly.io ✅
### Phase 2 — Docker Compose + Project Skeleton ✅
### Phase 3 — React + Vite Frontend Scaffold ✅
### Phase 4 — Laravel Backend Scaffold ✅
### Phase 5 — Database Schema & Migrations ✅
### Phase 6 — Gallery UI (Static Content) ✅
### Phase 7 — GSAP Animations ✅
### Phase 8 — Image Handling ✅
### Phase 9 — Admin Panel ✅
### Phase 10 — Production Polish ✅
### Phase 11 — Cinematic Gallery Engine v2 ✅
### Phase 12 — Center-Detach Transition System ✅
### Phase 13 — Info Layer & Typography ✅
### Phase 14 — Exhibitions Feature ✅
### Phase 15 — Atmospheric Visual Layer ✅
### Phase 16 — Mobile & Touch Experience ✅
### Phase 17 — Full-Viewport Exhibitions Homepage ✅
### Phase 18 — Scroll-Driven Poem / Description Viewer ✅
### Phase 18.5 — Admin Panel: Exhibitions CRUD + Persistent Storage ✅
### Phase 19 — Exhibition Detail: Background & Press Clippings ✅
### Phase 20 — Mobile Experience Overhaul ✅

### Phase 21 — Preloading & Performance (planned)
- Prefetch next artwork image: `<link rel="prefetch">` injected dynamically after current image loads
- Intersection Observer to mount/unmount distant layers (> ±2 from active)
- Vite `build.rollupOptions.output.manualChunks` to split GSAP into its own chunk
- `will-change: clip-path, transform` on transitioning layers, removed after transition ends
- Lazy hydration: artwork info text deferred until image enters viewport

### Phase 22 — Final Production Deploy (planned)
- All services running on fly.io with Postgres
- `flyctl secrets set` for all production env vars
- Custom domain + SSL via fly.io certs
- Lighthouse audit: Performance ≥ 90, Accessibility ≥ 90, SEO ≥ 90
- Error boundary wrapping Gallery and AdminPanel
- `fly.toml` health check endpoint verified