import { NIGERIAN_STATES } from './worker.js';

// Legacy pipeline discriminator. `OTHER` covers admin-created employer types whose
// behaviour is driven by the configurable `employer_types` entity (§5); the real
// type lives in `employers.employer_type_id`. Kept NOT NULL until Phase 5 drops it.
export const EMPLOYER_TYPES = ['INDIVIDUAL_EMPLOYER', 'CORPORATE', 'OTHER'] as const;
export type EmployerType = (typeof EMPLOYER_TYPES)[number];

/** The two pipelines with bespoke (non-config) workflows. */
export const LEGACY_EMPLOYER_TYPES = ['INDIVIDUAL_EMPLOYER', 'CORPORATE'] as const;
export type LegacyEmployerType = (typeof LEGACY_EMPLOYER_TYPES)[number];

export const MOBILITY_LEVELS = ['INDEPENDENT', 'ASSISTED', 'BEDBOUND'] as const;
export type MobilityLevel = (typeof MOBILITY_LEVELS)[number];

export const ACCOMMODATION_TYPES = ['LIVE_IN', 'LIVE_OUT', 'FLEXIBLE'] as const;
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

export const URGENCY_LEVELS = ['STANDARD', 'URGENT', 'IMMEDIATE'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const JOB_POSTING_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'OPEN', 'FILLED', 'CLOSED'] as const;
export type JobPostingStatus = (typeof JOB_POSTING_STATUSES)[number];

export const JOB_APPLICATION_STATUSES = ['APPLIED', 'REVIEWED', 'PROGRESSED', 'REJECTED'] as const;
export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

export const JOB_PRIORITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type JobPriorityLevel = (typeof JOB_PRIORITY_LEVELS)[number];

// §6.3 — Public is searchable by all workers; Restricted is hidden from public
// browse and instead notifies matched workers.
export const JOB_VISIBILITY = ['PUBLIC', 'RESTRICTED'] as const;
export type JobVisibility = (typeof JOB_VISIBILITY)[number];

// §6.3 — a job posting is anchored to a country, which drives the work-location options.
export const JOB_COUNTRIES = ['NIGERIA', 'UK'] as const;
export type JobCountry = (typeof JOB_COUNTRIES)[number];
export const JOB_COUNTRY_LABELS: Record<JobCountry, string> = {
  NIGERIA: 'Nigeria',
  UK: 'United Kingdom',
};

// §6.3 — salary range is denominated in the selected currency, which drives the band options.
export const JOB_SALARY_CURRENCIES = ['NGN', 'USD'] as const;
export type JobSalaryCurrency = (typeof JOB_SALARY_CURRENCIES)[number];
export const JOB_SALARY_CURRENCY_LABELS: Record<JobSalaryCurrency, string> = {
  NGN: 'Naira (₦)',
  USD: 'Dollar ($)',
};

// Common working-time patterns offered for a job's schedule. Stored as the label string.
export const JOB_SCHEDULES = [
  'Full-time, weekdays',
  'Full-time, includes weekends',
  'Part-time',
  'Shift work',
  'Live-in (rota)',
  'Weekends only',
  'Flexible / negotiable',
] as const;

// §5 — care specialisations a job may require, grouped into categories for the
// posting form. Employers tick the applicable tasks (optional, multi-select) and
// workers see them when browsing/applying. Stored as an array of label strings on
// the posting (like `benefits`).
export const CARE_SPECIALISATION_GROUPS = [
  {
    category: 'Personal Care',
    options: ['Bathing / hygiene', 'Dressing', 'Mobility / transfer assistance', 'Toileting'],
  },
  {
    category: 'Specialized Care',
    options: [
      'Dementia / Alzheimer’s care',
      'Diabetic care',
      'Post-surgical / rehab',
      'Parkinson’s',
      'Hospice support',
    ],
  },
  {
    category: 'Companionship & Daily Living',
    options: ['Companionship', 'Light housekeeping', 'Meal preparation', 'Transportation / errands'],
  },
  {
    category: 'Health Monitoring',
    options: ['Medication reminders', 'Vital sign monitoring', 'Coordination with doctors / nurses'],
  },
] as const;

// Flat list of every valid specialisation label, for validation.
export const CARE_SPECIALISATIONS = CARE_SPECIALISATION_GROUPS.flatMap(
  (g) => g.options,
) as readonly string[];
export type CareSpecialisation = (typeof CARE_SPECIALISATION_GROUPS)[number]['options'][number];

// Major UK cities offered when a job's country is the United Kingdom.
export const UK_CITIES = [
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Glasgow',
  'Edinburgh', 'Bristol', 'Sheffield', 'Newcastle', 'Nottingham', 'Cardiff',
  'Belfast', 'Leicester', 'Coventry', 'Reading',
] as const;

// Monthly salary bands per currency. Stored as the label string on the posting.
export const NGN_SALARY_BANDS = [
  'Below ₦100,000', '₦100,000 – ₦150,000', '₦150,000 – ₦250,000',
  '₦250,000 – ₦400,000', '₦400,000 – ₦600,000', 'Above ₦600,000',
] as const;
export const USD_SALARY_BANDS = [
  'Below $500', '$500 – $1,000', '$1,000 – $2,000',
  '$2,000 – $3,500', '$3,500 – $5,000', 'Above $5,000',
] as const;

/** Work-location options for a job's country: Nigerian states or UK cities. */
export function locationOptionsForCountry(country: JobCountry): readonly string[] {
  return country === 'UK' ? UK_CITIES : NIGERIAN_STATES;
}

/** Salary band options for a job's currency. */
export function salaryBandsForCurrency(currency: JobSalaryCurrency): readonly string[] {
  return currency === 'USD' ? USD_SALARY_BANDS : NGN_SALARY_BANDS;
}

// §6.2 — employer registration is agent-verified before portal access is granted.
export const EMPLOYER_VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type EmployerVerificationStatus = (typeof EMPLOYER_VERIFICATION_STATUSES)[number];

// §6.2 — documents an employer uploads for verification (individual employer: residence + ID; corporate: CAC).
export const EMPLOYER_DOCUMENT_CATEGORIES = [
  'PROOF_OF_RESIDENCE',
  'EMPLOYER_ID',
  'CAC_CERTIFICATE',
] as const;
export type EmployerDocumentCategory = (typeof EMPLOYER_DOCUMENT_CATEGORIES)[number];

export const EMPLOYER_ACCEPTED_MIMES_BY_CATEGORY: Record<EmployerDocumentCategory, readonly string[]> = {
  PROOF_OF_RESIDENCE: ['application/pdf', 'image/jpeg', 'image/png'],
  EMPLOYER_ID: ['application/pdf', 'image/jpeg', 'image/png'],
  CAC_CERTIFICATE: ['application/pdf', 'image/jpeg', 'image/png'],
};
