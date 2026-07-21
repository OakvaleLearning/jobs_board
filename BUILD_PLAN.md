# BUILD PLAN — Oakvale Learning Jobs Portal

**Target Launch:** July 2026  
**Stack:** Node.js (Fastify, Drizzle) · PostgreSQL · Redis · BullMQ · Next.js · Docker  
**Pattern:** Modular Monolith  
**Last Updated:** June 2026

---

## Build Phases Overview

| Phase | Name | Weeks | Deliverable |
|---|---|---|---|
| 0 | Infrastructure & Scaffold | 1–2 | Docker env running, DB connected, auth working |
| 1 | Worker Portal (MVP) | 3–5 | Workers can register, complete profile, upload docs |
| 2 | Verification & Compliance Engine | 6–7 | Background checks, CPD, visibility gate |
| 3 | Employer Portals | 8–9 | Diaspora + Corporate employer registration and needs assessment |
| 4 | Placement Engine | 10–11 | Shortlisting, placement lifecycle, SLA tracking |
| 5 | Payments | 12 | Stripe (diaspora) + Paystack (corporate) |
| 6 | Agent / Admin Interface | 13–14 | Internal tools for Oakvale staff |
| 7 | Notifications & Automation | 15 | Email, SMS, welfare checks, CPD reminders |
| 8 | Frontend Polish & QA | 16–17 | UI complete, cross-browser, mobile-responsive |
| 9 | Hardening & Launch Prep | 18 | Security audit, load test, staging deploy |

---

## Phase 0 — Infrastructure & Scaffold

**Duration:** 2 weeks  
**Goal:** Everything runs locally. CI passes. Auth works end-to-end.

### Tasks

#### Repo & Tooling
- [ ] Initialise monorepo structure (`backend/`, `frontend/`, `packages/shared/`)
- [ ] TypeScript config: strict mode, path aliases (`@/`)
- [ ] ESLint + Prettier + Husky + lint-staged
- [ ] Vitest setup with coverage reporting
- [ ] `.env.example` with all required variables documented
- [ ] `packages/shared/src/schema/` — Zod schemas shared between frontend and backend

#### Docker Compose
- [ ] `docker-compose.yml` with services: `backend`, `frontend`, `postgres`, `redis`, `nginx`, `adminer`, `redis-commander`
- [ ] `docker-compose.prod.yml` overrides: no dev tools, restart policies, production Nginx config
- [ ] Healthchecks on postgres and redis services
- [ ] Named volumes for postgres data, redis data, and S3-local (if using localstack in dev)
- [ ] Hot-reload in development (`tsx watch` for backend, Next.js dev server for frontend)

#### Backend Scaffold (Fastify + Drizzle)
- [ ] Fastify app with Pino logger, sensible defaults, CORS config
- [ ] Drizzle ORM setup: schema directory, pool config, connection test on startup
- [ ] Shared `AppError` class with error codes enum
- [ ] Fastify error handler mapping `AppError` to JSON response format
- [ ] Env validation with Zod at startup (fail fast on missing vars)
- [ ] Route registration: module router mounting at `/api/v1/`
- [ ] Health check endpoint: `GET /health` → `{ status: "ok", db: "ok", redis: "ok" }`
- [ ] Redis client (ioredis) with connection test on startup
- [ ] BullMQ queue definitions in `src/shared/queue/queues.ts`

#### Database — Initial Migrations
- [ ] Install Drizzle Kit, configure `drizzle.config.ts`
- [ ] Postgres extensions migration: `pgcrypto`, `pg_trgm`, `unaccent`
- [ ] `updated_at` trigger function (applied to all tables)
- [ ] `users` table schema (id, email, phone, role, password_hash, created_at, updated_at, deleted_at)
- [ ] `sessions` table schema (id, user_id, refresh_token_hash, expires_at, created_at)

#### Auth Module
- [ ] `POST /api/v1/auth/register` — worker, diaspora employer, corporate employer roles
- [ ] `POST /api/v1/auth/login` — email + password, returns access + refresh tokens
- [ ] `POST /api/v1/auth/refresh` — validates refresh token from Redis, issues new access token
- [ ] `POST /api/v1/auth/logout` — revokes refresh token in Redis
- [ ] `POST /api/v1/auth/forgot-password` — sends OTP via email
- [ ] `POST /api/v1/auth/reset-password` — validates OTP, updates password
- [ ] `POST /api/v1/auth/verify-email` — email OTP verification
- [ ] JWT middleware: Fastify preHandler that validates access token and attaches `request.user`
- [ ] Role guard factory: `requireRole('ADMIN', 'AGENT')` returns a Fastify preHandler
- [ ] Unit tests: all auth service methods

#### Frontend Scaffold (Next.js)
- [ ] Next.js 14+ App Router with TypeScript
- [ ] Route groups: `(auth)`, `(worker)`, `(employer)`, `(admin)`
- [ ] Root layout with providers (TanStack Query, Zustand)
- [ ] Auth middleware in `middleware.ts` — protect route groups by reading JWT cookie
- [ ] `useAuth` hook (Zustand store) with decoded user, login, logout
- [ ] API client utility (thin wrapper around `fetch`, handles token refresh on 401)
- [ ] Login and Register pages (form + API integration)

#### Acceptance Criteria
- [ ] `docker compose up` starts all services without errors
- [ ] Worker can register, verify email, login, and receive a valid JWT
- [ ] `GET /health` returns `200` with db and redis confirmed
- [ ] All auth unit tests pass

---

## Phase 1 — Worker Portal (MVP)

**Duration:** 3 weeks  
**Goal:** A worker can complete their full profile, upload all required documents, and submit for review.

### Database Migrations
- [ ] `workers` — `user_id`, `profile_completion_pct`, `visibility_status`, `oakvale_agent_id`, `notes`, `flags`
- [ ] `worker_personal_info` — all Section A fields (name, dob, gender, nationality, state_of_origin, lga, address, phone, emergency_contact, gps_location)
- [ ] `worker_identity_docs` — id_type, id_number, id_issue_date, id_expiry_date, document_url, selfie_url, proof_of_address_url, verification_status
- [ ] `worker_education` — (repeatable) level, course, institution, country, start_date, end_date, grade, certificate_url, verification_status
- [ ] `worker_experience` — (repeatable) job_title, employer_name, sector, nature_of_role, start_date, end_date, is_current, duties, skills_applied, reason_for_leaving, letter_url, reference_url
- [ ] `worker_references` — (×2) name, organisation, position, phone, email, reference_type, letter_url, verification_status
- [ ] `worker_skills` — skill categories, specialist skills, languages, certifications, competency_ratings
- [ ] `worker_preferences` — desired sectors, employment type, preferred settings, availability dates, shift preferences, relocation willingness, cities
- [ ] `worker_salary_expectations` — wage structure, min_rate, max_rate, negotiable, expected_benefits
- [ ] `worker_profile_extras` — interests, personal_statement, video_intro_url

### Backend — Workers Module
- [ ] `WorkerService.createProfile(userId)` — initialises worker record on registration
- [ ] `WorkerService.updateSection(workerId, section, data)` — section-scoped PATCH
- [ ] `WorkerService.getProfile(workerId)` — full profile aggregate
- [ ] `WorkerService.calculateCompletion(workerId)` — recalculates and stores `profile_completion_pct`
- [ ] `WorkerService.submitForReview(workerId)` — validates minimum completion (e.g. 80%), transitions visibility_status to `PENDING_REVIEW`
- [ ] `WorkerService.search(filters, pagination)` — full-text + filter-based search (employer-facing, respects visibility gate)
- [ ] Pre-signed S3 URL endpoint: `POST /api/v1/workers/documents/upload-url`
- [ ] Document confirm endpoint: `POST /api/v1/workers/documents/confirm`
- [ ] Document processing BullMQ job (enqueued on confirm): virus scan, metadata extraction
- [ ] All route handlers with Fastify schema validation
- [ ] Unit tests: completion calculation, search filter logic, section update validation

### Frontend — Worker Portal
- [ ] `/worker/profile` — multi-section profile editor (tabbed or stepped layout)
  - Section A: Personal Information (with map location picker)
  - Section B: Identity Verification (document upload with drag-and-drop)
  - Section C: Criminal Background Check consent
  - Section D: Educational Qualifications (repeatable entries)
  - Section E: Professional Experience (repeatable job history)
  - Section F: Employment References (×2)
  - Section G: Employment Preferences & Availability
  - Section H: Skills & Competencies (multi-select with self-rating)
  - Section I: Interests & Personal Statement
  - Section J: Video Introduction upload
  - Section K: Salary Expectations
  - Section L: Compliance & Training (cert upload)
- [ ] Profile completion progress bar (live, driven by API)
- [ ] Document upload flow: pre-signed URL → direct S3 upload → confirm → status indicator
- [ ] Submit for review CTA (enabled at 80%+ completion)
- [ ] `/worker/dashboard` — overview card: completion %, verification status, placement status

### Acceptance Criteria
- [ ] Worker can complete all 12 profile sections and upload documents
- [ ] Profile completion % updates in real time
- [ ] Submit for review requires minimum completion threshold
- [ ] Documents are stored in S3 (not Postgres)
- [ ] Worker search returns only visibility-gated profiles (verified + certified)

---

## Phase 2 — Verification & Compliance Engine

**Duration:** 2 weeks  
**Goal:** The trust infrastructure that makes the platform's core value proposition real.

### Database Migrations
- [ ] `verification_requests` — worker_id, request_type, status, submitted_at, reviewed_at, reviewed_by, notes
- [ ] `background_checks` — worker_id, sterling_reference_id, status, submitted_at, completed_at, result, webhook_payload
- [ ] `cpd_records` — worker_id, course_name, completed_at, expires_at, certificate_url, hours_completed, verified_by_oakvale
- [ ] `certifications` — worker_id, cert_type, cert_number, issued_by, issued_at, expires_at, certificate_url, is_oakvale_cert
- [ ] `compliance_flags` — worker_id, flag_type, raised_by, raised_at, details, resolved_at

### Backend — Verification Module
- [ ] Identity verification workflow: agent submits → status → VERIFIED / REJECTED
- [ ] On identity approval: auto-enqueue Sterling BackCheck job
- [ ] Sterling BackCheck API client (submit check, handle webhook response)
- [ ] Webhook endpoint: `POST /api/v1/webhooks/sterling-backcheck` — signature validation, status update
- [ ] Background check result updates worker visibility gate
- [ ] `VerificationService.getStatus(workerId)` — aggregate status across all check types
- [ ] Unit tests: state machine transitions, webhook signature validation

### Backend — Compliance Module
- [ ] CPD record CRUD
- [ ] Oakvale certification tracking
- [ ] `ComplianceService.isWorkerVisible(workerId)` — the gate function (verified AND certified)
- [ ] CPD expiry monitoring: daily BullMQ scheduled job, enqueues reminders for 60-day window
- [ ] Compliance flag creation: `SAFEGUARDING` flag type triggers immediate placement suspension via internal event
- [ ] `POST /api/v1/compliance/flags` — admin/agent only, creates flag, emits `worker.flagged` event
- [ ] `placements` module listens to `worker.flagged` and suspends active placements if `SAFEGUARDING`

### Frontend — Verification & Compliance UI
- [ ] Worker: `/worker/verification` — status page showing each check type with current state
- [ ] Worker: `/worker/compliance` — CPD record list, upload new certificates, expiry dates highlighted
- [ ] Admin: verification queue — list of workers pending review, document viewer, approve/reject controls
- [ ] Admin: background check status tracker per worker

### Acceptance Criteria
- [ ] Workers with no completed verification are invisible to employer search
- [ ] Sterling BackCheck is triggered automatically on identity approval
- [ ] A `SAFEGUARDING` compliance flag immediately suspends all active placements for that worker
- [ ] CPD expiry alerts are queued and fire 60 days before expiry

---

## Phase 3 — Employer Portals

**Duration:** 2 weeks  
**Goal:** Both employer types can register, complete their profile, and post or submit a care request.

### Database Migrations
- [ ] `employers` — user_id, employer_type (DIASPORA | CORPORATE), org_name, sector, reg_number, address, logo_url, website, about, ndpa_consent_given, ndpa_consent_timestamp
- [ ] `employer_contacts` — employer_id, name, position, email, phone, is_primary
- [ ] `diaspora_needs_assessments` — employer_id, care_recipient_name, age, conditions, mobility_level, medication_needs, preferred_language, cultural_requirements, dietary_requirements, accommodation_type (LIVE_IN | LIVE_OUT), urgency_level, additional_notes
- [ ] `corporate_needs_assessments` — employer_id, num_staff_required, age_ranges_served, hours_of_operation, existing_staff_count, specific_skills_needed, budget_parameters, site_assessment_notes
- [ ] `job_postings` — employer_id, title, department, description, duties, work_location, schedule, salary_range, benefits, openings, deadline, priority_level, status, created_at

### Backend — Employers Module
- [ ] `EmployerService.createProfile(userId, type)` — initialises employer record
- [ ] `EmployerService.updateProfile(employerId, data)` — profile CRUD
- [ ] `EmployerService.submitNeedsAssessment(employerId, data)` — diaspora or corporate path based on type
- [ ] `EmployerService.getProfile(employerId)` — full profile with needs assessment
- [ ] Job posting CRUD (corporate only): create, update, close, list
- [ ] `POST /api/v1/employers/register` — creates employer + user in one transaction
- [ ] NDPA consent recording on corporate employer creation
- [ ] Unit tests: employer type discrimination, needs assessment validation

### Frontend — Employer Portals

**Diaspora Portal (`/employer/diaspora`)**
- [ ] Registration flow: account details → care recipient details (needs assessment)
- [ ] Care needs assessment form: recipient info, conditions, accommodation type, urgency
- [ ] Dashboard: placement status, worker profile previews, welfare check log
- [ ] Shortlist view: 3–5 worker profiles with certification badges, background check indicators
- [ ] Worker profile detail view: full bio, certifications, ratings, optional video intro
- [ ] Payment initiation (Stripe) — integrated in Phase 5

**Corporate Portal (`/employer/corporate`)**
- [ ] Registration flow: org details → contact person → workforce requirements
- [ ] Job posting creator: full form with all Section D fields
- [ ] Employer dashboard: posted jobs, shortlists, placed workers, CPD status, invoices
- [ ] Worker profile cards with certification badge, SEND flag, age group experience indicators
- [ ] Subscription status display (active/expired)
- [ ] NDPA consent checkbox on registration (required to proceed)

### Acceptance Criteria
- [ ] Diaspora employers can register and submit a care needs assessment
- [ ] Corporate employers can register and post a job with NDPA consent recorded
- [ ] Both employer types see worker profiles only after payment (Phase 5 integration)
- [ ] Corporate employers cannot access worker data without `ndpa_consent_given = true`

---

## Phase 4 — Placement Engine

**Duration:** 2 weeks  
**Goal:** The core operational workflow — from shortlist to active placement to replacement.

### Database Migrations
- [ ] `placements` — employer_id, worker_id, job_posting_id (nullable), pipeline_type (DIASPORA | CORPORATE), status, placed_at, guarantee_expires_at, ended_at, end_reason, replacement_of (self-ref FK, nullable)
- [ ] `shortlists` — employer_id, request_id, worker_ids (JSONB array), created_by, created_at, expires_at
- [ ] `welfare_checks` — placement_id, scheduled_at, completed_at, completed_by, notes, recipient_wellbeing, worker_attendance, issues_flagged
- [ ] `placement_events` — placement_id, event_type, occurred_at, actor_id, notes (audit log)
- [ ] `replacement_requests` — original_placement_id, requested_at, requested_by, reason, sla_deadline, status, new_placement_id (nullable)

### Backend — Placements Module
- [ ] `PlacementService.generateShortlist(employerId, assessmentId)` — match workers to needs assessment, return 3–5 ranked candidates
- [ ] `PlacementService.selectWorker(shortlistId, workerId)` — employer selects from shortlist, creates placement in `PENDING_PAYMENT` state
- [ ] `PlacementService.activatePlacement(placementId)` — called by payment webhook, transitions to `ACTIVE`, sets `guarantee_expires_at`
- [ ] `PlacementService.requestReplacement(placementId, reason)` — creates replacement request, calculates SLA deadline (diaspora: 5 biz days, corporate: 3 biz days), checks guarantee window
- [ ] `PlacementService.fulfillReplacement(replacementRequestId, newWorkerId)` — creates new placement linked to original, closes original
- [ ] `PlacementService.logWelfareCheck(placementId, data)` — records welfare check, generates report
- [ ] `PlacementService.getActiveByWorker(workerId)` — for suspension logic
- [ ] Replacement SLA queue worker: polls open replacement requests, alerts admin when SLA breach imminent (24h warning)
- [ ] Welfare check scheduler: BullMQ recurring jobs per active placement (monthly for diaspora, monthly for corporate)
- [ ] Placement event logging on every state transition
- [ ] Unit tests: shortlist matching algorithm, guarantee window calculation, SLA deadline calculation

### Matching Algorithm (Shortlist Generation)
Score workers for a given needs assessment on:
1. **Hard filters** (exclude if not met): visibility gate, availability, location/relocation willingness, employment type match
2. **Skill match score:** required specialist skills covered by worker's skills (weighted 40%)
3. **Experience score:** relevant sector experience, years (weighted 30%)
4. **Certification match:** relevant CPD modules completed (weighted 20%)
5. **Rating score:** average rating from previous placements (weighted 10%)

Return top 5. Store score breakdown in shortlist record for agent review.

### Frontend — Placement Flows

**Worker side**
- [ ] `/worker/placements` — active placement card with employer details (sanitised), welfare check schedule
- [ ] Notification when shortlisted (in-app + email)

**Diaspora employer side**
- [ ] Shortlist view → profile review → select worker → trigger payment → placement confirmed
- [ ] Active placement dashboard: worker photo, start date, next welfare check date
- [ ] Welfare check reports inbox: monthly written updates from Oakvale

**Corporate employer side**
- [ ] Shortlist per job posting → profile review → select worker(s) → trigger invoice → placement confirmed
- [ ] Team view: all placed workers in one dashboard, CPD status per worker
- [ ] Request replacement button per worker: reason form → SLA displayed

**Agent side** (preview, full in Phase 6)
- [ ] Shortlist override: agents can add/remove from machine-generated shortlist before employer sees it
- [ ] Welfare check logging form

### Acceptance Criteria
- [ ] Shortlist generation returns 3–5 workers ranked by match score
- [ ] Placement is not activated until payment confirms (placement stays `PENDING_PAYMENT`)
- [ ] Replacement within 90 days sets `replacement_fee = 0` automatically
- [ ] Welfare check jobs are scheduled on placement activation
- [ ] `SAFEGUARDING` flag suspends all `ACTIVE` placements for that worker within the same request cycle

---

## Phase 5 — Payments

**Duration:** 1 week  
**Goal:** End-to-end payment for both pipelines. Invoicing for corporates.

### Database Migrations
- [ ] `invoices` — employer_id, placement_id (nullable), invoice_number, type (PLACEMENT_FEE | SUBSCRIPTION | REPLACEMENT_FEE | CPD_REFRESH | BULK_TRAINING), currency, amount, status, due_date, paid_at, stripe_invoice_id (nullable), paystack_reference (nullable)
- [ ] `payments` — invoice_id, gateway (STRIPE | PAYSTACK), gateway_payment_id, amount, currency, status, paid_at, webhook_payload
- [ ] `subscriptions` — employer_id, plan_type, currency, amount, status, current_period_start, current_period_end, stripe_subscription_id (nullable), paystack_subscription_code (nullable)

### Backend — Payments Module

**Stripe (Diaspora — GBP/USD)**
- [ ] Stripe SDK setup, webhook signature validation
- [ ] `POST /api/v1/payments/stripe/create-checkout-session` — placement fee checkout
- [ ] `POST /api/v1/payments/stripe/create-subscription` — annual employer subscription
- [ ] `POST /api/v1/webhooks/stripe` — handle `payment_intent.succeeded`, `invoice.payment_succeeded`, `customer.subscription.updated`
- [ ] On `payment_intent.succeeded`: find pending placement, call `PlacementService.activatePlacement()`

**Paystack (Corporate — NGN)**
- [ ] Paystack SDK setup, webhook signature validation
- [ ] `POST /api/v1/payments/paystack/initialize` — placement fee or subscription payment init
- [ ] `POST /api/v1/payments/paystack/verify/:reference` — frontend verification after redirect
- [ ] `POST /api/v1/webhooks/paystack` — handle `charge.success`, `subscription.create`
- [ ] On `charge.success`: find pending placement, call `PlacementService.activatePlacement()`
- [ ] Invoice generation: auto-create invoice on placement selection (corporate: 30-day net terms)
- [ ] Invoice number generation: sequential, prefixed `OAK-INV-YYYY-NNNN`

**Shared**
- [ ] `PaymentService.createInvoice(employerId, type, amount, currency)` — normalised invoice creation
- [ ] `PaymentService.recordPayment(invoiceId, gateway, gatewayPaymentId)` — normalised payment recording
- [ ] Unit tests: webhook signature validation, invoice generation, 90-day fee rule

### Frontend — Payments
- [ ] Diaspora: Stripe Checkout redirect from placement selection step
- [ ] Corporate: invoice displayed with Paystack payment button OR bank transfer instructions
- [ ] Payment confirmation page with placement activation status
- [ ] `/employer/billing` — invoice history, subscription status, upcoming renewals
- [ ] Admin: `/admin/finance` — revenue dashboard, outstanding invoices, payment log

### Acceptance Criteria
- [ ] Diaspora employers pay via Stripe and placement activates via webhook
- [ ] Corporate employers receive a 30-day net invoice and placement activates on Paystack `charge.success`
- [ ] Replacement within 90-day window has `replacement_fee = 0` enforced at invoice creation
- [ ] Subscription expiry disables employer portal access to new shortlists

---

## Phase 6 — Agent / Admin Interface

**Duration:** 2 weeks  
**Goal:** Oakvale internal staff can manage the full operation end-to-end.

### Backend — Admin Module
All admin endpoints require role `AGENT` or `ADMIN`. `ADMIN` can access all operations. `AGENT` access is scoped to their assigned region and function.

- [ ] `GET /api/v1/admin/workers` — paginated, filterable worker list (all statuses)
- [ ] `GET /api/v1/admin/workers/:id` — full worker profile with all verification/compliance data
- [ ] `PATCH /api/v1/admin/workers/:id/verify` — approve/reject identity documents
- [ ] `PATCH /api/v1/admin/workers/:id/notes` — add internal notes/flags
- [ ] `POST /api/v1/admin/workers/:id/assign` — assign worker to agent
- [ ] `GET /api/v1/admin/employers` — paginated employer list
- [ ] `GET /api/v1/admin/placements` — all placements with filters (status, pipeline, agent)
- [ ] `POST /api/v1/admin/placements/:id/welfare-check` — log welfare check
- [ ] `GET /api/v1/admin/replacement-requests` — open replacements with SLA countdown
- [ ] `POST /api/v1/admin/shortlists/:id/override` — add/remove workers from shortlist
- [ ] `GET /api/v1/admin/compliance/expiring-cpd` — workers with CPD expiring in 60 days
- [ ] `GET /api/v1/admin/finance/overview` — revenue summary, outstanding invoices
- [ ] `GET /api/v1/admin/kpis` — KPI snapshot: placements made, workers verified, revenue MTD

### Frontend — Admin Dashboard (`/admin`)
- [ ] Layout: sidebar navigation, role-scoped menu items
- [ ] `/admin/workers` — worker management table with search, filter by status/pipeline/agent
- [ ] `/admin/workers/[id]` — full worker profile, verification checklist, document viewer, action buttons
- [ ] `/admin/employers` — employer list with pipeline type, account status, last activity
- [ ] `/admin/placements` — placement board (or table) with status, SLA indicators, welfare check due dates
- [ ] `/admin/replacements` — replacement requests with countdown timers, assign replacement action
- [ ] `/admin/compliance` — CPD expiry list, cert upload override, flag management
- [ ] `/admin/finance` — invoice list, payment status, subscription renewals due
- [ ] `/admin/kpis` — dashboard: total workers, verified workers, active placements, revenue MTD/YTD
- [ ] Agent management: add agent, assign regions, view agent workload

### Acceptance Criteria
- [ ] Agent can complete full verification workflow for a worker (document review → approve → background check triggered)
- [ ] Agent can generate and override a shortlist before employer sees it
- [ ] Admin can see full KPI dashboard with real data
- [ ] Replacement requests show SLA countdown and escalate visually when <24h remains

---

## Phase 7 — Notifications & Automation

**Duration:** 1 week  
**Goal:** All scheduled communications and automated workflows running reliably.

### Notification Templates (Resend email + Termii SMS)
- [ ] Worker: email verification OTP
- [ ] Worker: profile approved / rejected
- [ ] Worker: background check submitted / completed / result
- [ ] Worker: shortlisted for a placement
- [ ] Worker: placement activated
- [ ] Worker: welfare check reminder (monthly)
- [ ] Worker: CPD expiry warning (60 days, 30 days, 7 days)
- [ ] Diaspora employer: shortlist ready for review
- [ ] Diaspora employer: placement activated
- [ ] Diaspora employer: monthly welfare update (auto-populated from welfare check log)
- [ ] Diaspora employer: worker leaving / replacement initiated
- [ ] Corporate employer: shortlist ready, placement activated, CPD status update, invoice due, annual renewal reminder (60 days out)
- [ ] Admin/Agent: replacement SLA warning (24h), safeguarding flag alert, background check failure

### BullMQ Scheduled Jobs
- [ ] Daily: CPD expiry scan → enqueue reminders for workers expiring in ≤60 days
- [ ] Daily: replacement SLA scan → enqueue alerts for requests with <24h to deadline
- [ ] Monthly (per active placement): welfare check reminder to agent
- [ ] Annually (per active subscription): renewal reminder to employer 60 days before expiry

### Acceptance Criteria
- [ ] All notification templates reviewed and approved by Funke/Oakvale
- [ ] CPD expiry reminders fire correctly in staging
- [ ] Welfare check reminders are scheduled per placement and confirmed in BullMQ dashboard
- [ ] Safeguarding flag fires escalation email to admin within 1 minute

---

## Phase 8 — Frontend Polish & QA

**Duration:** 2 weeks  
**Goal:** Production-quality UI. Mobile-responsive. Accessible. Cross-browser.

### UI/UX Polish
- [ ] Design system consistency: typography, colour, spacing, component library
- [ ] Responsive layout for all pages (mobile-first for worker portal — field workers use phones)
- [ ] Loading states on all async operations (skeletons, spinners)
- [ ] Empty states for all list/table views
- [ ] Error states with actionable messages (not generic "something went wrong")
- [ ] Form validation inline (not just on submit) across all forms
- [ ] File upload progress indicators with abort capability
- [ ] Accessibility: keyboard navigation, ARIA labels, colour contrast (WCAG AA)

### Cross-Browser / Device Testing
- [ ] Chrome, Firefox, Safari (desktop)
- [ ] Chrome Android, Safari iOS
- [ ] Low-bandwidth simulation (document uploads)

### Integration QA
- [ ] Happy path E2E: worker registers → completes profile → verified → appears in search
- [ ] Happy path E2E (diaspora): employer registers → submits assessment → shortlist → selects → pays → placement active → welfare check logged
- [ ] Happy path E2E (corporate): employer registers → posts job → shortlist → selects → invoice → placement active → CPD refresh notified
- [ ] Replacement flow: placement active → replacement requested → new worker placed → original closed → fee rule correct
- [ ] Safeguarding flag flow: flag created → active placements suspended → admin notified

### Performance
- [ ] API response times: P95 < 200ms for read endpoints under simulated load
- [ ] Worker search: < 500ms for full-text search with 10,000 worker records in DB
- [ ] S3 pre-signed URL generation: < 100ms

---

## Phase 9 — Hardening & Launch Prep

**Duration:** 2 weeks  
**Goal:** Production-ready. Secure. Monitored. Deployed.

### Security
- [ ] OWASP Top 10 review against all API endpoints
- [ ] Rate limiting on all auth endpoints (10 req/min per IP)
- [ ] Rate limiting on file upload URL generation (5 req/min per user)
- [ ] SQL injection: confirmed Drizzle parameterised queries throughout (no raw SQL with interpolation)
- [ ] Secrets rotation test: verify app recovers cleanly from secret rotation without downtime
- [ ] NDPA 2023 data audit: confirm all personal data fields are documented, consent flow is enforced
- [ ] S3 bucket policy: bucket is private, only accessible via pre-signed URLs
- [ ] Sterling BackCheck webhook: IP allowlisting for their webhook source IPs
- [ ] Dependency audit: `npm audit` with no high/critical vulnerabilities

### Monitoring & Observability
- [ ] Pino structured logging: all requests logged with `requestId`, `userId`, `method`, `path`, `statusCode`, `latency`
- [ ] Error tracking: Sentry integration (backend + frontend)
- [ ] Uptime monitoring: external health check ping on `/health`
- [ ] BullMQ dashboard (Bull Board) accessible to admin only, behind auth
- [ ] Postgres slow query log enabled in production
- [ ] Redis memory usage alert threshold set

### Infrastructure
- [ ] Production Docker Compose validated on target server
- [ ] Nginx SSL termination with auto-renewing Let's Encrypt cert (Certbot)
- [ ] Postgres daily backup (pg_dump to S3 with 30-day retention)
- [ ] Redis persistence: AOF enabled
- [ ] `.env.production` populated on server, never committed to git

### Staging Deploy & UAT
- [ ] Full staging deploy on production-equivalent infrastructure
- [ ] Funke and Caleb complete UAT across all three portal types (worker, diaspora employer, corporate employer)
- [ ] All UAT feedback captured and triaged — P1 bugs fixed before launch
- [ ] Load test: simulate 100 concurrent workers completing profile sections

### Launch Checklist
- [ ] `CLAUDE.md` updated to reflect any architecture decisions made during build
- [ ] `README.md` with local setup instructions, environment variable guide, deployment runbook
- [ ] All `.env.example` vars documented
- [ ] Database migration state: clean, all applied, no pending
- [ ] Seeded test data removed from production DB
- [ ] DNS records pointing to production server
- [ ] Stripe and Paystack webhooks configured to production URL
- [ ] Sterling BackCheck API key is production key (not sandbox)
- [ ] Resend domain verified for `oakvaleltd.com`
- [ ] Go/no-go sign-off from Funke

---

## Key Dependencies & External Services

| Service | Purpose | Pipeline | Sandbox Available |
|---|---|---|---|
| Sterling BackCheck Nigeria | Background checks | Both | Yes |
| Stripe | Payment processing (GBP/USD) | Diaspora | Yes |
| Paystack | Payment processing (NGN) | Corporate | Yes |
| Resend | Transactional email | Both | Yes |
| Termii | SMS / WhatsApp (Nigeria) | Both | Yes |
| AWS S3 / Cloudflare R2 | Document storage | Both | Yes (local with MinIO) |
| Sentry | Error tracking | Both | Yes |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sterling BackCheck API unreliable / slow | Medium | High | Async via BullMQ, retry logic, SLA timer independent of check result |
| Stripe not available for NGN employers | Low | Medium | Paystack handles all NGN. Stripe only for GBP/USD diaspora payments |termi
| Worker profile data volume exceeds Postgres performance | Low | Medium | Indexed queries, search cache in Redis, consider pg_trgm for name search |
| File upload abuse (malware) | Medium | High | ClamAV in document-processing queue, S3 bucket isolation |
| Safeguarding incident during soft launch | Low | Critical | Safeguarding flag automation tested in Phase 2. Manual escalation protocol documented separately |
| NDPA non-compliance | Low | High | NDPA consent enforced at DB level (not just UI). Legal review before launch. |

---

## Definition of Done (per feature)

A feature is done when:
1. Backend service layer has unit tests at ≥80% coverage
2. API endpoint has integration test covering happy path + main error cases
3. Frontend form/page has working validation and error states
4. All Fastify route schemas validated (no untyped inputs)
5. No TypeScript errors (`tsc --noEmit` passes)
6. ESLint passes with no warnings
7. Feature is deployed to staging and smoke-tested manually
8. `CLAUDE.md` updated if any architectural decision was made during implementation
