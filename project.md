# Project Plan: Full-Stack Art Showcase Web Application

## Overview
A production-ready, containerized, full-stack art exhibition platform for immersive, scroll-driven storytelling. Built for high performance, security, and a luxury gallery experience.

---

## Stack & Architecture
- **Frontend:** React 19 + TypeScript + Vite
- **Animation:** GSAP (ScrollTrigger)
- **Styling:** SCSS Modules (mobile-first, responsive)
- **State:** Redux Toolkit
- **Backend:** Laravel 11 (PHP 8.3)
- **Database:** PostgreSQL
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** Nginx
- **API:** RESTful JSON
- **Image:** Lazy load, WebP, GPU-accelerated

---

## Folder Structure
- `/frontend` — React app
- `/backend` — Laravel app
- `/nginx` — Nginx config
- `/project-knowledge/site-context.json` — Persistent site context
- `docker-compose.yml` — Orchestration
- `.env` — Shared config

---

## Features
- One-page vertical scroll art experience
- Each artwork: 100vh, scroll-animated, masked crop, center reveal, cinematic transition
- GSAP + ScrollTrigger: mask, parallax, inertia, scale, fade, 3D transform
- Responsive: mobile, tablet, desktop, 4K, touch-optimized
- Admin login (Sanctum), CRUD for artworks, image upload
- PostgreSQL: artworks, users (admin), site_settings
- Secure: CORS, env protection
- Performance: code splitting, lazy load, Lighthouse >90
- Dev: hot reload, Laravel queue, Docker up/build, clear README

---

## Database Schema (PostgreSQL)
- **users**: id, name, email, password, is_admin, timestamps
- **artworks**: id, title, description, image, order, animation_style, metadata (JSON), timestamps
- **site_settings**: id, key, value, timestamps

---

## API Endpoints (Backend)
- `POST /api/login` — Admin login
- `POST /api/artworks` — Create artwork
- `PUT /api/artworks/{id}` — Update artwork
- `DELETE /api/artworks/{id}` — Delete artwork
- `POST /api/artworks/{id}/image` — Upload image
- `GET /api/artworks` — List artworks

---

## Frontend Components
- **App** — Root
- **Gallery** — Scroll container
- **ArtworkSection** — 100vh, GSAP-animated
- **ImageMask** — Dynamic mask/clip-path
- **AdminPanel** — CRUD UI
- **Login** — Admin auth
- **ResponsiveLayout** — Adaptive breakpoints

---

## Animation Logic (GSAP)
- Masked crop follows scroll
- Centered image reveal (scale 1.2→1, fade, 3D)
- Parallax layers
- requestAnimationFrame for smoothness
- GPU-accelerated transforms

---

## Nginx
- Reverse proxy: `/api` → backend, `/` → frontend
- Serve static assets

---

## Docker Compose
- Services: frontend, backend, db, nginx
- Volumes: db-data
- Networks: shared

---

## project-knowledge/site-context.json
- Website description
- Design language
- Animation philosophy
- Current artworks
- Layout rules
- Component architecture
- API schema summary

---

## Deployment
- `docker compose up --build`
- Hot reload (frontend/backend)
- Persistent DB
- Secure env

---

## Design Aesthetic
- Minimal, dark luxury
- Cinematic, spatial, high-end gallery
- No external SaaS

---

## Phases

### Phase 1 — Hello World on fly.io ✅
- Static HTML page: "Hello Exibitions"
- Served via Nginx in Docker
- Deployed to fly.io
- Goal: prove the live deployment pipeline works

### Phase 2 — Docker Compose + Project Skeleton ✅
- Set up `/frontend`, `/backend`, `/nginx` folders
- `docker-compose.yml` with frontend, backend, db, nginx services
- `.env` shared config
- Hot reload working locally

### Phase 3 — React + Vite Frontend Scaffold ✅
- React 19 + TypeScript + Vite
- SCSS Modules setup
- Basic routing / single page shell
- Redux Toolkit wired up

### Phase 4 — Laravel Backend Scaffold ✅
- Laravel 11 + PHP 8.3
- PostgreSQL connection
- Sanctum auth configured
- Basic API routes responding

### Phase 5 — Database Schema & Migrations ✅
- `users`, `artworks`, `site_settings` tables
- Seeders for initial admin user and sample artworks
- API endpoints returning real data

### Phase 6 — Gallery UI (Static Content) ✅
- `Gallery` + `ArtworkSection` components
- 100vh sections, responsive layout
- Static artwork data rendered

### Phase 7 — GSAP Animations ✅
- ScrollTrigger: mask, parallax, scale, fade, 3D
- GPU-accelerated transforms
- Mobile/touch optimized

### Phase 8 — Image Handling ✅
- Image upload endpoint
- WebP conversion via GD (512M PHP memory limit)
- Lazy loading, optimized delivery

### Phase 9 — Admin Panel ✅
- Login page (Sanctum token auth)
- CRUD for artworks (create, update, delete)
- Image upload UI per artwork
- Protected route with localStorage token persistence

### Phase 10 — Production Polish ✅
- Code splitting: Login + AdminPanel lazy-loaded
- index.html: proper title, meta description, theme-color
- Production fly.io deploy with all services

---

### Phase 11 — Cinematic Gallery Engine v2 ✅
- Full rewrite of Gallery: single sticky viewport, all images stacked as layers
- Container height = N × 250vh (each artwork owns 250vh of scroll real estate)
- Each image layer: `position: absolute; inset: 0; will-change: clip-path`
- GSAP ScrollTrigger scrub per enter/exit pair with `scrub: 1.5` for silky control
- Z-index choreography: entering image rises above exiting during transition window
- Parallax hold phase: inner image drifts 2% up/down while fully visible

### Phase 12 — Center-Detach Transition System ✅
- **Core mechanic**: clip-path collapses image to a center strip, new image expands from same strip
- **Vertical transitions** (`inset(50% 0% 50% 0%)`): image collapses top+bottom to a horizontal center line, next image opens from that same line outward — like a vertical iris
- **Horizontal transitions** (`inset(0% 50% 0% 50%)`): image collapses left+right to a vertical center line, next image opens outward — like a horizontal iris
- **Alternating pattern**: 4 vertical → 4 horizontal → 4 vertical → repeat (driven by `Math.floor(i / 4) % 2`)
- Inner layer 3D roll: rotateX ±6° (vertical) or rotateY ±6° (horizontal) with `transformPerspective: 1200`
- Blur pulse: entering image blurs (5px → 0px), exiting image blurs (0px → 3px)
- Scale breath: entering image 1.07 → 1.0 (zoom in to settled), exiting 1.0 → 0.96 (slight shrink)

### Phase 13 — Info Layer & Typography ✅
- Artwork title and description overlaid at bottom-left, `position: absolute`
- Gradient mask: `linear-gradient(to top, rgba(0,0,0,0.85), transparent)`
- Title: `font-weight: 300`, large, tracked — cinematic caption feel
- Index number (`01`, `02`…) in muted uppercase above title
- Fade in: `opacity 0→1, y 24→0` during last 30% of enter transition
- Fade out: `opacity 1→0, y 0→-16` at start of exit transition

### Phase 14 — Exhibitions Feature ✅
- New `exhibitions` DB table: id, name, description, slug, cover_image, sort_order, timestamps
- New `artwork_exhibition` pivot: exhibition_id, artwork_id, sort_order
- API: `GET /api/exhibitions`, `GET /api/exhibitions/{slug}` (returns artworks within)
- Admin: create/edit/delete exhibitions, assign & reorder artworks per exhibition
- Gallery: browse exhibitions list → enter exhibition → scrolls through its artworks
- Exhibition intro screen: full-bleed cover image, title, description, scroll-to-enter CTA

### Phase 15 — Atmospheric Visual Layer ✅
- Film grain overlay: animated SVG `<feTurbulence>` filter on a fixed pseudo-element
- Edge vignette: radial gradient `rgba(0,0,0,0.6)` outward from center
- Per-artwork dominant color extracted from image (stored in `metadata.palette`)
- Subtle background color cross-fade between artworks (not on image — on `<body>` or overlay)
- Cursor: custom dot cursor that reacts to scroll velocity (scale 1→1.6 when fast)

### Phase 16 — Mobile & Touch Experience ✅
- Touch swipe detection: vertical swipe advances artwork (threshold: 80px)
- Horizontal swipe: horizontal-transition artworks respond to horizontal swipe
- Reduced motion: `@media (prefers-reduced-motion: reduce)` — disable clip-path transitions, use opacity fade instead
- Mobile typography: smaller title, description hidden on phones under 480px
- iOS momentum scroll: `ScrollTrigger.normalizeScroll(true)` on touch devices

### Phase 17 — Full-Viewport Exhibitions Homepage ✅
- Each exhibition on the homepage fills the full screen (100vh) with its cover image
- Native vertical scroll moves from one full-screen exhibition to the next
- GSAP parallax: cover image drifts subtly as you scroll past each section
- Staggered text entrance: index counter, title, description, and "Enter" CTA animate in as each section enters the viewport
- Cover image fills the entire viewport (`object-fit: cover`), title large at bottom-left, CTA at bottom-right
- Hover: image scales slightly, CTA brightens

### Phase 18 — Scroll-Driven Poem / Description Viewer ✅
- The artwork description is treated as a poem or lyric — split into individual lines by newline (`\n`)
- Lines are grouped into stanzas of 4 lines each; blank lines between groups create visible stanza spacing
- As the user scrolls through the artwork's 250vh, the "current line" advances through the poem
- At any scroll position, up to 7 lines are visible simultaneously, centered vertically on screen:
  - Line -3 (above): ~8% opacity — exists but unreadable, peripheral awareness
  - Line -2: ~10% opacity
  - Line -1: ~15% opacity — previous line, fading into memory
  - **Current line (center)**: ~100% opacity, bright white — the line being read now
  - Line +1 (below): ~15% opacity — coming soon, readable but soft
  - Line +2: ~10% opacity
  - Line +3: ~8% opacity — barely a hint of what's next
- As scroll advances: current line fades up into the "past" opacity chain, next line rises to full white
- The poem display lives in the center of the sticky viewport, overlaid on the artwork image
- The title/index info remains at bottom-left; the poem occupies the vertical center of the screen
- Admin: no changes needed — the existing `description` field on each artwork stores the poem text, with stanza breaks written as blank lines between groups of 4 lines
- **Refinements**:
  - Line height set to 90px for better readability
  - Blank spacers (BlankLinesBeforePoem: 5, BlankLinesAfterPoem: 30) rendered as DOM elements, fully part of scroll mechanics
  - Scroll animation extends through all spacer elements, allowing comfortable reading of last line before transition
  - Snap points only target real text lines, not spacers
  - Track Y animation continues past last line to show trailing blank space
  - Text properly centered with balanced white space before and after

### Phase 18.5 — Admin Panel: Exhibitions CRUD + Persistent Storage ✅
- **Admin exhibition management**: Full CRUD UI in AdminPanel for exhibitions (create, edit, delete, cover image upload)
- **Artwork assignment UI**: Per-exhibition panel to check/uncheck artworks and set sort order
- **UI feedback system**: Success/error toast messages for all operations (image upload, save, delete) with 3-second auto-dismiss
- **Database seeders**: Created `ExhibitionSeeder` with sample exhibitions, integrated into `DatabaseSeeder`
- **Export command**: New Artisan command `php artisan artworks:export-exibitions` to export current exhibitions to seeder format
- **Docker persistent storage**: Added `storage-data` volume in `docker-compose.yml` mounted at `/app/storage`
- **Nginx static file serving**: Updated `/storage` location to serve `alias /app/storage/app/public` with 30-day cache headers instead of proxying to backend
- **Fly.io volume setup**: Added `[mounts]` section in `fly.toml` with 10GB persistent volume at `/app/storage`
- **High-availability deployment**: Scaled to 2 machines on fly.io with automatic volume replication (both machines now have 553 MB of synced image data)
- **Image cache-busting**: Added query parameters to image URLs (`${artwork.image}?t=${artwork.updated_at}&r=${Math.random()}`) to ensure fresh images load after upload

---

## NEXT PHASE

### Phase 19 — Exhibition Detail: Background & Press Clippings ✅
**Layout Design:**
- Full-screen background sections and press sections displayed on **homepage** as part of continuous scrolling experience
- Each exhibition on homepage: intro/cover → background section → press section → (then continues to next exhibition)
- Full-screen background section with **centered text card** + **dynamic color background** (extracted from cover image)
- Full-screen press section with **masonry grid** of clipping cards (2-3 columns responsive)
- Individual exhibition page at `/exhibitions/{slug}` shows only intro + gallery (no background/press)

**Database & Backend:**
- Migration: `background` (text, nullable) and `clippings` (JSON, nullable) columns on exhibitions ✅
- Clippings simplified to 2 fields: `title` + `screenshot_image` (base64 data URL pasted from clipboard) ✅
- Validation: title required, screenshot_image nullable string (accepts base64) ✅

**Admin Panel:**
- Background textarea (5 rows, preserves line breaks with white-space: pre-wrap) ✅
- Clippings manager: title input + paste area for screenshots (Ctrl+V clipboard paste) ✅
- Converts pasted images to base64, stores in screenshot_image field ✅
- Success/error toast notifications with 3-second auto-dismiss ✅

**Frontend - Homepage (Exhibitions.tsx):**
- ClippingEntry interface: `{ title: string; screenshot_image: string | null }` ✅
- Exhibitions component renders: intro → background → press for each exhibition ✅
- Background section: full-screen with masonry grid layout ✅
  - Large exhibition name as watermark background (15vw font, 4% opacity, uppercase)
  - Text content split by double newlines (`\n\n`) into masonry grid cards
  - Frosted glass cards with backdrop blur, semi-transparent borders
  - Responsive grid: 3-4 columns desktop, 3 tablet, auto-fit mobile (minmax 220px)
  - Varied card heights via `nth-child()` selectors for visual rhythm and interest
  - Hover effect: card brightens, lifts slightly (2px translateY)
  - Dynamic background color from dominant image color
- Press section: full-screen height, masonry grid layout (1-3 columns responsive) ✅
- Color extraction: Canvas API utility `extractDominantColor()` darkens colors 30% for contrast ✅
- All sections stacked vertically with smooth transitions

**Frontend - Individual Page (ExhibitionView.tsx):**
- Shows: intro → gallery → **background section** (at the end) ✅
- Background section identical design to homepage with:
  - Large exhibition name watermark
  - Masonry grid of text paragraphs (split by `\n\n`)
  - Dynamic dominant color from cover image
  - Frosted glass cards with hover effects
- Press section NOT shown on individual pages (only on homepage) ✅

### Phase 20 — Preloading & Performance
- Prefetch next artwork image: `<link rel="prefetch">` injected dynamically after current image loads
- Intersection Observer to mount/unmount distant layers (> ±2 from active)
- Vite `build.rollupOptions.output.manualChunks` to split GSAP into its own chunk
- `will-change: clip-path, transform` on transitioning layers, removed after transition ends
- Lazy hydration: artwork info text deferred until image enters viewport

### Phase 21 — Final Production Deploy
- All services running on fly.io with Postgres
- `flyctl secrets set` for all production env vars
- Custom domain + SSL via fly.io certs
- Lighthouse audit: Performance ≥ 90, Accessibility ≥ 90, SEO ≥ 90
- Error boundary wrapping Gallery and AdminPanel
- `fly.toml` health check endpoint verified

---

# Add images, artworks, and further details as the project evolves.
