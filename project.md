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

### Phase 5 — Database Schema & Migrations
- `users`, `artworks`, `site_settings` tables
- Seeders for initial admin user and sample artworks
- API endpoints returning real data

### Phase 6 — Gallery UI (Static Content)
- `Gallery` + `ArtworkSection` components
- 100vh sections, responsive layout
- Static artwork data rendered

### Phase 7 — GSAP Animations
- ScrollTrigger: mask, parallax, scale, fade, 3D
- GPU-accelerated transforms
- Mobile/touch optimized

### Phase 8 — Image Handling
- Image upload endpoint
- WebP conversion
- Lazy loading, optimized delivery

### Phase 9 — Admin Panel
- Login page (Sanctum)
- CRUD for artworks
- Image upload UI

### Phase 10 — Production Polish
- Lighthouse >90
- Code splitting, final performance pass
- Full README
- Production fly.io deploy with all services

---

# Add images, artworks, and further details as the project evolves.
