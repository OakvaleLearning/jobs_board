# CLAUDE.md — Oakvale Learning Jobs Portal

> This file is the authoritative context document for AI coding assistants working on this codebase.
> Read this fully before writing any code, suggesting any refactor, or answering any architecture question.

---

## Project Overview

**Product:** Oakvale Learning Jobs Portal  
**Purpose:** A credentialed staffing marketplace connecting two employer pipelines (Diaspora Caregiving + Corporate Crèche) with verified, CPD-accredited Nigerian care/childcare workers.  
**Launch Target:** July 2026  
**Confidentiality:** Internal / Developer use only

The platform is NOT a generic jobs board. It is a trust-and-credentials infrastructure layered with a marketplace. Every feature decision should reinforce verification, accountability, and placement quality over volume.

---

## Architecture

### Pattern: Modular Monolith

The backend is a **Node.js modular monolith** — a single deployable process subdivided into discrete domain modules with hard internal boundaries. Do NOT split into microservices. Do NOT allow cross-module direct DB queries. All inter-module communication goes through the module's public service interface.

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── workers/
│   │   ├── employers/
│   │   ├── placements/
│   │   ├── verification/
│   │   ├── compliance/
│   │   ├── notifications/
│   │   ├── payments/
│   │   └── admin/
│   ├── shared/
│   │   ├── db/          # Postgres client, migrations, pool
│   │   ├── cache/       # Redis client
│   │   ├── queue/       # BullMQ job queues
│   │   ├── events/      # Internal event bus (EventEmitter)
│   │   ├── storage/     # R2 file storage client
│   │   └── utils/
│   ├── http/
│   │   ├── middleware/
│   │   └── router.ts    # Mounts module routers
│   └── app.ts
frontend/                # Next.js 14+ App Router
infra/
├── docker-compose.yml
├── docker-compose.prod.yml
└── nginx/
```

### Tech Stack

| Layer | Choice |
|---|---|
| Backend runtime | Node.js 22 LTS |
| Backend language | TypeScript (strict mode) |
| Backend framework | Fastify (not Express — better perf + schema validation) |
| ORM / Query builder | Drizzle ORM (type-safe, minimal abstraction, plays well with Postgres) |
| Database | PostgreSQL 16 |
| Cache / Queue broker | Redis 7 (via Upstash or self-hosted) |
| Job queues | BullMQ (on Redis) |
| File storage | Cloudflare R2 |
| Frontend | Next.js 14+ (App Router) |
| Frontend state | Zustand (client), React Query / TanStack Query (server state) |
| Auth | JWT (access + refresh tokens). Fastify-JWT. No third-party auth service. |
| Payments | Stripe (GBP/USD — diaspora pipeline) + Paystack (NGN — corporate pipeline) |
| Background checks | Worker-uploaded documents, admin-reviewed (no external provider) |
| Email/SMS | Resend (email) + Termii or Twilio (SMS/WhatsApp Nigeria) |
| Containerisation | Docker + Docker Compose |
| Reverse proxy | Nginx (in docker-compose) |

---

## Domain Modules — Responsibilities & Boundaries

### `auth`
- Registration, login, token refresh, logout, password reset
- Role-based: `WORKER`, `INDIVIDUAL_EMPLOYER`, `EMPLOYER_CORPORATE`, `AGENT`, `ADMIN`
- JWT: 15min access token, 7d refresh token (stored in Redis with revocation support)
- **Owns:** `users` table, `sessions` table
- **Never** import from `workers` or `employers` directly — emit events

### `workers`
- Worker profile CRUD (all sections A–M from the proforma data spec)
- Profile completion % calculation (tracked field)
- Document upload orchestration (calls `storage` shared module)
- Worker search/filter (Postgres full-text + indexed filters)
- **Owns:** `workers`, `worker_documents`, `worker_skills`, `worker_experience`, `worker_education`, `worker_references` tables
- **Exposes:** `WorkerService.findById()`, `WorkerService.search()`, `WorkerService.getProfileCompletion()`

### `employers`
- Employer profile CRUD for both pipeline types (diaspora family + corporate HR)
- Needs assessment form data (diaspora: care recipient details; corporate: crèche requirements)
- Job posting management (corporate pipeline)
- **Owns:** `employers`, `employer_needs_assessments`, `job_postings` tables
- Discriminator column `employer_type: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE'` on employers table

### `placements`
- Shortlist generation (3–5 matched workers per employer request)
- Placement lifecycle: `SHORTLISTED → INTERVIEWING → SELECTED → ACTIVE → COMPLETED | TERMINATED`
- 90-day replacement guarantee window tracking
- Replacement SLA enforcement (5 days diaspora / 3 days corporate)
- Welfare check scheduling and logging
- **Owns:** `placements`, `shortlists`, `welfare_checks`, `placement_ev
ents` tables
- **Key business rule:** replacement within 90-day window = no additional fee. Flag this clearly in placement records.

### `verification`
- Identity document verification workflow (NIN, passport, voter's card)
- Background check = worker-uploaded documents (police character certificate, guarantor/attestation
  letter, sworn affidavit) reviewed manually by an admin (Clear / Flagged). No automated provider.
  The background result is **advisory** — it shows as a badge but does NOT gate worker visibility.
- Selfie/liveness check integration
- Verification status state machine: `PENDING → SUBMITTED → IN_REVIEW → VERIFIED | REJECTED | FLAGGED`
- **Owns:** `verification_requests`, `background_checks` tables
- Background checks are triggered automatically on profile approval by admin

### `compliance`
- CPD certificate management (upload, expiry tracking)
- Oakvale programme certification status
- Annual CPD refresh scheduling and notifications
- Professional membership records
- Immunisation status (optional)
- **Owns:** `cpd_records`, `certifications`, `compliance_flags` tables
- **Key rule:** a worker must have `verification.status = VERIFIED` AND `compliance.oakvale_certified = true` before their profile is made publicly visible

### `notifications`
- Unified notification dispatch (email, SMS, in-app)
- Template-based: welfare check reminders, CPD expiry alerts, placement updates, replacement SLA warnings
- BullMQ consumer — all notifications are queued, never sent inline
- **Owns:** `notification_log` table
- Uses Resend for email, Termii for SMS/WhatsApp

### `payments`
- Stripe integration (diaspora pipeline — GBP/USD)
- Paystack integration (corporate pipeline — NGN)
- Invoice generation and tracking (30-day net terms for corporates)
- Subscription management (annual employer subscriptions)
- **Owns:** `invoices`, `payments`, `subscriptions` tables
- **Key rule:** placement is only activated after payment confirmation (webhook-driven)

### `admin`
- Agent (BDM, Liaison Nurse, Recruiter) interfaces
- Verification checklist dashboard
- Candidate assignment to job openings
- Placement history, notes, flags
- KPI dashboard data endpoints
- Owns no tables — reads across modules via service interfaces only

---

## Database Conventions

- All tables use `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- All tables have `created_at TIMESTAMPTZ DEFAULT now()` and `updated_at TIMESTAMPTZ DEFAULT now()`
- `updated_at` is maintained via a Postgres trigger (not application-level)
- Soft deletes: `deleted_at TIMESTAMPTZ NULL` on any entity that may need audit trail
- Migrations managed with Drizzle Kit (`drizzle-kit generate` → `drizzle-kit migrate`)
- Never write raw SQL migrations by hand — always go through Drizzle schema first
- Index all foreign keys. Index all filterable/searchable columns explicitly.
- JSONB columns are acceptable for flexible config/metadata but must NOT be used for anything that needs to be queried/filtered — normalise those into columns

### Key Postgres Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram indexes for name search
CREATE EXTENSION IF NOT EXISTS "unaccent";    -- for name search normalisation
```

---

## Redis Usage

| Purpose | Key pattern | TTL |
|---|---|---|
| Refresh token store | `rt:{userId}:{tokenId}` | 7d |
| Email verification OTP | `otp:email:{userId}` | 10min |
| Phone OTP | `otp:phone:{userId}` | 5min |
| Worker search cache | `search:workers:{hash}` | 5min |
| Profile completion cache | `profile:completion:{workerId}` | 10min |
| Rate limiting | `ratelimit:{ip}:{route}` | sliding window |
| BullMQ queues | Managed by BullMQ — do not manually key these |

Use `ioredis`. Never use `redis` (the older package). Always set TTLs. Never store sensitive PII in Redis beyond what is needed for the listed purposes.

---

## BullMQ Job Queues

| Queue name | Workers | Purpose |
|---|---|---|
| `notifications` | 2 | Email + SMS dispatch |
| `welfare-checks` | 1 | Schedule and log welfare check reminders |
| `cpd-reminders` | 1 | CPD expiry notification jobs |
| `document-processing` | 2 | Post-upload virus scan + metadata extraction |
| `replacement-sla` | 1 | Monitor active placements for SLA breach risk |

All queue processors live in `src/modules/<module>/queues/`. Queue definitions (name, concurrency, retry config) are centralised in `src/shared/queue/queues.ts`.

---

## API Design

- All routes prefixed `/api/v1/`
- Versioning in URL path (not headers)
- JSON request/response throughout
- Fastify schema validation on every route (no unvalidated inputs ever reach handler)
- Error format:
  ```json
  { "error": { "code": "PLACEMENT_NOT_FOUND", "message": "...", "statusCode": 404 } }
  ```
- Success format (single resource): `{ "data": { ... } }`
- Success format (collection): `{ "data": [...], "meta": { "total": n, "page": n, "limit": n } }`
- Auth: Bearer token in `Authorization` header. Role guards via Fastify preHandler hooks.

### Route Structure (per module)
```
/api/v1/auth/...
/api/v1/workers/...
/api/v1/employers/...
/api/v1/placements/...
/api/v1/verification/...
/api/v1/compliance/...
/api/v1/payments/...
/api/v1/admin/...
/api/v1/webhooks/stripe
/api/v1/webhooks/paystack
```

Webhook routes bypass auth middleware but validate payload signatures.

---

## File Upload Rules

- All uploads go to S3/R2 via pre-signed URL (frontend uploads directly, backend only stores the reference)
- Pre-signed URL issued by `POST /api/v1/workers/documents/upload-url`
- After upload completes, frontend calls `POST /api/v1/workers/documents/confirm`
- A BullMQ job (`document-processing` queue) scans the file and extracts metadata
- Accepted MIME types per document category are enforced at URL generation time (not just frontend)
- Max file size: 10MB per document
- Virus scanning: ClamAV via the `document-processing` queue worker (reject and delete if infected)

---

## Frontend Conventions (Next.js)

- App Router only. No Pages Router.
- Server Components by default. `'use client'` only when interactivity requires it.
- Route groups: `(auth)`, `(worker)`, `(employer)`, `(admin)`
- API calls from Server Components use the internal Docker network URL (`http://backend:3000`), not the public URL
- API calls from Client Components use TanStack Query with the public API URL
- Form handling: React Hook Form + Zod (schema shared with backend where possible via a `packages/shared` workspace)
- Auth state: Next.js middleware reads the JWT access token from HttpOnly cookie; `Zustand` store holds decoded user for UI
- File uploads: direct-to-R2 via pre-signed URL, progress tracked with client-side state

---

## Environment Configuration

Never hardcode secrets. All secrets via environment variables. Use `zod` to validate env at startup — if required vars are missing, the app exits with a clear error.

Required env vars (`.env.example` must always be kept up to date):
```
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://oakvale:password@postgres:5432/oakvale_jobs

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# AWS / Cloudflare R2
S3_BUCKET=...
S3_REGION=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=...          # R2 endpoint if using Cloudflare

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Paystack
PAYSTACK_SECRET_KEY=...
PAYSTACK_WEBHOOK_SECRET=...

# Resend (email)
RESEND_API_KEY=...
FROM_EMAIL=noreply@oakvaleltd.com

# Termii (SMS/WhatsApp Nigeria)
TERMII_API_KEY=...
TERMII_SENDER_ID=Oakvale
```

---

## Business Rules — Critical, Never Break

1. **Profile visibility gate:** A worker's profile is ONLY visible to employers when `verification.status = 'VERIFIED'` AND `compliance.oakvale_certified = true`. Check both at query time, not just at profile creation time.

2. **Background check (admin-reviewed, advisory):** Workers upload background documents (police character certificate, guarantor/attestation letter, sworn affidavit). An admin reviews them and marks the background `CLEAR` or `FLAGGED`. This is advisory — it surfaces as a badge but does NOT gate visibility. Visibility is driven by identity VERIFIED + active Oakvale certification + ≥70% completion + no SAFEGUARDING flag.

3. **Payment before placement activation:** A placement record can be created in `PENDING_PAYMENT` state but MUST NOT transition to `ACTIVE` until the corresponding payment webhook confirms success.

4. **90-day replacement guarantee:** When a placement is created, record `placement_start_date + 90 days` as `guarantee_expires_at`. Replacement requests within this window set `replacement_fee = 0`. After this window, charge the replacement fee.

5. **SLA timers:** When a replacement is requested, create a `replacement_sla_deadline` timestamp (diaspora: `now + 5 business days`, corporate: `now + 3 business days`). The `replacement-sla` queue worker polls and escalates to admin if the SLA is at risk.

6. **Cross-border payment isolation:** Diaspora employer pays in GBP/USD to Oakvale UK (Stripe). Worker is paid in NGN by Oakvale Nigeria. These are two separate ledger entries. Never auto-convert or conflate them.

7. **CPD expiry:** Certifications have `expires_at`. A cron job (BullMQ scheduled job) runs daily and enqueues `cpd-reminders` for workers whose certification expires within 60 days. Placed workers get priority notifications; their employer HR contact is also notified.

8. **Child safeguarding:** Any misconduct flag of type `SAFEGUARDING` on a placed worker immediately triggers suspension from all active placements — this is a background job triggered by the flag creation event, not a manual step.

9. **NDPA 2023 compliance:** Corporate employer contracts must record NDPA data processing consent. Store `ndpa_consent_given: boolean` and `ndpa_consent_timestamp` on the employer record. Do not display a corporate employer's worker data on the portal without this being true.

---

## Testing Strategy

- **Unit tests:** Vitest. Test all service-layer business logic in isolation (mock DB, mock external APIs).
- **Integration tests:** Vitest + `testcontainers` (spin up real Postgres + Redis). Test module service interfaces end-to-end within the module.
- **E2E tests (API):** Supertest against a running Fastify app with test DB. Cover all happy paths and critical error paths for each module.
- **No tests on route handlers directly** — test the service layer; route handlers should be thin.
- Target coverage: 80%+ on `src/modules/` business logic. No coverage target on infrastructure/config code.

---

## Docker Compose Services

```yaml
services:
  backend:     # Node.js app (built from Dockerfile)
  frontend:    # Next.js app (built from Dockerfile)
  postgres:    # postgres:16-alpine, port 5432
  redis:       # redis:7-alpine, port 6379
  nginx:       # nginx:alpine, ports 80/443 — reverse proxy
  # (Optional dev only)
  redis-commander:  # Redis GUI for development
  adminer:          # Postgres GUI for development
```

Production compose overrides: no GUI tools, Nginx with SSL termination, restart policies on all services.

---

## Code Style

- TypeScript strict mode. `"strict": true` in tsconfig. No `any` unless explicitly justified with a comment.
- ESLint + Prettier. Config in root. Run on pre-commit via Husky + lint-staged.
- Imports: absolute (`@/modules/workers/...`) not relative (`../../workers/...`) for cross-module imports. Relative imports only within a module.
- No barrel files (`index.ts` re-exporting everything) — they create circular dependency traps.
- Async/await throughout. No `.then()` chains.
- Never `console.log` in production code — use the shared `logger` (Pino).
- All errors thrown must be typed `AppError` instances (defined in `src/shared/errors/`).

---

## What NOT to Do

- Do NOT add Prisma. Drizzle is the ORM.
- Do NOT use Express. Fastify is the framework.
- Do NOT split into microservices. Modular monolith only.
- Do NOT store file content in Postgres. Store S3 references only.
- Do NOT call external APIs synchronously in request handlers (Termii, payment providers, etc.) — always queue them.
- Do NOT bypass the module service interface for DB access from other modules.
- Do NOT put business logic in route handlers — it belongs in the service layer.
- Do NOT use `any` to silence TypeScript errors.
- Do NOT mix Stripe and Paystack logic — they are separate services for separate pipelines.
