# Oakvale Learning Jobs Portal

A credentialed staffing marketplace — Diaspora caregiving + Corporate crèche pipelines, with verified, CPD-accredited Nigerian care workers.

> Internal / developer use. See `CLAUDE.md` for the authoritative architecture spec and `BUILD_PLAN.md` for the 18-week roadmap.

## Phase 0 — what's in this scaffold

- **Backend** (Fastify + Drizzle ORM + Postgres + Redis + BullMQ + Pino), with the **auth** module fully wired: register, email-verify, login, refresh, logout, forgot/reset. Refresh tokens rotate; sessions are stored in both Postgres and Redis.
- **Frontend** (Next.js 14 App Router, Tailwind, TanStack Query, Zustand) with a designed shell: landing, login/register/forgot/reset, and dashboard skeletons for Worker, Diaspora employer, Corporate employer, and Admin.
- **Infra**: Docker Compose with `postgres`, `redis`, `backend`, `frontend`, `nginx`, `adminer`, `redis-commander`.
- **Shared zod schemas** in `packages/shared` for request validation on both ends.

The UI surfaces "jobs board" as a small uppercase tagline beside the Oakvale wordmark in the nav, auth header, and dashboard sidebars — the product name stays Oakvale.

## Run it

Prereqs: Docker, Docker Compose v2.

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

Then:

- App (via nginx): http://localhost
- Backend direct: http://localhost:3000/health → `{ "status": "ok", "db": "ok", "redis": "ok" }`
- Adminer (Postgres GUI): http://localhost:8080 — system: PostgreSQL · server: postgres · user: oakvale · password: oakvale · db: oakvale_jobs
- Redis Commander: http://localhost:8081

The backend container runs `npm run db:migrate` on boot, so tables and triggers are created automatically.

## Try the auth flow

1. Open http://localhost/register and create a `WORKER` account.
2. The OTP verification code is logged to the backend container — `docker compose -f infra/docker-compose.yml logs -f backend` and look for `[notifier:stub]`.
3. Log in at http://localhost/login. You'll land on `/worker/dashboard`.

## Backend tests

```bash
cd backend
npm install
npm test
```

Unit tests cover token generation, refresh-token parsing, OTP shape, and the shared Zod schemas.

## Repo layout

```
backend/    Fastify modular monolith (auth module wired; other modules scaffolded)
frontend/   Next.js 14 App Router with route groups (marketing|auth|worker|employer|admin)
packages/   Shared Zod schemas & role enums
infra/      docker-compose.yml + nginx config
```

## What's next

`BUILD_PLAN.md` Phases 1–9 in order. The next slice is the **worker portal MVP** (12 profile sections, document upload via R2 pre-signed URLs, profile completion scoring, submit-for-review).

## Conventions

See `CLAUDE.md`. Highlights: TypeScript strict, no `any`, Drizzle (not Prisma), Fastify (not Express), modular monolith (no microservices), all errors as `AppError`, no business logic in route handlers, no barrel `index.ts` re-exports.
