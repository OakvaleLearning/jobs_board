import postgres from 'postgres';
import { loadEnv } from '../config/env.js';
import { logger } from '../logger/logger.js';

const PHASE_0_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('WORKER','INDIVIDUAL_EMPLOYER','EMPLOYER_CORPORATE','AGENT','ADMIN');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  phone text,
  role role NOT NULL,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  user_agent text,
  ip_address text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const PHASE_1_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility_status') THEN
    CREATE TYPE visibility_status AS ENUM ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','SUSPENDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'id_type') THEN
    CREATE TYPE id_type AS ENUM ('NIN','PASSPORT','VOTER_CARD','DRIVERS_LICENSE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
    CREATE TYPE gender AS ENUM ('FEMALE','MALE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_type') THEN
    CREATE TYPE employment_type AS ENUM ('LIVE_IN','LIVE_OUT','EITHER','FULL_TIME','PART_TIME','SHIFT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wage_structure') THEN
    CREATE TYPE wage_structure AS ENUM ('MONTHLY','HOURLY','DAILY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reference_type') THEN
    CREATE TYPE reference_type AS ENUM ('PROFESSIONAL','CHARACTER','ACADEMIC');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skill_kind') THEN
    CREATE TYPE skill_kind AS ENUM ('SKILL','CERTIFICATION','LANGUAGE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_category') THEN
    CREATE TYPE document_category AS ENUM (
      'ID_DOCUMENT','SELFIE','PROOF_OF_ADDRESS','EDUCATION_CERT','EXPERIENCE_LETTER',
      'REFERENCE_LETTER','CPD_CERT','VIDEO_INTRO'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE document_status AS ENUM ('UPLOADING','SCANNING','CLEAN','INFECTED','REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_verification_status') THEN
    CREATE TYPE doc_verification_status AS ENUM ('PENDING','IN_REVIEW','VERIFIED','REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  profile_completion_pct integer NOT NULL DEFAULT 0,
  visibility_status visibility_status NOT NULL DEFAULT 'DRAFT',
  oakvale_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  notes text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS workers_visibility_idx ON workers (visibility_status);
CREATE INDEX IF NOT EXISTS workers_pct_idx ON workers (profile_completion_pct);
CREATE INDEX IF NOT EXISTS workers_agent_idx ON workers (oakvale_agent_id);

CREATE TABLE IF NOT EXISTS worker_personal_info (
  worker_id uuid PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
  full_name text,
  dob date,
  gender gender,
  nationality text,
  state_of_origin text,
  lga text,
  address text,
  phone text,
  emergency_contact jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_personal_full_name_trgm
  ON worker_personal_info USING gin (full_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS worker_identity_docs (
  worker_id uuid PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
  id_type id_type,
  id_number text,
  id_issue_date date,
  id_expiry_date date,
  id_document_id uuid,
  selfie_id uuid,
  proof_of_address_id uuid,
  verification_status doc_verification_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_background_consent (
  worker_id uuid PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
  consent_given boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  level text NOT NULL,
  course text,
  institution text NOT NULL,
  country text NOT NULL,
  start_date date,
  end_date date,
  grade text,
  certificate_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_education_worker_idx ON worker_education (worker_id);

CREATE TABLE IF NOT EXISTS worker_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  job_title text NOT NULL,
  employer_name text NOT NULL,
  sector text,
  nature_of_role text,
  start_date date NOT NULL,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  duties text,
  skills_applied jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason_for_leaving text,
  letter_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_experience_worker_idx ON worker_experience (worker_id);

CREATE TABLE IF NOT EXISTS worker_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  name text NOT NULL,
  organisation text NOT NULL,
  position text,
  phone text NOT NULL,
  email text NOT NULL,
  reference_type reference_type NOT NULL,
  letter_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_references_worker_idx ON worker_references (worker_id);

CREATE TABLE IF NOT EXISTS worker_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  kind skill_kind NOT NULL,
  category text,
  name text NOT NULL,
  self_rating integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_skills_worker_idx ON worker_skills (worker_id);

CREATE TABLE IF NOT EXISTS worker_preferences (
  worker_id uuid PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
  desired_sectors jsonb NOT NULL DEFAULT '[]'::jsonb,
  employment_type employment_type,
  preferred_settings jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability_start date,
  shift_preferences jsonb NOT NULL DEFAULT '[]'::jsonb,
  relocation_willingness boolean,
  preferred_cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_salary_expectations (
  worker_id uuid PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
  wage_structure wage_structure,
  min_rate numeric,
  max_rate numeric,
  currency text NOT NULL DEFAULT 'NGN',
  negotiable boolean NOT NULL DEFAULT true,
  expected_benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_profile_extras (
  worker_id uuid PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
  interests text,
  personal_statement text,
  video_intro_document_id uuid,
  cpd_enrolled boolean NOT NULL DEFAULT false,
  oakvale_programme_acknowledged boolean NOT NULL DEFAULT false,
  immunisation_declared boolean NOT NULL DEFAULT false,
  personal_statement_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(personal_statement, ''))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_profile_extras_tsv_idx
  ON worker_profile_extras USING gin (personal_statement_tsv);

CREATE TABLE IF NOT EXISTS worker_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  category document_category NOT NULL,
  storage_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  status document_status NOT NULL DEFAULT 'UPLOADING',
  scanned_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_documents_worker_idx ON worker_documents (worker_id);
CREATE INDEX IF NOT EXISTS worker_documents_status_idx ON worker_documents (status);
`;

const PHASE_2_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_request_type') THEN
    CREATE TYPE verification_request_type AS ENUM ('IDENTITY','BACKGROUND','SELFIE','ADDRESS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM ('PENDING','SUBMITTED','IN_REVIEW','VERIFIED','REJECTED','FLAGGED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'background_check_status') THEN
    CREATE TYPE background_check_status AS ENUM ('PENDING','IN_PROGRESS','CLEAR','REVIEW','HIT','FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cert_type') THEN
    CREATE TYPE cert_type AS ENUM ('OAKVALE_FOUNDATION','OAKVALE_ADVANCED','EXTERNAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flag_type') THEN
    CREATE TYPE flag_type AS ENUM ('SAFEGUARDING','CONDUCT','DOCUMENT','OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flag_severity') THEN
    CREATE TYPE flag_severity AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  request_type verification_request_type NOT NULL,
  status verification_status NOT NULL DEFAULT 'PENDING',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_requests_worker_idx ON verification_requests (worker_id);
CREATE INDEX IF NOT EXISTS verification_requests_worker_type_idx ON verification_requests (worker_id, request_type);

CREATE TABLE IF NOT EXISTS background_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  status background_check_status NOT NULL DEFAULT 'PENDING',
  submitted_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  triggered_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS background_checks_worker_idx ON background_checks (worker_id);
CREATE INDEX IF NOT EXISTS background_checks_status_idx ON background_checks (status);

CREATE TABLE IF NOT EXISTS cpd_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  provider text NOT NULL,
  completed_at date NOT NULL,
  expires_at date,
  hours_completed numeric,
  certificate_document_id uuid,
  verified_by_oakvale boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cpd_records_worker_idx ON cpd_records (worker_id);
CREATE INDEX IF NOT EXISTS cpd_records_expires_idx ON cpd_records (expires_at);

CREATE TABLE IF NOT EXISTS certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  cert_type cert_type NOT NULL,
  cert_number text,
  issued_by text NOT NULL,
  issued_at date NOT NULL,
  expires_at date,
  certificate_document_id uuid,
  is_oakvale_cert boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS certifications_worker_idx ON certifications (worker_id);
CREATE INDEX IF NOT EXISTS certifications_expires_idx ON certifications (expires_at);
CREATE INDEX IF NOT EXISTS certifications_oakvale_idx ON certifications (is_oakvale_cert);

CREATE TABLE IF NOT EXISTS compliance_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  flag_type flag_type NOT NULL,
  severity flag_severity NOT NULL DEFAULT 'MEDIUM',
  raised_by uuid REFERENCES users(id) ON DELETE SET NULL,
  raised_at timestamptz NOT NULL DEFAULT now(),
  details text NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_flags_worker_idx ON compliance_flags (worker_id);
CREATE INDEX IF NOT EXISTS compliance_flags_active_idx ON compliance_flags (flag_type, resolved_at);
`;

const PHASE_3_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employer_type') THEN
    CREATE TYPE employer_type AS ENUM ('INDIVIDUAL_EMPLOYER','CORPORATE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mobility_level') THEN
    CREATE TYPE mobility_level AS ENUM ('INDEPENDENT','ASSISTED','BEDBOUND');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accommodation_type') THEN
    CREATE TYPE accommodation_type AS ENUM ('LIVE_IN','LIVE_OUT','FLEXIBLE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_level') THEN
    CREATE TYPE urgency_level AS ENUM ('STANDARD','URGENT','IMMEDIATE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_posting_status') THEN
    CREATE TYPE job_posting_status AS ENUM ('DRAFT','OPEN','FILLED','CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_priority_level') THEN
    CREATE TYPE job_priority_level AS ENUM ('LOW','MEDIUM','HIGH');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employer_type employer_type NOT NULL,
  org_name text,
  sector text,
  reg_number text,
  address text,
  logo_url text,
  website text,
  about text,
  ndpa_consent_given boolean NOT NULL DEFAULT false,
  ndpa_consent_timestamp timestamptz,
  ndpa_consented_by uuid REFERENCES users(id) ON DELETE SET NULL,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- The legacy employer_type column is dropped in PHASE_23; only (re)create its
-- index while the column still exists so this phase stays re-runnable.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employers' AND column_name = 'employer_type'
  ) THEN
    CREATE INDEX IF NOT EXISTS employers_type_idx ON employers (employer_type);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text,
  email text NOT NULL,
  phone text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employer_contacts_employer_idx ON employer_contacts (employer_id);

CREATE TABLE IF NOT EXISTS individual_employer_needs_assessments (
  employer_id uuid PRIMARY KEY REFERENCES employers(id) ON DELETE CASCADE,
  care_recipient_name text NOT NULL,
  age integer,
  relationship text,
  conditions text,
  mobility_level mobility_level,
  medication_needs text,
  preferred_language text,
  cultural_requirements text,
  dietary_requirements text,
  accommodation_type accommodation_type,
  urgency_level urgency_level,
  additional_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corporate_needs_assessments (
  employer_id uuid PRIMARY KEY REFERENCES employers(id) ON DELETE CASCADE,
  num_staff_required integer NOT NULL,
  age_ranges_served jsonb NOT NULL DEFAULT '[]'::jsonb,
  hours_of_operation text,
  existing_staff_count integer NOT NULL DEFAULT 0,
  specific_skills_needed jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget_parameters text,
  site_assessment_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title text NOT NULL,
  department text,
  description text NOT NULL,
  duties text,
  work_location text,
  schedule text,
  salary_range text,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  openings integer NOT NULL DEFAULT 1,
  deadline date,
  priority_level job_priority_level NOT NULL DEFAULT 'MEDIUM',
  status job_posting_status NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_postings_employer_idx ON job_postings (employer_id);
CREATE INDEX IF NOT EXISTS job_postings_employer_status_idx ON job_postings (employer_id, status);
`;

const PHASE_4_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_type') THEN
    CREATE TYPE pipeline_type AS ENUM ('INDIVIDUAL_EMPLOYER','CORPORATE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'placement_status') THEN
    CREATE TYPE placement_status AS ENUM (
      'PENDING_PAYMENT','SHORTLISTED','INTERVIEWING','SELECTED',
      'ACTIVE','COMPLETED','TERMINATED','SUSPENDED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'replacement_request_status') THEN
    CREATE TYPE replacement_request_status AS ENUM ('OPEN','FULFILLED','EXPIRED','CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wellbeing_level') THEN
    CREATE TYPE wellbeing_level AS ENUM ('GOOD','FAIR','POOR','UNKNOWN');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  job_posting_id uuid REFERENCES job_postings(id) ON DELETE SET NULL,
  pipeline_type pipeline_type NOT NULL,
  status placement_status NOT NULL DEFAULT 'PENDING_PAYMENT',
  placed_at timestamptz,
  activated_at timestamptz,
  guarantee_expires_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  replacement_of uuid REFERENCES placements(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS placements_employer_status_idx ON placements (employer_id, status);
CREATE INDEX IF NOT EXISTS placements_worker_status_idx ON placements (worker_id, status);
CREATE INDEX IF NOT EXISTS placements_status_idx ON placements (status);

CREATE TABLE IF NOT EXISTS shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  job_posting_id uuid REFERENCES job_postings(id) ON DELETE SET NULL,
  request_type pipeline_type NOT NULL,
  worker_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  viewed_at timestamptz,
  decided_at timestamptz,
  selected_worker_id uuid REFERENCES workers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shortlists_employer_idx ON shortlists (employer_id);
CREATE INDEX IF NOT EXISTS shortlists_job_idx ON shortlists (job_posting_id);

CREATE TABLE IF NOT EXISTS welfare_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_wellbeing wellbeing_level,
  worker_attendance wellbeing_level,
  issues_flagged boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS welfare_checks_placement_idx ON welfare_checks (placement_id);

CREATE TABLE IF NOT EXISTS placement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS placement_events_placement_idx ON placement_events (placement_id);
CREATE INDEX IF NOT EXISTS placement_events_type_idx ON placement_events (event_type);

CREATE TABLE IF NOT EXISTS replacement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_placement_id uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  sla_deadline timestamptz NOT NULL,
  status replacement_request_status NOT NULL DEFAULT 'OPEN',
  new_placement_id uuid REFERENCES placements(id) ON DELETE SET NULL,
  replacement_fee_waived boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS replacement_requests_status_deadline_idx
  ON replacement_requests (status, sla_deadline);
CREATE INDEX IF NOT EXISTS replacement_requests_original_idx
  ON replacement_requests (original_placement_id);
`;

const PHASE_5_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
    CREATE TYPE payment_provider AS ENUM ('STRIPE','PAYSTACK');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('OPEN','PAID','VOID','REFUNDED','FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_purpose') THEN
    CREATE TYPE invoice_purpose AS ENUM ('PLACEMENT_FEE','REPLACEMENT_FEE','SUBSCRIPTION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('SUCCEEDED','FAILED','REFUNDED','PARTIAL_REFUND');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('ACTIVE','PAST_DUE','CANCELLED','EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
    CREATE TYPE subscription_plan AS ENUM ('INDIVIDUAL_EMPLOYER_ANNUAL','CORPORATE_ANNUAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  provider payment_provider NOT NULL,
  provider_subscription_id text UNIQUE,
  status subscription_status NOT NULL DEFAULT 'ACTIVE',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_employer_status_idx ON subscriptions (employer_id, status);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  placement_id uuid REFERENCES placements(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  pipeline pipeline_type NOT NULL,
  purpose invoice_purpose NOT NULL,
  status invoice_status NOT NULL DEFAULT 'OPEN',
  currency text NOT NULL,
  amount_minor bigint NOT NULL,
  due_at timestamptz,
  paid_at timestamptz,
  provider payment_provider NOT NULL,
  provider_invoice_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_pipeline_currency_chk CHECK (
    (pipeline = 'INDIVIDUAL_EMPLOYER' AND currency IN ('GBP','USD') AND provider = 'STRIPE')
    OR (pipeline = 'CORPORATE' AND currency = 'NGN' AND provider = 'PAYSTACK')
  )
);
CREATE INDEX IF NOT EXISTS invoices_employer_status_idx ON invoices (employer_id, status);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx ON invoices (status, due_at);
CREATE INDEX IF NOT EXISTS invoices_placement_idx ON invoices (placement_id);

CREATE TABLE IF NOT EXISTS payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  provider_intent_id text NOT NULL UNIQUE,
  checkout_url text,
  status text NOT NULL DEFAULT 'OPEN',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_intents_invoice_idx ON payment_intents (invoice_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  provider_payment_id text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status payment_status NOT NULL DEFAULT 'SUCCEEDED',
  captured_at timestamptz,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_provider_payment_unique UNIQUE (provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments (invoice_id);

CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_events_sub_idx ON subscription_events (subscription_id);
`;

const PHASE_6_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_specialty') THEN
    CREATE TYPE agent_specialty AS ENUM ('BDM','LIAISON_NURSE','RECRUITER','GENERAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_role') THEN
    CREATE TYPE assignment_role AS ENUM ('PRIMARY','SHADOW','COVERING');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agent_profiles (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  specialty agent_specialty NOT NULL DEFAULT 'GENERAL',
  region text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_profiles_specialty_idx ON agent_profiles (specialty);

CREATE TABLE IF NOT EXISTS agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placement_id uuid REFERENCES placements(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
  role_on_assignment assignment_role NOT NULL DEFAULT 'PRIMARY',
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_assignments_target_xor_chk CHECK (
    (placement_id IS NOT NULL AND worker_id IS NULL)
    OR (placement_id IS NULL AND worker_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS agent_assignments_agent_idx ON agent_assignments (agent_id, removed_at);
CREATE INDEX IF NOT EXISTS agent_assignments_placement_idx ON agent_assignments (placement_id, removed_at);
CREATE INDEX IF NOT EXISTS agent_assignments_worker_idx ON agent_assignments (worker_id, removed_at);
`;

const PHASE_7_SQL = `
DO $$ BEGIN
  ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'PAST_DUE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM ('EMAIL','SMS','IN_APP');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE notification_status AS ENUM ('PENDING','SENT','FAILED','READ');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'PENDING',
  subject text,
  body text,
  payload jsonb,
  idempotency_key text,
  provider_message_id text,
  sent_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_log_inbox_idx
  ON notification_log (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_status_idx ON notification_log (status);
CREATE UNIQUE INDEX IF NOT EXISTS notification_log_user_idemp_unique
  ON notification_log (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
`;

const PHASE_8_SQL = `
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  channel notification_channel NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, channel)
);
CREATE INDEX IF NOT EXISTS notification_preferences_user_idx
  ON notification_preferences (user_id);
`;

const PHASE_9_SQL = `
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS digest_mode text;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON admin_audit_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON admin_audit_log (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON admin_audit_log (target_type, target_id, occurred_at DESC);
`;

const PHASE_10_SQL = `
DO $$ BEGIN
  ALTER TYPE placement_status ADD VALUE IF NOT EXISTS 'CONTRACT_PENDING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_type') THEN
    CREATE TYPE contract_type AS ENUM ('WORKER_PLACEMENT','EMPLOYER_SERVICE','ANNUAL_PARTNERSHIP');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
    CREATE TYPE contract_status AS ENUM ('DRAFT','AWAITING_WORKER','AWAITING_EMPLOYER','FULLY_EXECUTED','SUPERSEDED','TERMINATED','DISPUTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signature_party') THEN
    CREATE TYPE signature_party AS ENUM ('WORKER','EMPLOYER','OAKVALE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signature_method') THEN
    CREATE TYPE signature_method AS ENUM ('CHECKBOX_REAUTH','CHECKBOX_OTP');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type contract_type NOT NULL,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_templates_type_active_idx
  ON contract_templates (type, is_active);

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type contract_type NOT NULL,
  template_id uuid REFERENCES contract_templates(id) ON DELETE SET NULL,
  template_version integer,
  placement_id uuid REFERENCES placements(id) ON DELETE SET NULL,
  employer_id uuid REFERENCES employers(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES workers(id) ON DELETE SET NULL,
  body_rendered text NOT NULL,
  status contract_status NOT NULL DEFAULT 'DRAFT',
  expires_at timestamptz,
  fully_executed_at timestamptz,
  superseded_by_id uuid,
  terminated_reason text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contracts_placement_idx ON contracts (placement_id);
CREATE INDEX IF NOT EXISTS contracts_employer_idx ON contracts (employer_id, status);
CREATE INDEX IF NOT EXISTS contracts_worker_idx ON contracts (worker_id, status);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON contracts (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS contracts_expires_idx ON contracts (expires_at);

CREATE TABLE IF NOT EXISTS contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  party signature_party NOT NULL,
  signer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  signer_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  method signature_method NOT NULL DEFAULT 'CHECKBOX_REAUTH',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_signatures_contract_idx ON contract_signatures (contract_id);
CREATE UNIQUE INDEX IF NOT EXISTS contract_signatures_uniq_party_idx
  ON contract_signatures (contract_id, party);
`;

const PHASE_11_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_category') THEN
    CREATE TYPE complaint_category AS ENUM ('SAFEGUARDING','MISCONDUCT','NON_PAYMENT','CONTRACT_DISPUTE','SERVICE_QUALITY','ABSENTEEISM','COMMUNICATION','OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_urgency') THEN
    CREATE TYPE complaint_urgency AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status') THEN
    CREATE TYPE complaint_status AS ENUM ('SUBMITTED','ACKNOWLEDGED','IN_INVESTIGATION','RESPONSE_DRAFTED','RESOLVED','CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_outcome') THEN
    CREATE TYPE complaint_outcome AS ENUM ('UPHELD','PARTIALLY_UPHELD','DISMISSED','MEDIATED','ESCALATED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_event_kind') THEN
    CREATE TYPE complaint_event_kind AS ENUM ('SUBMITTED','ACKNOWLEDGED','ASSIGNED','NOTE','STATUS_CHANGED','RESOLVED','ESCALATED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_ref text NOT NULL UNIQUE,
  category complaint_category NOT NULL,
  urgency complaint_urgency NOT NULL,
  status complaint_status NOT NULL DEFAULT 'SUBMITTED',
  subject text NOT NULL,
  narrative text NOT NULL,
  raised_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  against_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  placement_id uuid REFERENCES placements(id) ON DELETE SET NULL,
  assigned_to_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  sla_deadline timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  outcome complaint_outcome,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints (status, urgency, created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_raised_by_idx ON complaints (raised_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_against_idx ON complaints (against_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_assigned_idx ON complaints (assigned_to_agent_id, status);
CREATE INDEX IF NOT EXISTS complaints_placement_idx ON complaints (placement_id);
CREATE INDEX IF NOT EXISTS complaints_sla_idx ON complaints (sla_deadline, status);

CREATE TABLE IF NOT EXISTS complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  kind complaint_event_kind NOT NULL,
  notes text,
  metadata jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS complaint_events_complaint_idx
  ON complaint_events (complaint_id, occurred_at DESC);
`;

const TIMESTAMPED_TABLES = [
  'users',
  'sessions',
  'user_consents',
  'workers',
  'worker_personal_info',
  'worker_identity_docs',
  'worker_background_consent',
  'worker_education',
  'worker_experience',
  'worker_references',
  'worker_skills',
  'worker_preferences',
  'worker_salary_expectations',
  'worker_profile_extras',
  'worker_documents',
  'verification_requests',
  'background_checks',
  'cpd_records',
  'certifications',
  'compliance_flags',
  'employers',
  'employer_contacts',
  'employer_documents',
  'individual_employer_needs_assessments',
  'corporate_needs_assessments',
  'job_postings',
  'placements',
  'shortlists',
  'welfare_checks',
  'placement_events',
  'replacement_requests',
  'subscriptions',
  'invoices',
  'payment_intents',
  'payments',
  'agent_profiles',
  'agent_assignments',
  'notification_log',
  'notification_preferences',
  'notification_templates',
  'contract_templates',
  'contracts',
  'contract_signatures',
  'complaints',
  'complaint_events',
  'placement_offers',
  'conversations',
  'messages',
  'saved_searches',
  'welfare_reports',
  'welfare_escalations',
  'contract_amendments',
  'saved_search_matches',
  'job_applications',
  'interviews',
  'workforce_categories',
  'employer_types',
  'cpd_enrolments',
  'payroll_runs',
  'worker_payouts',
  'placement_ratings',
  'admin_nav_seen',
];

const PHASE_12_SQL = `
ALTER TABLE workers ADD COLUMN IF NOT EXISTS cpd_total_hours integer NOT NULL DEFAULT 0;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS experience_total_months integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS workers_cpd_hours_idx ON workers (cpd_total_hours);
CREATE INDEX IF NOT EXISTS workers_experience_months_idx ON workers (experience_total_months);
CREATE INDEX IF NOT EXISTS worker_personal_info_state_idx
  ON worker_personal_info USING gin (state_of_origin gin_trgm_ops);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_status') THEN
    CREATE TYPE offer_status AS ENUM ('DRAFT','AGENT_REVIEW','SENT_TO_WORKER','COUNTERED','ACCEPTED','DECLINED','WITHDRAWN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_currency') THEN
    CREATE TYPE offer_currency AS ENUM ('NGN','GBP','USD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_accommodation_type') THEN
    CREATE TYPE offer_accommodation_type AS ENUM ('LIVE_IN','LIVE_OUT','HYBRID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status') THEN
    CREATE TYPE conversation_status AS ENUM ('OPEN','LOCKED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS placement_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status offer_status NOT NULL DEFAULT 'DRAFT',
  pipeline_type pipeline_type NOT NULL,
  start_date date NOT NULL,
  end_date date,
  salary_amount_minor bigint NOT NULL,
  salary_currency offer_currency NOT NULL,
  accommodation_type offer_accommodation_type,
  schedule text,
  notes text,
  agent_reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  agent_reviewed_at timestamptz,
  worker_responded_at timestamptz,
  counter_offer_id uuid,
  accepted_at timestamptz,
  declined_reason text,
  placement_id uuid REFERENCES placements(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS placement_offers_shortlist_idx ON placement_offers (shortlist_id, worker_id);
CREATE INDEX IF NOT EXISTS placement_offers_employer_idx ON placement_offers (employer_id, status);
CREATE INDEX IF NOT EXISTS placement_offers_worker_idx ON placement_offers (worker_id, status);
CREATE INDEX IF NOT EXISTS placement_offers_status_idx ON placement_offers (status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS placement_offers_live_uniq_idx
  ON placement_offers (shortlist_id, worker_id)
  WHERE status NOT IN ('WITHDRAWN','DECLINED');

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  status conversation_status NOT NULL DEFAULT 'OPEN',
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_uniq_idx ON conversations (shortlist_id, worker_id);
CREATE INDEX IF NOT EXISTS conversations_employer_idx ON conversations (employer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_worker_idx ON conversations (worker_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  flagged_for_review boolean NOT NULL DEFAULT false,
  flagged_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  redacted_body text,
  reviewed_by_agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  read_by_recipient_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_flagged_idx ON messages (flagged_for_review, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL,
  notify_on_new_match boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_searches_employer_idx ON saved_searches (employer_id, updated_at DESC);
`;

const PHASE_13_SQL = `
CREATE TABLE IF NOT EXISTS welfare_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  welfare_check_id uuid NOT NULL UNIQUE REFERENCES welfare_checks(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  storage_key text,
  pdf_base64 text,
  delivered_to_email text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS welfare_reports_placement_idx
  ON welfare_reports (placement_id, created_at DESC);

CREATE TABLE IF NOT EXISTS welfare_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  welfare_check_id uuid NOT NULL REFERENCES welfare_checks(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  severity wellbeing_level NOT NULL,
  due_at timestamptz NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes text,
  overdue_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS welfare_escalations_open_idx
  ON welfare_escalations (placement_id, resolved_at);
CREATE INDEX IF NOT EXISTS welfare_escalations_due_idx
  ON welfare_escalations (due_at);
`;

const PHASE_14_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_superseded_fk'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_superseded_fk
      FOREIGN KEY (superseded_by_id) REFERENCES contracts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  superseding_contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  changed_fields jsonb NOT NULL,
  reason text,
  kind text NOT NULL DEFAULT 'AMENDMENT',
  initiated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_amendments_original_idx
  ON contract_amendments (original_contract_id);
CREATE INDEX IF NOT EXISTS contract_amendments_superseding_idx
  ON contract_amendments (superseding_contract_id);

CREATE TABLE IF NOT EXISTS saved_search_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id uuid NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS saved_search_matches_uniq_idx
  ON saved_search_matches (saved_search_id, worker_id);
`;

/* Phase 15: search + visibility-gate performance indexes. */
const PHASE_15_SQL = `
-- ILIKE '%term%' skill/language facets in worker search
CREATE INDEX IF NOT EXISTS worker_skills_name_trgm
  ON worker_skills USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS worker_skills_worker_kind_idx
  ON worker_skills (worker_id, kind);
CREATE INDEX IF NOT EXISTS worker_preferences_avail_idx
  ON worker_preferences (availability_start);

-- partial indexes matching the visibility gate's correlated EXISTS probes
CREATE INDEX IF NOT EXISTS background_checks_worker_clear_idx
  ON background_checks (worker_id) WHERE status = 'CLEAR';
CREATE INDEX IF NOT EXISTS certifications_worker_oakvale_idx
  ON certifications (worker_id, expires_at) WHERE is_oakvale_cert = true;
CREATE INDEX IF NOT EXISTS compliance_flags_worker_safeguarding_open_idx
  ON compliance_flags (worker_id) WHERE flag_type = 'SAFEGUARDING' AND resolved_at IS NULL;
`;

/* Phase 16: drop GPS coordinates from worker personal info. */
const PHASE_16_SQL = `
ALTER TABLE worker_personal_info DROP COLUMN IF EXISTS gps_lat;
ALTER TABLE worker_personal_info DROP COLUMN IF EXISTS gps_lng;
`;

/* Phase 17: snapshot of last-approved profile for the edit-with-revalidation flow. */
const PHASE_17_SQL = `
ALTER TABLE workers ADD COLUMN IF NOT EXISTS pre_edit_snapshot jsonb;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS edit_requested_at timestamptz;
`;

/* Phase 18a: job-post review status (must commit before the value is used). */
const PHASE_18A_SQL = `
ALTER TYPE job_posting_status ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'OPEN';
`;

/* Phase 18b: worker job applications + interview workflow. */
const PHASE_18B_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_application_status') THEN
    CREATE TYPE job_application_status AS ENUM ('APPLIED','REVIEWED','PROGRESSED','REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_format') THEN
    CREATE TYPE interview_format AS ENUM ('IN_PERSON','VIDEO','PHONE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_status') THEN
    CREATE TYPE interview_status AS ENUM ('REQUESTED','CONFIRMED','RESCHEDULE_PROPOSED','COMPLETED','CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_outcome') THEN
    CREATE TYPE interview_outcome AS ENUM ('PROGRESSING','NOT_PROGRESSING','ON_HOLD');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS job_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_posting_id uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  status job_application_status NOT NULL DEFAULT 'APPLIED',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_applications_job_idx ON job_applications (job_posting_id);
CREATE INDEX IF NOT EXISTS job_applications_worker_idx ON job_applications (worker_id);
CREATE UNIQUE INDEX IF NOT EXISTS job_applications_uniq_idx ON job_applications (job_posting_id, worker_id);

CREATE TABLE IF NOT EXISTS interviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  shortlist_id uuid REFERENCES shortlists(id) ON DELETE SET NULL,
  job_posting_id uuid REFERENCES job_postings(id) ON DELETE SET NULL,
  format interview_format NOT NULL,
  proposed_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed_slot timestamptz,
  status interview_status NOT NULL DEFAULT 'REQUESTED',
  outcome interview_outcome,
  outcome_notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interviews_employer_idx ON interviews (employer_id);
CREATE INDEX IF NOT EXISTS interviews_worker_idx ON interviews (worker_id);
CREATE INDEX IF NOT EXISTS interviews_status_idx ON interviews (status);
`;

/* Phase 19a: align agent specialties to PRD §3 roles (values must commit before use). */
const PHASE_19A_SQL = `
ALTER TYPE agent_specialty ADD VALUE IF NOT EXISTS 'ACCOUNT_MANAGER';
ALTER TYPE agent_specialty ADD VALUE IF NOT EXISTS 'ADMIN';
`;

/* Phase 19b: migrate deprecated GENERAL agents to ADMIN; realign column default. */
const PHASE_19B_SQL = `
UPDATE agent_profiles SET specialty = 'ADMIN' WHERE specialty = 'GENERAL';
ALTER TABLE agent_profiles ALTER COLUMN specialty SET DEFAULT 'ADMIN';
`;

/* Phase 20: admin-configurable workforce categories. */
const PHASE_20_SQL = `
CREATE TABLE IF NOT EXISTS workforce_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  required_certifications jsonb NOT NULL DEFAULT '[]',
  required_identity_fields jsonb NOT NULL DEFAULT '[]',
  skills_menu jsonb NOT NULL DEFAULT '[]',
  specialist_tags jsonb NOT NULL DEFAULT '[]',
  applicable_settings jsonb NOT NULL DEFAULT '[]',
  applicable_employment_types jsonb NOT NULL DEFAULT '[]',
  required_compliance_fields jsonb NOT NULL DEFAULT '[]',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workforce_categories_active_idx ON workforce_categories (is_active);
`;

/* Phase 21: assign a primary workforce category to each worker. */
const PHASE_21_SQL = `
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS workforce_category_id uuid
  REFERENCES workforce_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS workers_category_idx ON workers (workforce_category_id);
`;

/*
 * Phase 22: configurable employer types (§5). 22A adds the new EMPLOYER role
 * value (must be committed before it can be used — the users.role backfill runs
 * later, in the seed). 22B creates the employer_types table + the FK column.
 */
const PHASE_22A_SQL = `
ALTER TYPE role ADD VALUE IF NOT EXISTS 'EMPLOYER';
ALTER TYPE employer_type ADD VALUE IF NOT EXISTS 'OTHER';
`;

const PHASE_22B_SQL = `
CREATE TABLE IF NOT EXISTS employer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  role_key text NOT NULL,
  registration_fields jsonb NOT NULL DEFAULT '[]',
  verification_methods jsonb NOT NULL DEFAULT '[]',
  service_model text NOT NULL DEFAULT 'SELF_SERVICE',
  job_posting_enabled boolean NOT NULL DEFAULT false,
  onboarding_steps jsonb NOT NULL DEFAULT '[]',
  allowed_worker_category_ids jsonb,
  applicable_contract_types jsonb NOT NULL DEFAULT '[]',
  pricing jsonb NOT NULL DEFAULT '{}',
  payment_providers jsonb NOT NULL DEFAULT '[]',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employer_types_active_idx ON employer_types (is_active);
CREATE INDEX IF NOT EXISTS employer_types_role_key_idx ON employer_types (role_key);

ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS employer_type_id uuid
  REFERENCES employer_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS employers_type_id_idx ON employers (employer_type_id);
`;

/*
 * Phase 23: drop the legacy `employer_type` enum column now that every employer
 * carries `employer_type_id` and all reads derive behaviour from the config
 * (§5 Phase 5). Backfills any stragglers from the enum first (no-op once the
 * seed has run), enforces NOT NULL, then drops the column + the now-unused enum.
 * Idempotent: the column/type guards make a re-run a no-op.
 */
const PHASE_23_SQL = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employers' AND column_name = 'employer_type'
  ) THEN
    EXECUTE $q$
      UPDATE employers e SET employer_type_id = t.id
        FROM employer_types t
        WHERE e.employer_type_id IS NULL AND t.slug = e.employer_type::text
    $q$;
  END IF;
END $$;
ALTER TABLE employers ALTER COLUMN employer_type_id SET NOT NULL;
DROP INDEX IF EXISTS employers_type_idx;
ALTER TABLE employers DROP COLUMN IF EXISTS employer_type;
DROP TYPE IF EXISTS employer_type;
`;

/*
 * Phase 24: NDPA consent capture at registration (§6.1 Step 1). Records each
 * consent a user gives (TERMS / PRIVACY / BACKGROUND_CHECK), versioned + IP-stamped.
 */
const PHASE_24_SQL = `
CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_consents_user_type_idx ON user_consents (user_id, consent_type);
`;

/*
 * Phase 25: new enum values for the admin-reviewed background-check flow (the old
 * automated provider was removed). New enum values must be committed before use.
 */
const PHASE_25_SQL = `
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'POLICE_CHARACTER_CERT';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'GUARANTOR_LETTER';
ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'AFFIDAVIT_GOOD_CONDUCT';
ALTER TYPE background_check_status ADD VALUE IF NOT EXISTS 'FLAGGED';
`;

/*
 * Phase 26: background-check documents live on worker_background_consent; the
 * background_checks row becomes an admin-reviewed record (drop the old provider
 * reference column, add reviewer + notes).
 */
const PHASE_26_SQL = `
ALTER TABLE worker_background_consent
  ADD COLUMN IF NOT EXISTS police_certificate_document_id uuid,
  ADD COLUMN IF NOT EXISTS guarantor_letter_document_id uuid,
  ADD COLUMN IF NOT EXISTS affidavit_document_id uuid;
ALTER TABLE background_checks
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE background_checks DROP COLUMN IF EXISTS sterling_reference_id;
`;

/*
 * Phase 27: §6.3 job-post fields — workforce category, certification required,
 * background-check-required, visibility (Public/Restricted), preferred contact
 * method. New enum types can be created and used in the same phase (the same-txn
 * restriction only applies to ALTER TYPE ... ADD VALUE).
 */
const PHASE_27_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_visibility') THEN
    CREATE TYPE job_visibility AS ENUM ('PUBLIC', 'RESTRICTED');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_contact_method') THEN
    CREATE TYPE job_contact_method AS ENUM ('DIRECT_APPLICATION', 'OAKVALE_SHORTLIST');
  END IF;
END $$;
ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS workforce_category_id uuid REFERENCES workforce_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certification_required text,
  ADD COLUMN IF NOT EXISTS background_check_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibility job_visibility NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS preferred_contact_method job_contact_method NOT NULL DEFAULT 'DIRECT_APPLICATION';
CREATE INDEX IF NOT EXISTS job_postings_category_idx ON job_postings (workforce_category_id);
`;

/*
 * Phase 28: §6.2 employer verification workflow — verification status + reviewer +
 * account manager on employers, and an employer_documents table (proof-of-residence,
 * ID, CAC certificate) reusing the document_status enum + ClamAV scan queue.
 */
const PHASE_28_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employer_verification_status') THEN
    CREATE TYPE employer_verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employer_document_category') THEN
    CREATE TYPE employer_document_category AS ENUM ('PROOF_OF_RESIDENCE', 'EMPLOYER_ID', 'CAC_CERTIFICATE');
  END IF;
END $$;
ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS verification_status employer_verification_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS account_manager_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS employers_verification_idx ON employers (verification_status);
CREATE TABLE IF NOT EXISTS employer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  category employer_document_category NOT NULL,
  storage_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  status document_status NOT NULL DEFAULT 'UPLOADING',
  scanned_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employer_documents_employer_idx ON employer_documents (employer_id);
CREATE INDEX IF NOT EXISTS employer_documents_status_idx ON employer_documents (status);
`;

/*
 * Phase 29: GAP-004 — admin-editable notification templates. One row per NotificationKind;
 * DB is the source of truth for notification copy (code defaults seed it + act as fallback).
 */
const PHASE_29_SQL = `
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL UNIQUE,
  subject text NOT NULL,
  html text NOT NULL,
  text text NOT NULL,
  sms text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

/*
 * Phase 30: GAP-006 — hard-block contact-sharing in messages. `blocked_at` marks a message that was
 * rejected for containing contact details and never delivered (kept for agent review + audit trail).
 */
const PHASE_30_SQL = `
ALTER TABLE messages ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
`;

/*
 * Phase 31: drop the retired job-posting fields — free-text department, the
 * preferred contact method (job_contact_method enum), and the free-text Oakvale
 * certification-required field. All were removed from the job-post form and schema;
 * the corporate shortlist now uses a fixed sector.
 */
const PHASE_31_SQL = `
ALTER TABLE job_postings DROP COLUMN IF EXISTS department;
ALTER TABLE job_postings DROP COLUMN IF EXISTS preferred_contact_method;
ALTER TABLE job_postings DROP COLUMN IF EXISTS certification_required;
DROP TYPE IF EXISTS job_contact_method;
`;

/*
 * Phase 32: country-aware work location + currency-aware salary range. A job posting
 * is anchored to a country (drives the work-location options) and a salary currency
 * (drives the band options). work_location/salary_range stay free text storing the
 * selected label.
 */
const PHASE_32_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_country') THEN
    CREATE TYPE job_country AS ENUM ('NIGERIA', 'UK');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_salary_currency') THEN
    CREATE TYPE job_salary_currency AS ENUM ('NGN', 'USD');
  END IF;
END $$;
ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS country job_country NOT NULL DEFAULT 'NIGERIA',
  ADD COLUMN IF NOT EXISTS salary_currency job_salary_currency NOT NULL DEFAULT 'NGN';
`;

/*
 * Phase 33: backfill tables that lived only in schema.ts (never had a CREATE phase, so a
 * from-scratch migrate.ts build was missing them): CPD enrolments, the payroll ledger
 * (payroll_runs → worker_payouts, NGN-only per Rule #6), and placement ratings.
 */
const PHASE_33_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cpd_enrolment_status') THEN
    CREATE TYPE cpd_enrolment_status AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_run_status') THEN
    CREATE TYPE payroll_run_status AS ENUM ('DRAFT', 'APPROVED', 'PAID');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'worker_payout_status') THEN
    CREATE TYPE worker_payout_status AS ENUM ('PENDING', 'PAID');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cpd_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  programme_id text NOT NULL,
  programme_name text NOT NULL,
  status cpd_enrolment_status NOT NULL DEFAULT 'ENROLLED',
  lms_enrolment_id text,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cpd_enrolments_worker_idx ON cpd_enrolments (worker_id);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status payroll_run_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_runs_status_idx ON payroll_runs (status);

CREATE TABLE IF NOT EXISTS worker_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  placement_id uuid REFERENCES placements(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'NGN',
  amount_minor bigint NOT NULL,
  status worker_payout_status NOT NULL DEFAULT 'PENDING',
  paid_at timestamptz,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS worker_payouts_run_idx ON worker_payouts (payroll_run_id);
CREATE INDEX IF NOT EXISTS worker_payouts_worker_idx ON worker_payouts (worker_id);
CREATE UNIQUE INDEX IF NOT EXISTS worker_payouts_run_worker_unique ON worker_payouts (payroll_run_id, worker_id);

CREATE TABLE IF NOT EXISTS placement_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  rated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  stars integer NOT NULL,
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS placement_ratings_placement_unique ON placement_ratings (placement_id);
CREATE INDEX IF NOT EXISTS placement_ratings_worker_idx ON placement_ratings (worker_id);
`;

/*
 * Phase 34: referral attribution at signup (brief §2). `referral_source` holds the
 * fixed dropdown value; `referrer_name` is only populated when source is a personal
 * referral. Indexed so admins can group signups by acquisition channel.
 */
const PHASE_34_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_name text;
CREATE INDEX IF NOT EXISTS users_referral_source_idx ON users (referral_source);
`;

/*
 * Phase 35: configurable care-type taxonomy for the employer job-posting side (brief §5).
 * Employers pick the type of care a role needs so caregivers self-select — without
 * caregivers falsely claiming specialties. The list is admin-configurable (not hardcoded);
 * MVP defaults are seeded separately. Job postings reference a care type (nullable so
 * existing rows and non-care postings are unaffected).
 */
const PHASE_35_SQL = `
CREATE TABLE IF NOT EXISTS care_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_types_active_idx ON care_types (is_active);
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS care_type_id uuid REFERENCES care_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS job_postings_care_type_idx ON job_postings (care_type_id);
`;

// Brief §3: admins review uploaded certificates (approve/reject). An Oakvale cert
// only counts toward the visibility/apply gate once APPROVED. The backfill is
// guarded on the column not yet existing so it runs exactly once — this migration
// runner re-applies every phase on each boot, and an unconditional UPDATE would
// clobber genuinely-pending reviews on the next restart.
const PHASE_36_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cert_verification_status') THEN
    CREATE TYPE cert_verification_status AS ENUM ('PENDING','APPROVED','REJECTED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'certifications' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE certifications ADD COLUMN verification_status cert_verification_status;
    -- Grandfather existing submissions so already-certified workers stay visible.
    UPDATE certifications SET verification_status = 'APPROVED' WHERE verification_status IS NULL;
    ALTER TABLE certifications ALTER COLUMN verification_status SET DEFAULT 'PENDING';
    ALTER TABLE certifications ALTER COLUMN verification_status SET NOT NULL;
  END IF;
END $$;

ALTER TABLE certifications ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS review_note text;
CREATE INDEX IF NOT EXISTS certifications_verification_status_idx ON certifications (verification_status);
`;

// Per-admin "last seen" marker per admin-sidebar queue — powers the "new since you
// last opened it" count bubbles (see admin/nav-counts.service).
const PHASE_37_SQL = `
CREATE TABLE IF NOT EXISTS admin_nav_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nav_key text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_nav_seen_admin_key_uniq ON admin_nav_seen (admin_user_id, nav_key);
`;

// §5 — optional grouped care specialisations selected on a job posting.
const PHASE_38_SQL = `
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS specialisations jsonb NOT NULL DEFAULT '[]'::jsonb;
`;

async function connectWithRetry(url: string, attempts = 15, delayMs = 2000) {
  for (let i = 1; i <= attempts; i++) {
    const client = postgres(url, { max: 1 });
    try {
      await client`select 1`;
      return client;
    } catch (err) {
      await client.end({ timeout: 5 }).catch(() => {});
      if (i === attempts) throw err;
      logger.warn({ attempt: i, attempts }, 'DB not reachable yet, retrying');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('unreachable');
}

async function run() {
  const env = loadEnv();
  const client = await connectWithRetry(env.DATABASE_URL);
  try {
    await client.unsafe(PHASE_0_SQL);
    await client.unsafe(PHASE_1_SQL);
    await client.unsafe(PHASE_2_SQL);
    await client.unsafe(PHASE_3_SQL);
    await client.unsafe(PHASE_4_SQL);
    await client.unsafe(PHASE_5_SQL);
    await client.unsafe(PHASE_6_SQL);
    await client.unsafe(PHASE_7_SQL);
    await client.unsafe(PHASE_8_SQL);
    await client.unsafe(PHASE_9_SQL);
    await client.unsafe(PHASE_10_SQL);
    await client.unsafe(PHASE_11_SQL);
    await client.unsafe(PHASE_12_SQL);
    await client.unsafe(PHASE_13_SQL);
    await client.unsafe(PHASE_14_SQL);
    await client.unsafe(PHASE_15_SQL);
    await client.unsafe(PHASE_16_SQL);
    await client.unsafe(PHASE_17_SQL);
    await client.unsafe(PHASE_18A_SQL);
    await client.unsafe(PHASE_18B_SQL);
    await client.unsafe(PHASE_19A_SQL);
    await client.unsafe(PHASE_19B_SQL);
    await client.unsafe(PHASE_20_SQL);
    await client.unsafe(PHASE_21_SQL);
    await client.unsafe(PHASE_22A_SQL);
    await client.unsafe(PHASE_22B_SQL);
    await client.unsafe(PHASE_23_SQL);
    await client.unsafe(PHASE_24_SQL);
    await client.unsafe(PHASE_25_SQL);
    await client.unsafe(PHASE_26_SQL);
    await client.unsafe(PHASE_27_SQL);
    await client.unsafe(PHASE_28_SQL);
    await client.unsafe(PHASE_29_SQL);
    await client.unsafe(PHASE_30_SQL);
    await client.unsafe(PHASE_31_SQL);
    await client.unsafe(PHASE_32_SQL);
    await client.unsafe(PHASE_33_SQL);
    await client.unsafe(PHASE_34_SQL);
    await client.unsafe(PHASE_35_SQL);
    await client.unsafe(PHASE_36_SQL);
    await client.unsafe(PHASE_37_SQL);
    await client.unsafe(PHASE_38_SQL);
    for (const table of TIMESTAMPED_TABLES) {
      await client.unsafe(`
        DROP TRIGGER IF EXISTS ${table}_set_updated_at ON ${table};
        CREATE TRIGGER ${table}_set_updated_at BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      `);
    }
    logger.info('Migrations applied');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
