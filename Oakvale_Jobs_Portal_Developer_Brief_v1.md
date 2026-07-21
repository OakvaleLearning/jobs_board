# OAKVALE LEARNING — Jobs Portal
## Comprehensive Developer Brief

**Version 1.0 · May 2026 · Confidential**

**jobs.oakvaleltd.com**

*A verified, gated workforce marketplace connecting certified health and care professionals with diaspora families, Nigerian corporates, hospitals, NGOs, and care institutions.*

---

## 1. Purpose & Scope of This Brief

This document is the authoritative specification for the Oakvale Jobs Portal. It covers all functional requirements, workflow logic, data architecture, access control rules, and pipeline-specific features the developer needs to build, launch, and extend the platform.

The brief is organised in the following sequence:

- Platform overview and strategic context
- User roles and access model
- Workforce taxonomy and extensibility model
- Employer taxonomy and extensibislity model
- Core workflows: talent discovery, engagement, hiring, onboarding, placement
- Contracts management
- Complaints and resolution management
- Pipeline-specific requirements: Diaspora Caregiving and Corporate Crèche
- Platform and technical requirements
- Launch scope (MVP) and post-launch roadmap

> **Design Principle** — The platform must be built for extensibility from day one. The initial launch serves two pipelines (Diaspora Caregiving and Corporate Crèche) and two worker types (Certified Caregiver, Certified Childcare Worker). Within 12 months, the platform must be able to onboard new workforce categories — care coordinators, hospital administrators, medical billing specialists, liaison nurses, community health workers — and new employer types — hospitals, clinics, NGOs, government agencies — without requiring architectural rework. Every data schema, UI pattern, and workflow must be designed with this extension in mind.

---

## 2. Platform Overview

### 2.1 What the Platform Is

The Oakvale Jobs Portal is a gated, credential-verified workforce marketplace. It is not a general job board. Access and trust are built on Oakvale certification. The platform has three primary functions:

- **Credentialing gateway** — only workers who hold a valid Oakvale certificate (or are in the process of obtaining one via the training-to-hire pathway) appear as verified on the platform.
- **Talent marketplace** — employers discover, shortlist, contact, and hire verified workers for specific roles and settings.
- **Managed service platform** — Oakvale agents manage placements, welfare checks, CPD compliance, contracts, and complaints on behalf of both parties.

### 2.2 Platform Domain

The jobs portal lives at `jobs.oakvaleltd.com` and is a distinct subdomain from the main Oakvale B2C learning site and B2B institutional site. It must be buildable as an independent application but capable of receiving deep-linked referrals from both other sites (e.g. 'Complete your programme to unlock the jobs board' → graduation trigger → automatic portal access granted).

### 2.3 Foundational Design Constraints

| Constraint | Requirement |
| --- | --- |
| Mobile-first | Primary users (workers) are in Nigeria on mobile. All worker-facing interfaces must be fully functional on low-end Android devices with slow connections. |
| Low-bandwidth tolerance | Profile images and documents must be compressed on upload. Forms must save progress incrementally. No heavy JavaScript frameworks on worker-facing screens. |
| Bilingual foundation | Worker-facing interfaces must support English and Hausa at launch. Architecture must support additional languages (Yoruba, Igbo, Pidgin) via a content key system — no hardcoded strings. |
| Offline-tolerant forms | Workers should be able to fill forms offline and submit when connected. Use progressive web app (PWA) patterns for worker registration and profile. |
| Data privacy | Full NDPA 2023 (Nigeria Data Protection Act) compliance required. GDPR-aware design for UK-facing diaspora employer interfaces. Separate data residency consideration for UK vs Nigeria user data. |
| Audit trail | All actions by all user types — profile edits, status changes, messages, contract signings, complaints — must be logged with timestamp, user ID, and IP for audit purposes. |

---

## 3. User Roles & Access Model

The platform has four primary user roles. All roles have distinct interfaces, permissions, and data visibility.

| Role | Description | Primary Interface |
| --- | --- | --- |
| Worker (Candidate) | Health or care professional seeking employment. Must hold or be pursuing an Oakvale certificate. Can create a profile, apply for roles, manage placements, receive and sign contracts, and raise complaints. | Worker Portal (mobile-optimised) |
| Employer | Organisation or individual seeking to hire verified workers. Subtypes include diaspora families, Nigerian corporates, hospitals, clinics, NGOs, and government agencies. Can post roles, search workers, shortlist, manage contracts, and raise complaints. | Employer Portal (desktop-primary, mobile-capable) |
| Oakvale Agent | Internal Oakvale staff: BDMs, Liaison Nurses, Recruiters, Admin, Account Managers. Can manage workers and employers on behalf of Oakvale, facilitate placements, trigger background checks, manage compliance, handle complaints, and generate reports. | Agent Dashboard (desktop) |
| Platform Admin | Senior Oakvale staff with full system access. Can manage all users, configure platform settings, view all data, run all reports, manage subscription and billing configurations, and set role permissions. | Admin Console (desktop) |

### 3.1 Access Control Rules

#### Worker Access

- Workers with an active Oakvale certificate: full access — can view all job listings, apply, message employers, and accept placements.
- Workers with a certificate in progress (enrolled, not yet graduated): limited access — can complete their profile and be shortlisted for future roles, but cannot submit active applications.
- Workers without any Oakvale enrolment: public landing page only — redirected to B2C programme pages with CTA to enrol.
- Suspended workers: all portal access revoked pending investigation. Profile hidden from employer searches.

#### Employer Access

- Registered and verified employers: full access to search workers, post jobs, manage placements and contracts.
- Unverified employer registrations: can submit registration form but cannot search workers or post jobs until Oakvale agent completes verification.
- Diaspora employer (UK/US-based family): special registration flow — verified via proof of UK/US residence and ID. Does not post public jobs; works via account manager matching.
- Corporate employer: verified via CAC registration number and company email domain. Self-service job posting enabled after verification.

#### Agent Access (Role-Based)

- **BDM:** access to employer accounts, contracts, engagement history, pipeline reports. Cannot access financial reports unless granted.
- **Recruiter:** access to worker profiles, shortlisting, placement management, background check status. Cannot approve contracts or billing.
- **Liaison Nurse:** access to clinical compliance fields, CPD tracking, welfare check logs. Cannot view financial data.
- **Admin:** access to all records. Can update status, add flags, run reports. Cannot delete records.
- **Account Manager:** access to all records for their assigned employer accounts and placed workers.

---

## 4. Workforce Taxonomy & Extensibility Model

### 4.1 Design Principle

Worker types must be managed via a configurable taxonomy, not hardcoded. A Platform Admin must be able to add a new workforce category — for example, 'Medical Billing Specialist' or 'Hospital Administrator' — from the Admin Console without any code changes. The taxonomy drives: profile field sets, skills menus, certification requirements, search filters, and matching logic.

### 4.2 Launch Workforce Categories

| Category | Description | Typical Placement Setting |
| --- | --- | --- |
| Certified Caregiver (Elderly / Home Care) | Trained in elderly care, medication management, dementia care, post-surgical support. Holds Oakvale Caregiver certification (CPD-accredited, UK-recognised). | Home placement (diaspora pipeline), care homes, private households |
| Certified Childcare Worker (Early Years) | Trained in early years development, child safeguarding, infant care, SEND awareness. Holds Oakvale Childcare Programme certification. | Corporate crèche, nurseries, private households with children |

### 4.3 Planned Workforce Categories (Post-Launch)

The following categories are planned for addition within 12 months of launch. The schema and UI must be designed to accommodate all of them without refactoring:

| Category | Key Skills / Certification | Typical Placement Setting |
| --- | --- | --- |
| Care Coordinator | Care planning, multi-agency liaison, assessments, safeguarding oversight | Hospitals, community health orgs, NGOs |
| Community Health Worker / CHW | Health promotion, disease surveillance, referral, basic clinical skills | NGO programmes, government health schemes, community outreach |
| Hospital Administrator | Patient records, scheduling, insurance, procurement, compliance | Private hospitals, clinics, diagnostic centres |
| Medical Billing Specialist | Health insurance claims, coding (ICD-10), billing reconciliation | Hospitals, HMO interfaces, clinics |
| Liaison Nurse | Clinical oversight, employer-worker interface, compliance monitoring | Hospitals, corporate health programmes |
| Pharmacy Assistant | Dispensing, stock management, prescription management | Pharmacies, hospitals, clinics |
| Clinical Assistant / Healthcare Assistant | Vital signs, sample collection, patient support | Hospitals, clinics, diagnostic centres |
| Mental Health Support Worker | Emotional support, crisis de-escalation, therapeutic activities | NGOs, community mental health, residential care |
| Occupational Therapist Assistant | Rehabilitation support, adaptive equipment, client goals | Hospitals, rehabilitation centres, home care |

### 4.4 Workforce Category Configuration (Admin Console)

Each workforce category is a configurable entity in the Admin Console. When adding a new category, the Platform Admin defines:

- Category name and description
- Required Oakvale certification(s) — links to LMS graduation check
- Required identity verification fields
- Sector-specific skills menu (multi-select, configurable)
- Specialist skills tags (configurable)
- Applicable placement settings (home / clinic / hospital / corporate / NGO / remote)
- Applicable employment types (full-time / part-time / shift / live-in / contract)
- Compliance fields required (immunisation, professional registration, DBS equivalent)
- Visibility: whether the category is active and searchable

---
    
## 5. Employer Taxonomy & Extensibility Model

### 5.1 Design Principle

Employer types are also configurable. Different employer types have different registration flows, verification requirements, pricing structures, and service delivery models. Platform Admin must be able to add new employer types from the Admin Console.

### 5.2 Launch Employer Types

| Employer Type | Description | Primary Worker Categories |
| --- | --- | --- |
| Diaspora Family (UK/US) | Individual or family unit based in UK or USA, hiring a carer for an elderly or dependent relative in Nigeria. High-trust, high-touch service. Managed by account manager. | Certified Caregiver (Elderly) |
| Nigerian Corporate (Crèche) | Medium to large Nigerian company with an on-site crèche. Hiring certified childcare workers. Annual partnership model. | Certified Childcare Worker |

### 5.3 Planned Employer Types (Post-Launch)

| Employer Type | Description | Primary Worker Categories |
| --- | --- | --- |
| Private Hospital / Clinic | Private healthcare facility hiring clinical and administrative staff. Self-service job posting with agent oversight. | Liaison Nurse, Clinical Assistant, Hospital Administrator, Medical Billing |
| NGO / INGO | International or domestic NGO operating health or development programmes. High familiarity with accreditation frameworks. | Community Health Worker, Care Coordinator, Nurse |
| Government Health Agency | Federal or state health ministry or agency. Formal procurement process. Bulk hiring. | CHW, Care Coordinator, Administrator |
| Diagnostic Centre | Standalone diagnostic or pathology facility. Hiring clinical assistants and administrators. | Clinical Assistant, Hospital Administrator |
| Care Home / Residential Facility | Residential care setting for elderly or persons with disabilities. | Certified Caregiver, Mental Health Support Worker |
| Private Household (Local) | Nigeria-based family hiring domestic care or childcare worker directly, without diaspora context. | Certified Caregiver, Certified Childcare Worker |
| UK Care Agency (Partner) | UK-registered care agency using Oakvale as a verified supply partner for Nigerian workers. Wholesale model. | Certified Caregiver |

### 5.4 Employer Type Configuration (Admin Console)

Each employer type defines:

- Registration fields required
- Verification method (CAC number / company email / proof of residency / other)
- Pricing model (placement fee / subscription / managed service / bulk training)
- Service model (self-service / account-managed / hybrid)
- Job posting: enabled (self-service) or managed (via Oakvale agent)
- Worker categories accessible to this employer type
- Contract template(s) applicable
- Payment gateway(s) applicable (Stripe GBP/USD for diaspora; Paystack/Flutterwave NGN for corporates)

---

## 6. Core Workflows

### 6.1 Worker Registration & Profile Creation

The worker registration flow must be completable in multiple sessions (progress saved at each step). Profile completion percentage is displayed prominently. Workers cannot be listed as 'searchable' until a minimum completion threshold (70%) is reached and identity verification is approved.

#### Step 1: Account Creation

- Phone number (primary identifier) + OTP verification
- Email address (optional at registration, required before first application)
- Password set
- Consent to terms, privacy policy, and background check (checkboxes with links to full text)

#### Step 2: Personal Information

All fields from the Proforma Data Fields document, Section 1A. Fields are grouped into logical steps. Each step auto-saves on navigation.

#### Step 3: Identity Verification

Fields from Section 1B of the Proforma. Document upload (NIN, passport, voter card, driver's licence). Selfie/liveness capture. Address proof upload. Verification status set to 'Pending' until Oakvale agent or automated review approves. Worker can continue building profile while pending but appears as 'Verification in Progress' to employers.

#### Step 4: Background Check Consent & Trigger

Checkbox consent and submission of background check request to Sterling BackCheck Nigeria. Status tracked as: Not Requested / Pending / In Progress / Clear / Flagged. Clear status displayed as a badge on the worker's profile. Flagged status triggers an internal agent review; worker is notified of outcome.

#### Steps 5–12: Remaining Profile Sections

Education, Professional Experience, References, Employment Preferences, Skills & Competencies, Salary Expectations, Compliance & Certifications, Video Introduction (optional). Each section maps directly to the corresponding section of the Proforma Data Fields document.

#### Certification Linkage

The Compliance & Certifications section includes a field for Oakvale Certificate Number. This is validated in real-time by an admin. On successful validation: certificate programme, completion date, and CPD hours are auto-populated. The worker's profile is marked as 'Oakvale Verified' and the verification badge is displayed.

> **Key UX Requirement** — The worker registration form must be designed for a user on a mobile phone with intermittent connectivity. Each step must be no more than one screen. Progress must persist across sessions. Document uploads must have a clear file size limit and compression applied automatically. Error messages must be plain English (or Hausa), never technical.

### 6.2 Employer Registration & Verification

#### Diaspora Family Registration

- Family member submits: name, UK/US address, proof of residence, identity document, relationship to care recipient, brief description of care needs.
- Oakvale agent reviews and approves within 2 working days.
- On approval: family receives login credentials, is assigned a named account manager, and is prompted to complete a Care Needs Assessment.

#### Corporate / Institutional Employer Registration

- Organisation submits: name, sector, CAC registration number, address, primary contact, brief description of staffing needs.
- Automated CAC number format check. Agent completes verification (company email domain check, website review) within 2 working days.
- On approval: HR contact receives login credentials and employer portal access. Invited to complete Workforce Requirements form.

### 6.3 Job Posting

Corporate and institutional employers can post jobs directly from the employer portal. Diaspora families do not post jobs — their needs are managed via the account manager and the Care Needs Assessment workflow.

#### Job Post Fields

All fields from Proforma Section 2D, plus:

- Workforce category (dropdown — from configured taxonomy)
- Oakvale certification required (auto-populated from workforce category, editable)
- Background check required (yes/no, defaults to yes for care roles)
- Visibility: Public (searchable by all workers) / Restricted (only matched workers notified)
- Preferred contact method: Direct application / Oakvale-mediated shortlist

#### Job Post Review

All job posts are reviewed by an Oakvale agent before going live. Review checks: appropriate workforce category, realistic requirements, no discriminatory language, salary within reasonable range. Target review turnaround: 1 working day. Employer notified on approval or with revision requests.

### 6.4 Talent Discovery & Search

#### Employer Search Interface

Employers can search the worker pool using the following filters:

- Workforce category
- Oakvale certification held
- Background check status (Clear only)
- Location / state / LGA
- Willingness to relocate
- Employment type (full-time / part-time / live-in / shift)
- Specialist skills (multi-select)
- Language(s) spoken
- Availability date
- Experience level
- CPD hours completed

Search results display: profile photo, name, workforce category, certification badge, background check badge, location, top 3 skills, availability, and a 'Save to Shortlist' button.

#### Agent Matching Interface

Agents have an additional matching tool: input a role specification (from a job post or a diaspora family's care needs assessment) and the system returns a ranked list of workers based on matching score across: certification match, skills match, location, availability, and previous placement ratings. Agent can accept the ranked list or manually adjust the shortlist before sending to the employer.

#### Worker Profile View

Employers viewing a worker's full profile see:

- All profile fields from Proforma Section 1
- Oakvale certification badge (with programme name and date)
- Background check badge (Clear / Pending / Not Yet Completed)
- CPD completion record
- Placement history (anonymised employer names, role, duration, rating)
- Video introduction (if uploaded)
- A 'Request Interview' button and a 'Save to Shortlist' button

> **Privacy Rule** — Worker personal contact details (phone, email, personal address) are NEVER visible to employers via the portal. All contact is mediated through the platform messaging system or via the assigned Oakvale account manager. Full contact details are only released at the point of contract signing, with the worker's explicit consent.

### 6.5 Shortlisting & Engagement

#### Shortlist Management

Employers can maintain multiple shortlists (e.g. by role, by vacancy). Each shortlist shows: worker profile summary, shortlist date, current status (Saved / Interview Requested / Offer Made / Placed / Rejected).

#### Interview Request

- Employer clicks 'Request Interview' on a worker profile.
- System sends notification to worker (SMS + in-app) with: employer name, role description, proposed interview format (in-person / video / phone), and date/time options.
- Worker accepts or proposes alternative time via the portal.
- Confirmed interview added to both parties' dashboards. Oakvale agent is notified and can facilitate if needed.
- Post-interview: employer logs outcome (Progressing / Not Progressing / On Hold) and optional notes.

#### In-Platform Messaging

All employer-worker communication is conducted via the platform's internal messaging system. Messages are logged, timestamped, and visible to Oakvale agents. Workers and employers cannot exchange personal contact details via messages (automated filtering). Oakvale agents can read all messages. A 'Report message' flag is available to both parties.

### 6.6 Offer, Hiring & Onboarding

#### Making an Offer

- Employer selects a worker from the shortlist and clicks 'Make Offer'.
- Offer form: role title, start date, employment type, salary/rate, location, working hours, any specific conditions.
- Offer submitted to Oakvale agent for review. Agent checks: offer terms are fair, match the agreed service tier, and comply with Oakvale standards.
- Agent approves and the offer is sent to the worker via the platform.
- Worker receives notification (SMS + in-app). Views offer details in the portal. Can Accept, Decline, or Negotiate (flagged to Oakvale agent).

#### Acceptance & Onboarding

- Worker accepts offer. Status updated to 'Offer Accepted'.
- System triggers: contract generation workflow (see Section 7), employer invoice generation (placement fee), and account manager notification.
- Worker receives pre-placement briefing via the portal: role details, employer contact protocol, Oakvale code of conduct, emergency escalation procedure.
- Worker confirms receipt of briefing (checkbox) before placement is marked 'Active'.
- Employer receives: worker's full contact details (now released), placement confirmation, account manager contact.

#### Pre-Placement Welfare Check

For care and childcare placements: Oakvale account manager calls the worker within 72 hours of placement start. Outcome logged: Confirmed Active / Unable to Reach / Issue Flagged. If flagged, agent escalation protocol triggered.

---

## 7. Contracts Management

### 7.1 Contract Types

The platform manages three distinct contract types, each between different parties:

| Contract Type | Parties | Triggered By |
| --- | --- | --- |
| Worker Placement Agreement | Oakvale ↔ Worker | Worker accepts an offer. Sets out: role, placement terms, code of conduct, Oakvale obligations, CPD requirements, recourse process. |
| Employer Service Agreement | Oakvale ↔ Employer | Employer's placement offer is confirmed. Sets out: service scope, pricing, replacement guarantee, reporting schedule, Oakvale liability, payment terms, NDPA/GDPR compliance. |
| Annual Partnership Agreement (Corporate) | Oakvale ↔ Corporate Employer | Corporate employer signs up for an annual subscription. Sets out: subscription scope, number of placements covered, replacement SLA, CPD refresh obligations, employer portal access, renewal terms. |

### 7.2 Contract Generation

Contracts are generated from configurable templates stored in the Admin Console. Templates are variable-populated (worker name, employer name, role, start date, salary, placement fee, guarantee terms, etc.). Platform Admin can edit templates and version them. Workers and employers always sign the version active at the time of their placement.

#### Template Variables (examples)

- `{{worker.full_name}}`, `{{worker.certificate_number}}`, `{{worker.role_category}}`
- `{{employer.name}}`, `{{employer.type}}`, `{{employer.contact_name}}`
- `{{placement.role_title}}`, `{{placement.start_date}}`, `{{placement.location}}`, `{{placement.salary}}`
- `{{guarantee.replacement_days}}`, `{{guarantee.window_days}}`
- `{{pricing.placement_fee}}`, `{{pricing.subscription_tier}}`, `{{pricing.managed_service_rate}}`

### 7.3 Digital Signing

Contracts are signed digitally via the platform. Both parties must sign before a placement is marked Active. Signing is implemented as: timestamp + user account confirmation + explicit consent checkbox (not a drawn signature, for mobile compatibility). Signed contracts are stored as PDFs and accessible to both parties via their portal dashboard. Oakvale retains a system copy.

> **Legal Note for Developer** — Digital signing in this context is an affirmative consent action (checkbox + account authentication), not a qualified electronic signature under eIDAS or Nigerian law. Oakvale legal team should confirm this is adequate for their contract types. If qualified e-signatures are needed in future, the architecture should allow a DocuSign or similar integration to be added to the signing step.

### 7.4 Contract Lifecycle States

| State | Description |
| --- | --- |
| Draft | Contract generated but not yet sent to parties. |
| Sent — Awaiting Worker Signature | Sent to worker. Reminder sent after 48 hours if unsigned. |
| Sent — Awaiting Employer Signature | Sent to employer. Reminder sent after 48 hours if unsigned. |
| Fully Executed | Both parties have signed. Placement is now Active. |
| Superseded | Replaced by an amended contract (e.g. after role change). Old version retained in history. |
| Terminated | Contract ended (placement end, dismissal, or mutual agreement). End date and reason logged. |
| Disputed | One party has raised a formal dispute. Contract is locked (no amendments) until dispute is resolved. |

### 7.5 Contract Amendments

If placement terms change (salary adjustment, change of hours, role change), an amended contract is generated. Both parties must re-sign. Previous version is archived. System logs: amendment trigger, who initiated, what changed, and when both parties signed.

### 7.6 Contract Renewal (Annual Partnerships)

Annual Partnership Agreements generate a renewal reminder 60 days before expiry. The renewal workflow is: agent reviews and updates terms → employer receives updated agreement → employer re-signs → new agreement period begins. Lapsed agreements (not renewed within 30 days of expiry) move the employer account to 'Inactive — Awaiting Renewal'.

---

## 8. Placement Management

### 8.1 Placement Record

Each active placement has a placement record containing:

- Worker ID and employer ID
- Role title, workforce category, placement setting
- Start date, expected end date (if fixed-term), actual end date
- Salary/rate agreed
- Account manager assigned
- 90-day replacement guarantee window (countdown from start date)
- Contract ID (links to signed contract)
- Welfare check log (see 8.2)
- CPD status (last check date, next due date)
- Performance notes (agent-only)
- Placement status: Active / Ended / Suspended / Under Review

### 8.2 Welfare Check Workflow

#### Diaspora Pipeline — Monthly Welfare Reports

- Account manager calls or messages the worker monthly.
- Agent logs the check in the placement record: date, method, worker attendance confirmed (Y/N), care recipient wellbeing (Green / Amber / Red), any issues flagged (free text).
- System auto-generates a welfare report from the log template and sends it to the diaspora family's registered email.
- If status is Amber or Red: agent escalation protocol triggered. Agent must log action taken within 24 hours.

#### Corporate Pipeline — Monthly Account Manager Check-in

- Account manager contacts HR contact monthly.
- Agent logs: date, HR contact confirmed attendance (Y/N), any performance concerns (Y/N), CPD status (current / overdue).
- If concerns raised: complaint or issue management workflow triggered (see Section 9).

### 8.3 CPD Compliance Tracking

- Each workforce category has a defined CPD refresh cycle (default: annual, configurable per category).
- System tracks: last CPD completion date, next due date, current status (Current / Due in 30 days / Overdue).
- Alerts sent to worker (SMS + in-app) and employer (email) at: 60 days before due, 30 days before due, on due date, and 30 days after if not completed.
- Overdue CPD triggers agent review. Worker profile badge changes to 'CPD Overdue'. Worker cannot be shortlisted for new roles until CPD is completed.

### 8.4 Replacement Workflow

The replacement guarantee window (90 days from placement start, or 3 working days for corporate crèche SLA) is tracked automatically. When a replacement is triggered:

- Employer or agent raises a replacement request (reason: worker left / underperformance / misconduct / care needs change).
- System logs the request with timestamp and reason.
- If within guarantee window: replacement is sourced at no additional placement fee.
- Agent generates a new shortlist from the matching tool. Employer reviews and selects.
- New placement record created. Original placement record closed and linked to replacement record.
- New 90-day guarantee window begins from new placement start date.

---

## 9. Complaints & Resolution Management

### 9.1 Complaint Types

| Complaint Category | Can Be Raised By | Urgency |
| --- | --- | --- |
| Worker non-attendance | Employer or Agent | High — 2-hour response target |
| Worker underperformance | Employer or Agent | Standard — 48-hour response target |
| Worker misconduct (minor) | Employer or Agent | Standard — 48-hour response target |
| Worker misconduct (serious / safeguarding) | Employer, Agent, or Worker | Critical — immediate response. Worker suspended pending investigation. |
| Employer unfair treatment of worker | Worker or Agent | Standard — 48-hour response target |
| Employer non-payment or payment dispute | Worker or Agent | High — 24-hour response target |
| Platform dispute (contract terms) | Worker or Employer | Standard — 5 working day resolution target |
| Data privacy concern | Any party | High — escalated to Platform Admin and DPO |

### 9.2 Complaint Submission

Any party (worker, employer, or agent) can raise a complaint via the platform. The complaint form captures:

- Complaint category (dropdown from above taxonomy)
- Related placement record (auto-linked if in active placement)
- Date(s) of incident
- Description (free text, minimum 50 characters)
- Supporting documents or screenshots (upload, optional)
- Preferred resolution (free text, optional)

On submission: complaint is assigned a unique case reference. An acknowledgement is sent to the complainant with the reference number and expected response timeframe. The assigned agent is notified immediately. The relevant placement record is flagged.

### 9.3 Complaint Investigation Workflow

| Stage | Action | Owner | Timeframe |
| --- | --- | --- | --- |
| 1. Triage | Agent reviews complaint, confirms category and urgency, assigns to appropriate handler. | Receiving Agent | Within 2 hours of submission |
| 2. Acknowledgement | Both parties receive written acknowledgement with case reference, assigned handler name, and expected resolution date. | Assigned Handler | Within 4 hours of triage |
| 3. Investigation | Handler contacts both parties, reviews placement record, welfare check logs, messages, and any supporting documents. Evidence logged against the case. | Assigned Handler | Per urgency SLA above |
| 4. Resolution Decision | Handler documents findings and proposed resolution. Resolutions requiring suspension, permanent removal, or financial adjustment are escalated to Platform Admin or CEO. | Handler + Escalation | Within SLA |
| 5. Communication | Both parties notified of outcome in writing. Resolution documented on placement record. Any actions triggered. | Assigned Handler | Same day as decision |
| 6. Case Closure | Case marked Closed. Both parties invited to confirm satisfaction (Y/N). Unsatisfied parties can reopen within 7 days with new evidence. | System / Handler | After outcome communicated |

### 9.4 Escalation Rules

- **Safeguarding complaint** → worker immediately suspended → Oakvale CEO + DPO notified → appropriate authorities notified if required → investigation within 24 hours → profile permanently removed if confirmed.
- **Worker misconduct (minor)** → formal warning issued → profile internally flagged → both parties notified in writing → second minor misconduct within 12 months treated as serious.
- **Employer non-payment** → agent attempts resolution within 24 hours → if unresolved, contract terms govern → legal escalation option flagged to CEO.
- **Platform/contract dispute** not resolved at handler level → CEO reviews within 5 working days → binding decision issued.

### 9.5 Complaint Dashboard (Agent View)

The complaints dashboard shows all open cases with: case reference, category, complainant, subject, assigned handler, urgency, submission date, SLA deadline (colour-coded: Green = on track, Amber = approaching, Red = overdue), and current stage. Filterable by status, urgency, category, handler, and date range.

---

## 10. Pipeline-Specific Requirements

### 10.1 Diaspora Caregiving Pipeline

#### Care Needs Assessment

When a diaspora family account is created and verified, the account manager sends them a Care Needs Assessment form. Fields:

- Care recipient: name, age, gender, relationship to employer
- Medical conditions and mobility status
- Medication management requirements (Y/N, list)
- Specialist care needs: post-surgical / dementia / palliative / other
- Language preference (Yoruba / Igbo / Hausa / English / other)
- Cultural or dietary requirements
- Accommodation: live-in or live-out
- Hours per day / days per week
- Location of care recipient (address, LGA, state)
- Urgency (Immediate — within 2 weeks / Planned — within 1 month / Future)
- Budget indication (optional)

#### Cross-Border Payment Integration

- Diaspora employers pay in GBP or USD via Stripe (card or bank transfer to Oakvale UK account).
- Oakvale pays worker in NGN (managed internally — not automated via platform at launch).
- Invoice generation: Oakvale UK issues invoice to employer in GBP/USD. Payment confirmation triggers placement workflow.
- Payment status tracked in employer dashboard: Invoice Issued / Payment Received / Overdue.

#### Monthly Welfare Report Auto-Generation

After each welfare check log entry, the system generates a formatted PDF welfare report and emails it to the diaspora family's registered email address. The report template (managed in Admin Console) includes: worker name and role, care recipient wellbeing status, attendance confirmation, any issues and actions taken, and the account manager's contact details.

### 10.2 Corporate Crèche Pipeline

#### Corporate Onboarding Form

On account approval, HR contact completes a Workforce Requirements form in the employer portal. Fields (from Proforma Section 2C, plus):

- Number of crèche staff required
- Age range of children served (0–12 months / 1–3 years / 3–5 years — multiple select)
- Hours of operation
- Specific skills required: SEND awareness / Montessori methods / infant first aid / other
- Existing staff to be upskilled via training-to-hire pathway (number, names)
- Budget parameters (optional)

#### Employer Dashboard — CPD Status View

The corporate employer dashboard shows a live CPD status panel for all placed workers: worker name, role, last CPD completion date, next due date, current status (Current / Due / Overdue). HR can download a CPD compliance report as PDF for their records.

#### Training-to-Hire Pathway

- Corporate employer selects 'Enrol existing staff' from the employer dashboard.
- HR enters existing staff names and contact details.
- Oakvale agent creates worker accounts and triggers LMS enrolment (3-worker minimum, 15% bulk discount applied automatically).
- Workers complete programme. On graduation, their existing employer account is linked to their new Oakvale-verified profile.
- Employer receives notification of certifications and worker profiles are updated with new badge.

#### NGN Payment Integration

- Corporate employers pay in NGN via Paystack or Flutterwave.
- Invoices issued on 30-day net terms (standard corporate procurement).
- Annual subscription invoiced at partnership start. Placement fees invoiced per placement.
- CPD refresh fees invoiced annually per placed worker.

---

## 11. Notifications & Communications

### 11.1 Notification Channels

| Channel | Used For | Primary Audience |
| --- | --- | --- |
| SMS (via Termii or similar Nigeria-capable gateway) | OTP verification, placement confirmations, interview notifications, urgent alerts, CPD reminders | Workers (Nigeria-based), diaspora families (international) |
| Email | Contract delivery, welfare reports, invoices, account verification, newsletter | All users |
| In-App Notifications (push + in-app bell) | New job matches, shortlist additions, messages, offer received, complaint status update | All users |
| WhatsApp (manual, via agent — not automated at launch) | Diaspora family welfare updates, urgent escalations, account manager relationship comms | Diaspora families, key employer contacts |

### 11.2 Notification Templates

All notification content is managed via a template library in the Admin Console. Templates support variable substitution (e.g. `{{worker.first_name}}`, `{{placement.start_date}}`). Platform Admin can edit templates without code deployment. English and Hausa versions required at launch for worker-facing templates.

---

## 12. Agent & Admin Dashboards

### 12.1 Agent Dashboard

The agent dashboard is the operational nerve centre for Oakvale staff. It surfaces:

- **My Tasks:** list of pending actions with due dates (verification reviews, welfare checks due, complaint cases open, contract reviews pending).
- **My Employer Accounts:** list of assigned employer accounts with last activity date and open placement count.
- **My Placements:** all active placements in my portfolio, with CPD status and welfare check due date.
- **Inbox:** platform messages from workers and employers in my portfolio.
- **Notifications:** all system alerts relevant to my role.

#### Key Agent Actions

- Verify or reject identity documents (with comments)
- Approve or request revision on job posts
- Generate and send shortlists
- Log welfare check outcomes
- Trigger background check requests
- Initiate or approve contract generation
- Open, investigate, and resolve complaint cases
- Enrol workers into LMS programmes (training-to-hire)
- Generate reports: placement summary, CPD compliance, revenue, complaint resolution time

### 12.2 Admin Console

Platform Admin has full access plus configuration tools:

- Workforce category management (add, edit, deactivate)
- Employer type management (add, edit, configure)
- Contract template library (create, edit, version)
- Notification template library (create, edit, language versions)
- User management (all roles — create, edit, suspend, delete)
- Pricing configuration (subscription tiers, placement fees, bulk discounts)
- Payment gateway configuration (Stripe, Paystack, Flutterwave)
- Background check integration settings (Sterling BackCheck)
- LMS integration settings (certificate validation endpoint)
- Audit log viewer (all system actions, filterable)
- Platform analytics: registration pipeline, placement rates, revenue, complaint volumes, CPD compliance rates

---

## 13. Technical Requirements

### 13.1 Architecture

| Component | Requirement |
| --- | --- |
| Frontend — Worker Portal | Progressive Web App (PWA). React or Next.js. Mobile-first. Offline form capability. Must work on Android 8+ with Chrome browser. |
| Frontend — Employer Portal | Desktop-primary React/Next.js application. Responsive for tablet and mobile. No PWA requirement. |
| Frontend — Agent & Admin Dashboards | Desktop React/Next.js. Data-dense UI with sortable tables, filterable lists, and dashboard components. |
| Backend API | REST API (Node.js/Express or Python/Django/FastAPI). All data operations via API — no direct database calls from frontend. JWT authentication with role-based access middleware. |
| Database | PostgreSQL. All employer types, workforce categories, contract templates, and notification templates stored as configurable data (not hardcoded). Soft deletes on all records. |
| File Storage | AWS S3 or equivalent. All uploaded documents (IDs, certificates, contracts) stored with access-controlled signed URLs. Automatic compression on upload for images and PDFs. |
| Authentication | Phone number + OTP (primary for workers). Email + password (employers and agents). Two-factor authentication option for agents and admin. Sessions managed via JWT with refresh tokens. |
| Notifications | Termii or Africa's Talking for SMS (Nigeria). SendGrid or similar for email. Firebase or OneSignal for push notifications. |
| Payments | Stripe for GBP/USD (diaspora employers). Paystack or Flutterwave for NGN (corporate employers). Webhooks for payment status updates. Invoice generation via PDF template. |
| Background Checks | Sterling BackCheck Nigeria API integration. Webhook to update worker background check status on result. |
| LMS Integration | REST API call to Oakvale LMS to validate certificate number and retrieve programme name, completion date, and CPD hours. Real-time validation on worker profile. |
| Contract Signing | PDF generation from template (jsPDF, Puppeteer, or equivalent). Signing recorded as authenticated user action + timestamp. Signed PDF stored and linked to placement record. |
| Search | Elasticsearch or PostgreSQL full-text search for worker pool search. Faceted filtering with real-time results. |

### 13.2 Security Requirements

- All data in transit: TLS 1.2+ (HTTPS everywhere).
- All data at rest: AES-256 encryption for sensitive fields (ID numbers, payment data).
- Role-based access control enforced at API level — no UI-only access restrictions.
- Personal contact details of workers masked in all employer-facing API responses until contract is signed.
- Full audit log for all data access and modification events.
- NDPA 2023 compliance: consent captured at registration, data processing logs maintained, right-to-erasure workflow available (soft delete + anonymisation).
- GDPR-aware design for UK-facing interfaces: separate data processing lawful basis for diaspora employer data.
- Regular security scanning: OWASP top 10 checks on all API endpoints before launch.

### 13.3 Hosting & Infrastructure

- Cloud hosting: AWS, GCP, or Azure. Nigeria-region or South Africa region preferred for worker and employer data.
- CDN: CloudFront or Cloudflare for static assets and file delivery (improves performance for Nigerian users).
- Uptime target: 99.5% monthly.
- Backup: daily database backups with 30-day retention.
- Environment separation: development, staging, production. No production data in development or staging.

### 13.4 Performance Targets

| Metric | Target |
| --- | --- |
| Worker portal page load (3G mobile Nigeria) | < 3 seconds for first contentful paint |
| Employer portal page load (desktop broadband) | < 1.5 seconds for first contentful paint |
| Worker search results | < 2 seconds for filtered results return |
| Document upload (5MB PDF on 3G) | < 30 seconds with progress indicator |
| Contract PDF generation | < 10 seconds |
| SMS notification delivery | < 60 seconds from trigger |

---

## 14. MVP Scope (July 2026 Launch) & Post-Launch Roadmap

### 14.1 MVP — In Scope

> **MVP Launch Target: July 2026** — The MVP must be fully functional for the two launch pipelines. All workflows described in this brief must work end-to-end for Diaspora Caregiving and Corporate Crèche employer types, and for Certified Caregiver and Certified Childcare Worker workforce categories.

#### Worker Portal

- Registration and profile creation (all sections)
- Identity document upload and verification workflow
- Background check consent and status display
- Oakvale certificate validation and badge display
- Job listing browsing (filtered search)
- Application submission
- In-platform messaging
- Offer receipt and acceptance
- Contract viewing and digital signing
- Placement dashboard (active placement, welfare check notifications, CPD status)
- Complaint submission

#### Employer Portal

- Diaspora family and corporate employer registration flows
- Care Needs Assessment (diaspora) and Workforce Requirements form (corporate)
- Worker search and filtering
- Shortlist management
- Interview request workflow
- Offer submission
- Contract viewing and digital signing
- Placement dashboard
- CPD status dashboard (corporate)
- Invoice and payment status view
- Complaint submission

#### Agent Dashboard

- All core agent actions listed in Section 12.1
- Matching tool (manual shortlist generation)
- Welfare check logging and report generation
- Complaint case management
- Basic reporting: placements, revenue, CPD compliance

#### Admin Console

- User management
- Workforce category and employer type configuration
- Contract template management
- Notification template management
- Pricing configuration
- Payment gateway configuration
- Audit log viewer

### 14.2 Post-Launch Roadmap

| Phase | Feature / Enhancement | Target |
| --- | --- | --- |
| Phase 2 (Q4 2026) | Add Care Coordinator, Community Health Worker, Hospital Administrator workforce categories | October 2026 |
| Phase 2 (Q4 2026) | Add Hospital / Clinic, NGO, Private Household employer types | October 2026 |
| Phase 2 (Q4 2026) | Automated matching score algorithm (ranking tool replaces manual shortlisting) | November 2026 |
| Phase 2 (Q4 2026) | WhatsApp Business API integration for automated diaspora welfare report delivery | November 2026 |
| Phase 3 (Q1 2027) | Worker ratings and reviews (employer rates worker post-placement) | January 2027 |
| Phase 3 (Q1 2027) | UK Care Agency partner portal (wholesale supply model) | February 2027 |
| Phase 3 (Q1 2027) | Medical Billing Specialist, Pharmacy Assistant, Mental Health Support Worker categories | February 2027 |
| Phase 3 (Q1 2027) | Advanced analytics dashboard (pipeline funnel, time-to-placement, placement success rate) | March 2027 |
| Phase 4 (Q2 2027) | Payroll management module (Oakvale manages worker salary payments from employer funds) | April 2027 |
| Phase 4 (Q2 2027) | In-app CPD module enrolment (worker enrols in CPD refresh directly from placement dashboard) | May 2027 |
| Phase 4 (Q2 2027) | Multilingual support: Yoruba and Igbo additions to worker portal | June 2027 |

---

## 15. Integrations Summary

| System | Purpose | Direction | Priority |
| --- | --- | --- | --- |
| Oakvale LMS | Certificate number validation, CPD hours retrieval, training-to-hire enrolment trigger | Bidirectional | MVP |
| Sterling BackCheck Nigeria | Background check request submission and result webhook | Bidirectional | MVP |
| Stripe | GBP/USD payment processing for diaspora employers | Inbound (payments to Oakvale UK) | MVP |
| Paystack / Flutterwave | NGN payment processing for corporate employers | Inbound (payments to Oakvale Nigeria) | MVP |
| Termii / Africa's Talking | SMS notifications and OTP (Nigeria-optimised gateway) | Outbound | MVP |
| SendGrid / Mailgun | Transactional email delivery | Outbound | MVP |
| Firebase / OneSignal | Push notifications (mobile PWA) | Outbound | MVP |
| AWS S3 / equivalent | Document and file storage (IDs, certificates, contracts) | Bidirectional | MVP |
| WhatsApp Business API | Automated welfare report delivery to diaspora families | Outbound | Phase 2 |
| DocuSign or equivalent | Qualified e-signature if legally required | Bidirectional | Future |

---

## 16. Open Questions for Oakvale Team

| # | Question | Owner | Priority |
| --- | --- | --- | --- |
| 1 | What is the exact API endpoint and authentication method for the Oakvale LMS certificate validation check? | Tech / LMS team | MVP |
| 2 | Is the digital signing model (authenticated checkbox + timestamp) legally sufficient for the Worker Placement Agreement and Employer Service Agreement under Nigerian law? Or is a qualified e-signature solution required? | Legal / CEO | MVP |
| 3 | Which SMS gateway should be used — Termii or Africa's Talking? (Compare pricing and Nigeria delivery rates for bulk SMS.) | Tech / Ops | MVP |
| 4 | What are the exact contract templates (Worker Placement Agreement, Employer Service Agreement, Annual Partnership Agreement) to be loaded into the contract template library? These must be provided by the Oakvale legal team. | Legal / CEO | MVP |
| 5 | What is the minimum profile completion threshold (%) before a worker is searchable? Suggested: 70%, with mandatory fields: personal info, identity document uploaded, Oakvale certificate number, at least one skills entry. | Oakvale Ops | MVP |
| 6 | For Stripe integration: is there already an Oakvale UK Stripe account? What is the fee-split model between Oakvale UK and Oakvale Nigeria entities for diaspora payments? | Finance / CEO | MVP |
| 7 | For the initial matching algorithm (Phase 2): what weighting should be applied to: certification match / location / skills / availability / previous ratings? | Ops / Tech | Phase 2 |
| 8 | What is the data residency requirement for worker personal data and UK diaspora employer data? (EU/UK GDPR considerations for UK employer data.) | Legal / DPO | MVP |
| 9 | Are there any existing design assets (logos, icons, Figma files) beyond the brand guidelines PDF that should be provided to the developer? | Marketing | MVP |
| 10 | Who is the designated Data Protection Officer (DPO) for NDPA 2023 compliance purposes, and what is the escalation contact for data privacy complaints? | CEO / Legal | MVP |

---

## 17. Delivery & Handover

### 17.1 Developer Deliverables

- Fully functional web application deployed to staging environment (minimum 4 weeks before launch target).
- All MVP features listed in Section 14.1 working end-to-end, tested across Chrome (desktop and Android mobile), Firefox, and Safari.
- API documentation (Swagger / OpenAPI spec) for all endpoints.
- Database schema documentation.
- Integration setup documentation for all third-party services (Stripe, Paystack, Termii, Sterling BackCheck, LMS).
- Admin Console populated with: initial workforce categories (2 launch types), initial employer types (2 launch types), contract template placeholders (ready for legal team to fill), notification templates in English.
- Source code in agreed version control repository with clear README and deployment instructions.
- Security checklist completed (OWASP top 10 review, SSL configured, API authentication tested).

### 17.2 UAT (User Acceptance Testing)

Oakvale will conduct UAT on the staging environment across the following test scenarios (at minimum):

- **Worker registration:** complete profile creation on Android mobile (3G simulation), including document upload, certificate validation, and background check consent.
- **Employer registration:** diaspora family and corporate employer, including verification workflow.
- **End-to-end placement:** job post → agent review → worker search → shortlist → interview request → offer → contract signing → placement activation.
- **Welfare check:** agent logs check → welfare report generated → sent to diaspora employer email.
- **Complaint:** worker raises complaint → agent triages → investigation logged → resolution communicated.
- **Training-to-hire:** corporate employer enrols existing staff → LMS trigger → graduation → profile updated.
- **Replacement:** employer raises replacement request (within 90 days) → agent shortlists → new placement created.

### 17.3 Launch Support

Developer to be available for a minimum of 4 weeks post-launch for:

- Bug fixes (critical: same-day; high: within 48 hours; standard: within 5 working days).
- Agent and admin onboarding support (Q&A session and walk-through of Admin Console and Agent Dashboard).
- Performance monitoring and optimisation based on real-world usage in the first 30 days.

---

*Oakvale Learning Ltd · jobs.oakvaleltd.com · Confidential*

*Version 1.0 · May 2026*


<!-- http://localhost:3001/employer/onboarding while onboarding sync my forms data with other sections of the form. Like after selecting "elderly care" in my sector selection is till see "creche" in another form's description - workforce assessment -->