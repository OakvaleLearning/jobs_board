# Jobs Board — Update Brief (from Review Meeting, 2026-07-02)

> Feed this file to the Claude Code agent as the task brief for the next iteration of the Oakvale Jobs Board. Source: client review call with Oakvale team (Emmanuella Arikpo, Caleb Adejoh, Sitasri De, QA rep) + K Digital marketing (Seamas Vincent).

## Context

The jobs board connects three user types — care workers, individual employers, and organizational employers — with an admin approval layer gating visibility at every step (employer verification, worker profile approval, certification checks, job post approval). This update addresses UI/branding feedback and finalizes several open logic questions from the demo.

---

## 1. Design & Branding — Landing / Signup Pages

**Problem raised:** Current landing page reads as a generic company site, not a jobs-focused portal. Too much whitespace on the sides, background is flat/uninviting, illustrations show Caucasian doctors instead of Nigerian caregivers (mismatched with the "Nigeria's first credentialed..." copy).

**Tasks:**
- [ ] Replace the current hero layout with a full-bleed background image relevant to caregiving/job-seeking (e.g., a caregiver at work, someone applying on a laptop) — not a side-aligned image in whitespace.
- [ ] Redistribute hero text across the full width instead of confining it to one side; make CTAs ("Find Care Work", "Hire Trusted Staff") visually prominent, not buried.
- [ ] Remove placeholder illustrations of non-Nigerian, non-caregiver figures.
- [ ] Swap current blue color scheme back to **primary Oakvale green and gold** across landing + signup pages.
- [ ] Replace stock/placeholder imagery with **real photos of actual Oakvale caregivers** (marketing team to supply assets) — apply to both landing and signup pages.
- [ ] General UI polish pass per Caleb's forthcoming consolidated feedback doc (see Open Items below).

---

## 2. Referral Tracking (Affiliate System)

**Decision:** Use a dropdown, not a free-entry code field.

**Logic:**
- [ ] Add a field: **"How did you hear about the jobs board?"** — dropdown, shown at signup for both employer and worker flows.
- [ ] Dropdown options: social media, personal referral, [other channels TBD], "Other/None."
- [ ] When **"Personal Referral"** is selected → dynamically reveal a **name input field** for the referrer's name (not a numeric/alphanumeric code — team decided names are more memorable for users than codes).
- [ ] Field should be conditionally rendered (hidden by default, appears on selection) — not a static always-visible field.
- [ ] This applies to the jobs board signup; note the same referral logic is expected on the course registration flow (separate product, mentioned for consistency — confirm scope with Victor if that's in this repo).

---

## 3. Certification Verification (Oakvale/CPD Certificates)

**Decision:** Certificates do not reliably have a number (only a CPD UK member ID + QR code); do not require a certificate number field.

**Tasks:**
- [ ] Make the **certificate number field optional** (currently required) on the CPD/compliance section of the worker profile.
- [ ] Certificate **file upload remains required** — this is the actual verification artifact.
- [ ] Build an **admin cross-check workflow**: when a worker uploads a certificate, their submission (name, email, phone, cert details) should be captured in a queryable list.
- [ ] Add an **export-to-CSV** feature for admins to pull all pending certificate submissions in bulk, so they can cross-reference against Oakvale's internal list of certified students rather than checking one-by-one.
- [ ] Until an uploaded certificate is admin-approved, the worker should remain blocked from applying to jobs (this gate already exists per the demo — just confirm it still applies once "optional number" logic ships).

---

## 4. Caregiver Specialization — Remove from Worker Profile

**Decision:** Do NOT add a specialization/skills selector to the **caregiver** profile. Oakvale's training curriculum has no specialty tracks yet (all caregivers trained in general caregiving, covering both elderly care and early years/child care as the two MVP categories). Adding fake specialty selection would mislead employers.

**Tasks:**
- [ ] Remove/do not implement any "skills & specialization" multi-select on the caregiver profile (e.g., dementia care, meal prep ratings, etc. shown in the demo were placeholders — confirm these are stripped out or clearly out of scope).
- [ ] Do not build a free-text field for specialties either (team explicitly rejected free text due to literacy concerns among users).

---

## 5. Employer-Side Specialization — Add to Job Posting

**Decision:** Specialization belongs on the **employer/job posting side**, not the caregiver side. Employers should be able to specify what type of care they need.

**Tasks:**
- [ ] Add a **required-care-type field** to the job posting creation flow — a dropdown or multi-select (implementation detail: single or multi depending on eventual list) so employers can specify what they're hiring for (e.g., elderly/geriatric-type needs vs. child care, and finer sub-needs as the list is provided).
- [ ] This list of care types/skills is pending from Oakvale (see Open Items) — build the field to accept a configurable list rather than hardcoding values, since the list isn't finalized.
- [ ] Purpose: lets caregivers self-select into relevant job posts based on what's advertised, without caregivers having falsely claimed specialties.

---

## 6. Other Confirmed Behaviors (No Change Needed, Just Confirming Scope)

These were walked through in the demo and appear to already work as intended — no action needed unless a bug is found:
- Three user roles (care worker, individual employer, organization/corporate employer) with role selection at signup.
- Organization signup requires CAC (Corporate Affairs Commission) document upload for verification; admin approves before employer can post jobs.
- Worker profile requires: personal details, ID (NIN/passport/voters card/driver's license), selfie, proof of address, background check docs (police report, guarantor letter, affidavit of good conduct), education history, professional experience, job preferences (elderly care / child care only for MVP), salary expectations (NGN/GBP/USD), skills, personal statement, optional video intro.
- Worker cannot apply to jobs until: (a) admin approves profile, AND (b) certification is uploaded and approved — both gates must clear independently.
- Job posts can be **public** (visible to all workers) or **restricted** (admin-driven automated matching/shortlisting instead of open visibility).
- Admin dashboard handles: employer verification, worker profile approval, certificate cross-check, job post approval/revision requests.
- Email + in-app (bell icon) notifications alert admins when action is needed (new signups, pending compliance checks, etc.) — already wired to existing Resend integration.

---

## 7. Known Bug

- [ ] **Fix application flow bug**: during the live demo, applying to a job as an already-approved/certified worker surfaced a "something is missing" error at the final application step. Needs investigation — reproduce with an approved worker + public job post and check the apply endpoint/form validation.

---

## 8. Infrastructure

- [ ] Provision a **VPS** and host the current build there (target: within the week) so the client team can test against a live link instead of relying on localhost/screen-share demos. Push updates to this environment as iterations land so stakeholders can review async.

---

## Open Items — Waiting on Client Input (do not block on these, but flag if hit)

- **List of care skills/specializations** for the employer-side job posting field — QA/Oakvale team to compile and send to Victor.
- **Consolidated UI/UX feedback document** — Caleb (K Digital) to compile all interface suggestions from the marketing side and send over separately.
- Final list of referral-dropdown entries (which pharmacies/affiliate partners appear in the "personal referral" context, if any pre-population is wanted) — currently resolved as free-text name entry, so this may be moot, but confirm before finalizing UI copy.

---

## Priority Order (as assigned in meeting, all to Victor unless noted)

1. Landing page redesign (spacing, background, real imagery)
2. Graphics/illustration replacement (Nigerian context)
3. Referral dropdown + conditional name field
4. Oakvale brand colors (green/gold) + real caregiver photos across landing/signup
5. Certification verification admin workflow + CSV export
6. Fix job application bug
7. Remove caregiver specialization field / add employer care-type field (pending skills list)
8. VPS provisioning and hosting
