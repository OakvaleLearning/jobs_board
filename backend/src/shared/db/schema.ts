import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  index,
  integer,
  jsonb,
  date,
  numeric,
  bigint,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { ROLES } from '@oakvale/shared/roles.js';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUS,
  EMPLOYMENT_TYPES,
  GENDERS,
  ID_TYPES,
  REFERENCE_TYPES,
  SKILL_KINDS,
  VISIBILITY_STATUS,
  WAGE_STRUCTURES,
} from '@oakvale/shared/enums/worker.js';
import {
  BACKGROUND_CHECK_STATUSES,
  CERT_TYPES,
  CPD_ENROLMENT_STATUSES,
  FLAG_SEVERITIES,
  FLAG_TYPES,
  VERIFICATION_REQUEST_TYPES,
  VERIFICATION_STATUSES,
} from '@oakvale/shared/enums/verification.js';
import { PAYROLL_RUN_STATUSES, WORKER_PAYOUT_STATUSES } from '@oakvale/shared/enums/payroll.js';
import {
  ACCOMMODATION_TYPES,
  EMPLOYER_DOCUMENT_CATEGORIES,
  EMPLOYER_VERIFICATION_STATUSES,
  JOB_APPLICATION_STATUSES,
  JOB_COUNTRIES,
  JOB_POSTING_STATUSES,
  JOB_PRIORITY_LEVELS,
  JOB_SALARY_CURRENCIES,
  JOB_VISIBILITY,
  MOBILITY_LEVELS,
  URGENCY_LEVELS,
} from '@oakvale/shared/enums/employer.js';
import {
  INTERVIEW_FORMATS,
  INTERVIEW_OUTCOMES,
  INTERVIEW_STATUSES,
} from '@oakvale/shared/enums/interview.js';
import {
  PIPELINE_TYPES,
  PLACEMENT_STATUSES,
  REPLACEMENT_REQUEST_STATUSES,
  WELLBEING_LEVELS,
} from '@oakvale/shared/enums/placement.js';
import {
  INVOICE_PURPOSES,
  INVOICE_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
} from '@oakvale/shared/enums/payment.js';
import { AGENT_SPECIALTIES, ASSIGNMENT_ROLES } from '@oakvale/shared/enums/admin.js';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
} from '@oakvale/shared/enums/notifications.js';
import {
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  SIGNATURE_METHODS,
  SIGNATURE_PARTIES,
} from '@oakvale/shared/enums/contracts.js';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_EVENT_KINDS,
  COMPLAINT_OUTCOMES,
  COMPLAINT_STATUSES,
  COMPLAINT_URGENCIES,
} from '@oakvale/shared/enums/complaints.js';
import {
  OFFER_ACCOMMODATION_TYPES,
  OFFER_CURRENCIES,
  OFFER_STATUSES,
} from '@oakvale/shared/enums/offer.js';
import { CONVERSATION_STATUSES } from '@oakvale/shared/enums/messaging.js';

export const roleEnum = pgEnum('role', ROLES);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    phone: text('phone'),
    role: roleEnum('role').notNull(),
    fullName: text('full_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    // Referral attribution captured at signup (brief §2). `referralSource` is a
    // fixed dropdown value; `referrerName` is only set when source = PERSONAL_REFERRAL.
    referralSource: text('referral_source'),
    referrerName: text('referrer_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    roleIdx: index('users_role_idx').on(t.role),
    referralSourceIdx: index('users_referral_source_idx').on(t.referralSource),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

/**
 * NDPA §13.2 consent capture at registration (§6.1 Step 1). One row per consent
 * type given by a user (TERMS / PRIVACY / BACKGROUND_CHECK), versioned + IP-stamped
 * for audit. Distinct from the profile-completion background consent in Section C.
 */
export const userConsents = pgTable(
  'user_consents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    consentType: text('consent_type').notNull(),
    version: text('version').notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTypeIdx: index('user_consents_user_type_idx').on(t.userId, t.consentType),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type UserConsent = typeof userConsents.$inferSelect;

/* ----------------------------- workers domain ---------------------------- */

export const visibilityStatusEnum = pgEnum('visibility_status', VISIBILITY_STATUS);
export const idTypeEnum = pgEnum('id_type', ID_TYPES);
export const genderEnum = pgEnum('gender', GENDERS);
export const employmentTypeEnum = pgEnum('employment_type', EMPLOYMENT_TYPES);
export const wageStructureEnum = pgEnum('wage_structure', WAGE_STRUCTURES);
export const referenceTypeEnum = pgEnum('reference_type', REFERENCE_TYPES);
export const skillKindEnum = pgEnum('skill_kind', SKILL_KINDS);
export const documentCategoryEnum = pgEnum('document_category', DOCUMENT_CATEGORIES);
export const documentStatusEnum = pgEnum('document_status', DOCUMENT_STATUS);
export const docVerificationStatusEnum = pgEnum('doc_verification_status', [
  'PENDING',
  'IN_REVIEW',
  'VERIFIED',
  'REJECTED',
]);
export const cpdEnrolmentStatusEnum = pgEnum('cpd_enrolment_status', CPD_ENROLMENT_STATUSES);
export const payrollRunStatusEnum = pgEnum('payroll_run_status', PAYROLL_RUN_STATUSES);
export const workerPayoutStatusEnum = pgEnum('worker_payout_status', WORKER_PAYOUT_STATUSES);

export const workers = pgTable(
  'workers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    profileCompletionPct: integer('profile_completion_pct').notNull().default(0),
    cpdTotalHours: integer('cpd_total_hours').notNull().default(0),
    experienceTotalMonths: integer('experience_total_months').notNull().default(0),
    visibilityStatus: visibilityStatusEnum('visibility_status').notNull().default('DRAFT'),
    workforceCategoryId: uuid('workforce_category_id').references(() => workforceCategories.id, {
      onDelete: 'set null',
    }),
    oakvaleAgentId: uuid('oakvale_agent_id').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    preEditSnapshot: jsonb('pre_edit_snapshot'),
    editRequestedAt: timestamp('edit_requested_at', { withTimezone: true }),
    notes: text('notes'),
    flags: jsonb('flags').notNull().default('[]'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    visIdx: index('workers_visibility_idx').on(t.visibilityStatus),
    categoryIdx: index('workers_category_idx').on(t.workforceCategoryId),
    pctIdx: index('workers_pct_idx').on(t.profileCompletionPct),
    agentIdx: index('workers_agent_idx').on(t.oakvaleAgentId),
    cpdIdx: index('workers_cpd_hours_idx').on(t.cpdTotalHours),
    expIdx: index('workers_experience_months_idx').on(t.experienceTotalMonths),
  }),
);

export const workerPersonalInfo = pgTable('worker_personal_info', {
  workerId: uuid('worker_id')
    .primaryKey()
    .references(() => workers.id, { onDelete: 'cascade' }),
  fullName: text('full_name'),
  dob: date('dob'),
  gender: genderEnum('gender'),
  nationality: text('nationality'),
  stateOfOrigin: text('state_of_origin'),
  lga: text('lga'),
  address: text('address'),
  phone: text('phone'),
  emergencyContact: jsonb('emergency_contact'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workerIdentityDocs = pgTable('worker_identity_docs', {
  workerId: uuid('worker_id')
    .primaryKey()
    .references(() => workers.id, { onDelete: 'cascade' }),
  idType: idTypeEnum('id_type'),
  idNumber: text('id_number'),
  idIssueDate: date('id_issue_date'),
  idExpiryDate: date('id_expiry_date'),
  idDocumentId: uuid('id_document_id'),
  selfieId: uuid('selfie_id'),
  proofOfAddressId: uuid('proof_of_address_id'),
  verificationStatus: docVerificationStatusEnum('verification_status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workerBackgroundConsent = pgTable('worker_background_consent', {
  workerId: uuid('worker_id')
    .primaryKey()
    .references(() => workers.id, { onDelete: 'cascade' }),
  consentGiven: boolean('consent_given').notNull().default(false),
  consentedAt: timestamp('consented_at', { withTimezone: true }),
  // Background-check documents (admin-reviewed; references into worker_documents).
  policeCertificateDocumentId: uuid('police_certificate_document_id'),
  guarantorLetterDocumentId: uuid('guarantor_letter_document_id'),
  affidavitDocumentId: uuid('affidavit_document_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workerEducation = pgTable(
  'worker_education',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    level: text('level').notNull(),
    course: text('course'),
    institution: text('institution').notNull(),
    country: text('country').notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    grade: text('grade'),
    certificateDocumentId: uuid('certificate_document_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ workerIdx: index('worker_education_worker_idx').on(t.workerId) }),
);

export const workerExperience = pgTable(
  'worker_experience',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    jobTitle: text('job_title').notNull(),
    employerName: text('employer_name').notNull(),
    sector: text('sector'),
    natureOfRole: text('nature_of_role'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').notNull().default(false),
    duties: text('duties'),
    skillsApplied: jsonb('skills_applied').notNull().default('[]'),
    reasonForLeaving: text('reason_for_leaving'),
    letterDocumentId: uuid('letter_document_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ workerIdx: index('worker_experience_worker_idx').on(t.workerId) }),
);

export const workerReferences = pgTable(
  'worker_references',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    organisation: text('organisation').notNull(),
    position: text('position'),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    referenceType: referenceTypeEnum('reference_type').notNull(),
    letterDocumentId: uuid('letter_document_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ workerIdx: index('worker_references_worker_idx').on(t.workerId) }),
);

export const workerSkills = pgTable(
  'worker_skills',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    kind: skillKindEnum('kind').notNull(),
    category: text('category'),
    name: text('name').notNull(),
    selfRating: integer('self_rating'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index('worker_skills_worker_idx').on(t.workerId),
    workerKindIdx: index('worker_skills_worker_kind_idx').on(t.workerId, t.kind),
  }),
);

export const workerPreferences = pgTable(
  'worker_preferences',
  {
    workerId: uuid('worker_id')
      .primaryKey()
      .references(() => workers.id, { onDelete: 'cascade' }),
    desiredSectors: jsonb('desired_sectors').notNull().default('[]'),
    employmentType: employmentTypeEnum('employment_type'),
    preferredSettings: jsonb('preferred_settings').notNull().default('[]'),
    availabilityStart: date('availability_start'),
    shiftPreferences: jsonb('shift_preferences').notNull().default('[]'),
    relocationWillingness: boolean('relocation_willingness'),
    preferredCities: jsonb('preferred_cities').notNull().default('[]'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ availIdx: index('worker_preferences_avail_idx').on(t.availabilityStart) }),
);

export const workerSalaryExpectations = pgTable('worker_salary_expectations', {
  workerId: uuid('worker_id')
    .primaryKey()
    .references(() => workers.id, { onDelete: 'cascade' }),
  wageStructure: wageStructureEnum('wage_structure'),
  minRate: numeric('min_rate'),
  maxRate: numeric('max_rate'),
  currency: text('currency').notNull().default('NGN'),
  negotiable: boolean('negotiable').notNull().default(true),
  expectedBenefits: jsonb('expected_benefits').notNull().default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workerProfileExtras = pgTable('worker_profile_extras', {
  workerId: uuid('worker_id')
    .primaryKey()
    .references(() => workers.id, { onDelete: 'cascade' }),
  interests: text('interests'),
  personalStatement: text('personal_statement'),
  videoIntroDocumentId: uuid('video_intro_document_id'),
  cpdEnrolled: boolean('cpd_enrolled').notNull().default(false),
  oakvaleProgrammeAcknowledged: boolean('oakvale_programme_acknowledged').notNull().default(false),
  immunisationDeclared: boolean('immunisation_declared').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workerDocuments = pgTable(
  'worker_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    category: documentCategoryEnum('category').notNull(),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: documentStatusEnum('status').notNull().default('UPLOADING'),
    scannedAt: timestamp('scanned_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index('worker_documents_worker_idx').on(t.workerId),
    statusIdx: index('worker_documents_status_idx').on(t.status),
  }),
);

export type Worker = typeof workers.$inferSelect;
export type WorkerDocument = typeof workerDocuments.$inferSelect;

/* ------------------------ verification + compliance ----------------------- */

export const verificationRequestTypeEnum = pgEnum(
  'verification_request_type',
  VERIFICATION_REQUEST_TYPES,
);
export const verificationStatusEnum = pgEnum('verification_status', VERIFICATION_STATUSES);
export const backgroundCheckStatusEnum = pgEnum(
  'background_check_status',
  BACKGROUND_CHECK_STATUSES,
);
export const certTypeEnum = pgEnum('cert_type', CERT_TYPES);
export const certVerificationStatusEnum = pgEnum('cert_verification_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);
export const flagTypeEnum = pgEnum('flag_type', FLAG_TYPES);
export const flagSeverityEnum = pgEnum('flag_severity', FLAG_SEVERITIES);

export const verificationRequests = pgTable(
  'verification_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    requestType: verificationRequestTypeEnum('request_type').notNull(),
    status: verificationStatusEnum('status').notNull().default('PENDING'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    decisionReason: text('decision_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index('verification_requests_worker_idx').on(t.workerId),
    workerTypeIdx: index('verification_requests_worker_type_idx').on(t.workerId, t.requestType),
  }),
);

export const backgroundChecks = pgTable(
  'background_checks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    status: backgroundCheckStatusEnum('status').notNull().default('PENDING'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    result: jsonb('result'),
    // Admin reviewer + reason (background is reviewed manually from uploaded docs).
    notes: text('notes'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    triggeredBy: uuid('triggered_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index('background_checks_worker_idx').on(t.workerId),
    statusIdx: index('background_checks_status_idx').on(t.status),
  }),
);

export const cpdRecords = pgTable(
  'cpd_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    courseName: text('course_name').notNull(),
    provider: text('provider').notNull(),
    completedAt: date('completed_at').notNull(),
    expiresAt: date('expires_at'),
    hoursCompleted: numeric('hours_completed'),
    certificateDocumentId: uuid('certificate_document_id'),
    verifiedByOakvale: boolean('verified_by_oakvale').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index('cpd_records_worker_idx').on(t.workerId),
    expiresIdx: index('cpd_records_expires_idx').on(t.expiresAt),
  }),
);

export const cpdEnrolments = pgTable(
  'cpd_enrolments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    programmeId: text('programme_id').notNull(),
    programmeName: text('programme_name').notNull(),
    status: cpdEnrolmentStatusEnum('status').notNull().default('ENROLLED'),
    lmsEnrolmentId: text('lms_enrolment_id'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index('cpd_enrolments_worker_idx').on(t.workerId),
  }),
);

export const certifications = pgTable(
  'certifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    certType: certTypeEnum('cert_type').notNull(),
    certNumber: text('cert_number'),
    issuedBy: text('issued_by').notNull(),
    issuedAt: date('issued_at').notNull(),
    expiresAt: date('expires_at'),
    certificateDocumentId: uuid('certificate_document_id'),
    isOakvaleCert: boolean('is_oakvale_cert').notNull().default(false),
    verificationStatus: certVerificationStatusEnum('verification_status')
      .notNull()
      .default('PENDING'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index('certifications_worker_idx').on(t.workerId),
    expiresIdx: index('certifications_expires_idx').on(t.expiresAt),
    oakvaleIdx: index('certifications_oakvale_idx').on(t.isOakvaleCert),
    verificationStatusIdx: index('certifications_verification_status_idx').on(
      t.verificationStatus,
    ),
  }),
);

export const complianceFlags = pgTable(
  'compliance_flags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    flagType: flagTypeEnum('flag_type').notNull(),
    severity: flagSeverityEnum('severity').notNull().default('MEDIUM'),
    raisedBy: uuid('raised_by').references(() => users.id, { onDelete: 'set null' }),
    raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().defaultNow(),
    details: text('details').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workerIdx: index('compliance_flags_worker_idx').on(t.workerId),
    activeIdx: index('compliance_flags_active_idx').on(t.flagType, t.resolvedAt),
  }),
);

export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type BackgroundCheck = typeof backgroundChecks.$inferSelect;
export type CpdRecord = typeof cpdRecords.$inferSelect;
export type Certification = typeof certifications.$inferSelect;
export type ComplianceFlag = typeof complianceFlags.$inferSelect;

/* ----------------------------- employers domain --------------------------- */

export const mobilityLevelEnum = pgEnum('mobility_level', MOBILITY_LEVELS);
export const accommodationTypeEnum = pgEnum('accommodation_type', ACCOMMODATION_TYPES);
export const urgencyLevelEnum = pgEnum('urgency_level', URGENCY_LEVELS);
export const jobPostingStatusEnum = pgEnum('job_posting_status', JOB_POSTING_STATUSES);
export const jobPriorityLevelEnum = pgEnum('job_priority_level', JOB_PRIORITY_LEVELS);
export const jobApplicationStatusEnum = pgEnum('job_application_status', JOB_APPLICATION_STATUSES);
export const jobVisibilityEnum = pgEnum('job_visibility', JOB_VISIBILITY);
export const jobCountryEnum = pgEnum('job_country', JOB_COUNTRIES);
export const jobSalaryCurrencyEnum = pgEnum('job_salary_currency', JOB_SALARY_CURRENCIES);
export const employerVerificationStatusEnum = pgEnum(
  'employer_verification_status',
  EMPLOYER_VERIFICATION_STATUSES,
);
export const employerDocumentCategoryEnum = pgEnum(
  'employer_document_category',
  EMPLOYER_DOCUMENT_CATEGORIES,
);
export const interviewFormatEnum = pgEnum('interview_format', INTERVIEW_FORMATS);
export const interviewStatusEnum = pgEnum('interview_status', INTERVIEW_STATUSES);
export const interviewOutcomeEnum = pgEnum('interview_outcome', INTERVIEW_OUTCOMES);

export const employers = pgTable(
  'employers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Configurable employer-type reference (§5). Authoritative discriminator —
    // the legacy `employer_type` enum column was dropped in Phase 5.
    employerTypeId: uuid('employer_type_id')
      .notNull()
      .references(() => employerTypes.id, {
        onDelete: 'set null',
      }),
    orgName: text('org_name'),
    sector: text('sector'),
    regNumber: text('reg_number'),
    address: text('address'),
    logoUrl: text('logo_url'),
    website: text('website'),
    about: text('about'),
    ndpaConsentGiven: boolean('ndpa_consent_given').notNull().default(false),
    ndpaConsentTimestamp: timestamp('ndpa_consent_timestamp', { withTimezone: true }),
    ndpaConsentedBy: uuid('ndpa_consented_by').references(() => users.id, { onDelete: 'set null' }),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    // §6.2 — agent verification workflow.
    verificationStatus: employerVerificationStatusEnum('verification_status')
      .notNull()
      .default('PENDING'),
    verificationSubmittedAt: timestamp('verification_submitted_at', { withTimezone: true }),
    verificationReviewedAt: timestamp('verification_reviewed_at', { withTimezone: true }),
    verificationReviewedBy: uuid('verification_reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    verificationNotes: text('verification_notes'),
    accountManagerId: uuid('account_manager_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeIdIdx: index('employers_type_id_idx').on(t.employerTypeId),
    verificationIdx: index('employers_verification_idx').on(t.verificationStatus),
  }),
);

export const employerDocuments = pgTable(
  'employer_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    category: employerDocumentCategoryEnum('category').notNull(),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    status: documentStatusEnum('status').notNull().default('UPLOADING'),
    scannedAt: timestamp('scanned_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerIdx: index('employer_documents_employer_idx').on(t.employerId),
    statusIdx: index('employer_documents_status_idx').on(t.status),
  }),
);
export type EmployerDocument = typeof employerDocuments.$inferSelect;

export const employerContacts = pgTable(
  'employer_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: text('position'),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerIdx: index('employer_contacts_employer_idx').on(t.employerId),
  }),
);

export const individualEmployerNeedsAssessments = pgTable('individual_employer_needs_assessments', {
  employerId: uuid('employer_id')
    .primaryKey()
    .references(() => employers.id, { onDelete: 'cascade' }),
  careRecipientName: text('care_recipient_name').notNull(),
  age: integer('age'),
  relationship: text('relationship'),
  conditions: text('conditions'),
  mobilityLevel: mobilityLevelEnum('mobility_level'),
  medicationNeeds: text('medication_needs'),
  preferredLanguage: text('preferred_language'),
  culturalRequirements: text('cultural_requirements'),
  dietaryRequirements: text('dietary_requirements'),
  accommodationType: accommodationTypeEnum('accommodation_type'),
  urgencyLevel: urgencyLevelEnum('urgency_level'),
  additionalNotes: text('additional_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const corporateNeedsAssessments = pgTable('corporate_needs_assessments', {
  employerId: uuid('employer_id')
    .primaryKey()
    .references(() => employers.id, { onDelete: 'cascade' }),
  numStaffRequired: integer('num_staff_required').notNull(),
  ageRangesServed: jsonb('age_ranges_served').notNull().default('[]'),
  hoursOfOperation: text('hours_of_operation'),
  existingStaffCount: integer('existing_staff_count').notNull().default(0),
  specificSkillsNeeded: jsonb('specific_skills_needed').notNull().default('[]'),
  budgetParameters: text('budget_parameters'),
  siteAssessmentNotes: text('site_assessment_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Configurable care-type taxonomy for the employer job-posting side (brief §5).
 * Admin-managed (not hardcoded) so the client's evolving list drops in without a
 * code change. Caregivers self-select into roles by advertised care type — they
 * never declare specialties themselves (see the removed worker skills section, §4).
 */
export const careTypes = pgTable(
  'care_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('care_types_active_idx').on(t.isActive),
  }),
);

export const jobPostings = pgTable(
  'job_postings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    duties: text('duties'),
    country: jobCountryEnum('country').notNull().default('NIGERIA'),
    workLocation: text('work_location'),
    schedule: text('schedule'),
    salaryCurrency: jobSalaryCurrencyEnum('salary_currency').notNull().default('NGN'),
    salaryRange: text('salary_range'),
    benefits: jsonb('benefits').notNull().default('[]'),
    /** §5 — optional care specialisations this role involves (grouped multi-select labels). */
    specialisations: jsonb('specialisations').$type<string[]>().notNull().default([]),
    openings: integer('openings').notNull().default(1),
    deadline: date('deadline'),
    priorityLevel: jobPriorityLevelEnum('priority_level').notNull().default('MEDIUM'),
    status: jobPostingStatusEnum('status').notNull().default('OPEN'),
    // §6.3 job-post fields
    workforceCategoryId: uuid('workforce_category_id').references(() => workforceCategories.id, {
      onDelete: 'set null',
    }),
    /** §5 — the type of care this role needs, drives caregiver self-selection. */
    careTypeId: uuid('care_type_id').references(() => careTypes.id, { onDelete: 'set null' }),
    backgroundCheckRequired: boolean('background_check_required').notNull().default(true),
    visibility: jobVisibilityEnum('visibility').notNull().default('PUBLIC'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerIdx: index('job_postings_employer_idx').on(t.employerId),
    employerStatusIdx: index('job_postings_employer_status_idx').on(t.employerId, t.status),
    categoryIdx: index('job_postings_category_idx').on(t.workforceCategoryId),
    careTypeIdx: index('job_postings_care_type_idx').on(t.careTypeId),
  }),
);

export const jobApplications = pgTable(
  'job_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobPostingId: uuid('job_posting_id')
      .notNull()
      .references(() => jobPostings.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    status: jobApplicationStatusEnum('status').notNull().default('APPLIED'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdx: index('job_applications_job_idx').on(t.jobPostingId),
    workerIdx: index('job_applications_worker_idx').on(t.workerId),
    uniqApplication: uniqueIndex('job_applications_uniq_idx').on(t.jobPostingId, t.workerId),
  }),
);

export const interviews = pgTable(
  'interviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    shortlistId: uuid('shortlist_id').references(() => shortlists.id, { onDelete: 'set null' }),
    jobPostingId: uuid('job_posting_id').references(() => jobPostings.id, { onDelete: 'set null' }),
    format: interviewFormatEnum('format').notNull(),
    proposedSlots: jsonb('proposed_slots').notNull().default('[]'),
    confirmedSlot: timestamp('confirmed_slot', { withTimezone: true }),
    status: interviewStatusEnum('status').notNull().default('REQUESTED'),
    outcome: interviewOutcomeEnum('outcome'),
    outcomeNotes: text('outcome_notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerIdx: index('interviews_employer_idx').on(t.employerId),
    workerIdx: index('interviews_worker_idx').on(t.workerId),
    statusIdx: index('interviews_status_idx').on(t.status),
  }),
);

export type Employer = typeof employers.$inferSelect;
export type EmployerContact = typeof employerContacts.$inferSelect;
export type IndividualEmployerNeedsAssessment = typeof individualEmployerNeedsAssessments.$inferSelect;
export type CorporateNeedsAssessment = typeof corporateNeedsAssessments.$inferSelect;
export type JobPosting = typeof jobPostings.$inferSelect;

/* ----------------------------- placements domain -------------------------- */

export const pipelineTypeEnum = pgEnum('pipeline_type', PIPELINE_TYPES);
export const placementStatusEnum = pgEnum('placement_status', PLACEMENT_STATUSES);
export const replacementRequestStatusEnum = pgEnum(
  'replacement_request_status',
  REPLACEMENT_REQUEST_STATUSES,
);
export const wellbeingLevelEnum = pgEnum('wellbeing_level', WELLBEING_LEVELS);

export const placements = pgTable(
  'placements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    jobPostingId: uuid('job_posting_id').references(() => jobPostings.id, { onDelete: 'set null' }),
    pipelineType: pipelineTypeEnum('pipeline_type').notNull(),
    status: placementStatusEnum('status').notNull().default('PENDING_PAYMENT'),
    placedAt: timestamp('placed_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    guaranteeExpiresAt: timestamp('guarantee_expires_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endReason: text('end_reason'),
    replacementOf: uuid('replacement_of'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerStatusIdx: index('placements_employer_status_idx').on(t.employerId, t.status),
    workerStatusIdx: index('placements_worker_status_idx').on(t.workerId, t.status),
    statusIdx: index('placements_status_idx').on(t.status),
  }),
);

export const placementRatings = pgTable(
  'placement_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    placementId: uuid('placement_id')
      .notNull()
      .references(() => placements.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    ratedBy: uuid('rated_by').references(() => users.id, { onDelete: 'set null' }),
    stars: integer('stars').notNull(),
    review: text('review'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    // One rating per placement — an employer rates the worker once for the engagement.
    placementUnique: uniqueIndex('placement_ratings_placement_unique').on(t.placementId),
    workerIdx: index('placement_ratings_worker_idx').on(t.workerId),
  }),
);

export const shortlists = pgTable(
  'shortlists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    jobPostingId: uuid('job_posting_id').references(() => jobPostings.id, { onDelete: 'set null' }),
    requestType: pipelineTypeEnum('request_type').notNull(),
    workerIds: jsonb('worker_ids').notNull().default('[]'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    selectedWorkerId: uuid('selected_worker_id').references(() => workers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerIdx: index('shortlists_employer_idx').on(t.employerId),
    jobIdx: index('shortlists_job_idx').on(t.jobPostingId),
  }),
);

export const welfareChecks = pgTable(
  'welfare_checks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    placementId: uuid('placement_id')
      .notNull()
      .references(() => placements.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    recipientWellbeing: wellbeingLevelEnum('recipient_wellbeing'),
    workerAttendance: wellbeingLevelEnum('worker_attendance'),
    issuesFlagged: boolean('issues_flagged').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    placementIdx: index('welfare_checks_placement_idx').on(t.placementId),
  }),
);

export const placementEvents = pgTable(
  'placement_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    placementId: uuid('placement_id')
      .notNull()
      .references(() => placements.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    placementIdx: index('placement_events_placement_idx').on(t.placementId),
    typeIdx: index('placement_events_type_idx').on(t.eventType),
  }),
);

export const replacementRequests = pgTable(
  'replacement_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    originalPlacementId: uuid('original_placement_id')
      .notNull()
      .references(() => placements.id, { onDelete: 'cascade' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    slaDeadline: timestamp('sla_deadline', { withTimezone: true }).notNull(),
    status: replacementRequestStatusEnum('status').notNull().default('OPEN'),
    newPlacementId: uuid('new_placement_id'),
    replacementFeeWaived: boolean('replacement_fee_waived').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusDeadlineIdx: index('replacement_requests_status_deadline_idx').on(t.status, t.slaDeadline),
    originalIdx: index('replacement_requests_original_idx').on(t.originalPlacementId),
  }),
);

export type Placement = typeof placements.$inferSelect;
export type Shortlist = typeof shortlists.$inferSelect;
export type WelfareCheck = typeof welfareChecks.$inferSelect;
export type PlacementEvent = typeof placementEvents.$inferSelect;
export type ReplacementRequest = typeof replacementRequests.$inferSelect;

/* ------------------------------ payments domain --------------------------- */

export const paymentProviderEnum = pgEnum('payment_provider', PAYMENT_PROVIDERS);
export const invoiceStatusEnum = pgEnum('invoice_status', INVOICE_STATUSES);
export const invoicePurposeEnum = pgEnum('invoice_purpose', INVOICE_PURPOSES);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
export const subscriptionPlanEnum = pgEnum('subscription_plan', SUBSCRIPTION_PLANS);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    plan: subscriptionPlanEnum('plan').notNull(),
    provider: paymentProviderEnum('provider').notNull(),
    providerSubscriptionId: text('provider_subscription_id').unique(),
    status: subscriptionStatusEnum('status').notNull().default('ACTIVE'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerStatusIdx: index('subscriptions_employer_status_idx').on(t.employerId, t.status),
  }),
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    placementId: uuid('placement_id').references(() => placements.id, { onDelete: 'set null' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    pipeline: pipelineTypeEnum('pipeline').notNull(),
    purpose: invoicePurposeEnum('purpose').notNull(),
    status: invoiceStatusEnum('status').notNull().default('OPEN'),
    currency: text('currency').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    provider: paymentProviderEnum('provider').notNull(),
    providerInvoiceId: text('provider_invoice_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerStatusIdx: index('invoices_employer_status_idx').on(t.employerId, t.status),
    statusDueIdx: index('invoices_status_due_idx').on(t.status, t.dueAt),
    placementIdx: index('invoices_placement_idx').on(t.placementId),
  }),
);

export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    providerIntentId: text('provider_intent_id').notNull().unique(),
    checkoutUrl: text('checkout_url'),
    status: text('status').notNull().default('OPEN'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invoiceIdx: index('payment_intents_invoice_idx').on(t.invoiceId),
  }),
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    providerPaymentId: text('provider_payment_id').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    status: paymentStatusEnum('status').notNull().default('SUCCEEDED'),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    rawEvent: jsonb('raw_event'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    invoiceIdx: index('payments_invoice_idx').on(t.invoiceId),
  }),
);

export const subscriptionEvents = pgTable(
  'subscription_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    rawEvent: jsonb('raw_event'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subIdx: index('subscription_events_sub_idx').on(t.subscriptionId),
  }),
);

export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;

/* -------------------------------- admin domain ---------------------------- */

export const agentSpecialtyEnum = pgEnum('agent_specialty', AGENT_SPECIALTIES);
export const assignmentRoleEnum = pgEnum('assignment_role', ASSIGNMENT_ROLES);

export const agentProfiles = pgTable(
  'agent_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    specialty: agentSpecialtyEnum('specialty').notNull().default('ADMIN'),
    region: text('region'),
    bio: text('bio'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    specialtyIdx: index('agent_profiles_specialty_idx').on(t.specialty),
  }),
);

export const agentAssignments = pgTable(
  'agent_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    placementId: uuid('placement_id').references(() => placements.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id').references(() => workers.id, { onDelete: 'cascade' }),
    roleOnAssignment: assignmentRoleEnum('role_on_assignment').notNull().default('PRIMARY'),
    assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentIdx: index('agent_assignments_agent_idx').on(t.agentId, t.removedAt),
    placementIdx: index('agent_assignments_placement_idx').on(t.placementId, t.removedAt),
    workerIdx: index('agent_assignments_worker_idx').on(t.workerId, t.removedAt),
  }),
);

export type AgentProfile = typeof agentProfiles.$inferSelect;
export type AgentAssignment = typeof agentAssignments.$inferSelect;

// Per-admin "last seen" marker per sidebar queue. Drives the "new since you last
// opened it" count bubbles in the admin sidebar (see admin/nav-counts.service).
export const adminNavSeen = pgTable(
  'admin_nav_seen',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    navKey: text('nav_key').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    adminKeyUniq: uniqueIndex('admin_nav_seen_admin_key_uniq').on(t.adminUserId, t.navKey),
  }),
);

export type AdminNavSeen = typeof adminNavSeen.$inferSelect;

/* ----------------------------- notifications ------------------------------ */

export const notificationChannelEnum = pgEnum('notification_channel', NOTIFICATION_CHANNELS);
export const notificationStatusEnum = pgEnum('notification_status', NOTIFICATION_STATUSES);

export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    status: notificationStatusEnum('status').notNull().default('PENDING'),
    subject: text('subject'),
    body: text('body'),
    payload: jsonb('payload'),
    idempotencyKey: text('idempotency_key'),
    providerMessageId: text('provider_message_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    inboxIdx: index('notification_log_inbox_idx').on(t.userId, t.status, t.createdAt),
    statusIdx: index('notification_log_status_idx').on(t.status),
  }),
);

export type NotificationLog = typeof notificationLog.$inferSelect;

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    digestMode: text('digest_mode'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: index('notification_preferences_pk').on(t.userId, t.kind, t.channel),
    userIdx: index('notification_preferences_user_idx').on(t.userId),
  }),
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;

export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: text('kind').notNull().unique(),
    subject: text('subject').notNull(),
    html: text('html').notNull(),
    text: text('text').notNull(),
    sms: text('sms').notNull(),
    variables: jsonb('variables').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;

/* ----------------------------- admin audit log ---------------------------- */

export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index('admin_audit_log_actor_idx').on(t.actorId, t.occurredAt),
    actionIdx: index('admin_audit_log_action_idx').on(t.action, t.occurredAt),
    targetIdx: index('admin_audit_log_target_idx').on(t.targetType, t.targetId, t.occurredAt),
  }),
);

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;

/* -------------------------------- contracts ------------------------------- */

export const contractTypeEnum = pgEnum('contract_type', CONTRACT_TYPES);
export const contractStatusEnum = pgEnum('contract_status', CONTRACT_STATUSES);
export const signaturePartyEnum = pgEnum('signature_party', SIGNATURE_PARTIES);
export const signatureMethodEnum = pgEnum('signature_method', SIGNATURE_METHODS);

export const contractTemplates = pgTable(
  'contract_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: contractTypeEnum('type').notNull(),
    name: text('name').notNull(),
    version: integer('version').notNull().default(1),
    body: text('body').notNull(),
    variables: jsonb('variables').$type<string[]>().notNull().default([]),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeActiveIdx: index('contract_templates_type_active_idx').on(t.type, t.isActive),
  }),
);

export const contracts = pgTable(
  'contracts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: contractTypeEnum('type').notNull(),
    templateId: uuid('template_id').references(() => contractTemplates.id, {
      onDelete: 'set null',
    }),
    templateVersion: integer('template_version'),
    placementId: uuid('placement_id').references(() => placements.id, { onDelete: 'set null' }),
    employerId: uuid('employer_id').references(() => employers.id, { onDelete: 'set null' }),
    workerId: uuid('worker_id').references(() => workers.id, { onDelete: 'set null' }),
    bodyRendered: text('body_rendered').notNull(),
    status: contractStatusEnum('status').notNull().default('DRAFT'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    fullyExecutedAt: timestamp('fully_executed_at', { withTimezone: true }),
    supersededById: uuid('superseded_by_id'),
    terminatedReason: text('terminated_reason'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    placementIdx: index('contracts_placement_idx').on(t.placementId),
    employerIdx: index('contracts_employer_idx').on(t.employerId, t.status),
    workerIdx: index('contracts_worker_idx').on(t.workerId, t.status),
    statusIdx: index('contracts_status_idx').on(t.status, t.updatedAt),
    expiresIdx: index('contracts_expires_idx').on(t.expiresAt),
  }),
);

export const contractSignatures = pgTable(
  'contract_signatures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contractId: uuid('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    party: signaturePartyEnum('party').notNull(),
    signerUserId: uuid('signer_user_id').references(() => users.id, { onDelete: 'set null' }),
    signerName: text('signer_name').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    method: signatureMethodEnum('method').notNull().default('CHECKBOX_REAUTH'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contractIdx: index('contract_signatures_contract_idx').on(t.contractId),
    uniqContractParty: index('contract_signatures_uniq_party_idx').on(t.contractId, t.party),
  }),
);

export const contractAmendments = pgTable(
  'contract_amendments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    originalContractId: uuid('original_contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    supersedingContractId: uuid('superseding_contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
    changedFields: jsonb('changed_fields').notNull(),
    reason: text('reason'),
    kind: text('kind').notNull().default('AMENDMENT'),
    initiatedBy: uuid('initiated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    originalIdx: index('contract_amendments_original_idx').on(t.originalContractId),
    supersedingIdx: index('contract_amendments_superseding_idx').on(t.supersedingContractId),
  }),
);

export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ContractSignature = typeof contractSignatures.$inferSelect;
export type ContractAmendment = typeof contractAmendments.$inferSelect;

/* -------------------------------- complaints ------------------------------ */

export const complaintCategoryEnum = pgEnum('complaint_category', COMPLAINT_CATEGORIES);
export const complaintUrgencyEnum = pgEnum('complaint_urgency', COMPLAINT_URGENCIES);
export const complaintStatusEnum = pgEnum('complaint_status', COMPLAINT_STATUSES);
export const complaintOutcomeEnum = pgEnum('complaint_outcome', COMPLAINT_OUTCOMES);
export const complaintEventKindEnum = pgEnum('complaint_event_kind', COMPLAINT_EVENT_KINDS);

export const complaints = pgTable(
  'complaints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseRef: text('case_ref').notNull().unique(),
    category: complaintCategoryEnum('category').notNull(),
    urgency: complaintUrgencyEnum('urgency').notNull(),
    status: complaintStatusEnum('status').notNull().default('SUBMITTED'),
    subject: text('subject').notNull(),
    narrative: text('narrative').notNull(),
    raisedByUserId: uuid('raised_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    againstUserId: uuid('against_user_id').references(() => users.id, { onDelete: 'set null' }),
    placementId: uuid('placement_id').references(() => placements.id, { onDelete: 'set null' }),
    assignedToAgentId: uuid('assigned_to_agent_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    outcome: complaintOutcomeEnum('outcome'),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('complaints_status_idx').on(t.status, t.urgency, t.createdAt),
    raisedByIdx: index('complaints_raised_by_idx').on(t.raisedByUserId, t.createdAt),
    againstIdx: index('complaints_against_idx').on(t.againstUserId, t.createdAt),
    assignedIdx: index('complaints_assigned_idx').on(t.assignedToAgentId, t.status),
    placementIdx: index('complaints_placement_idx').on(t.placementId),
    slaIdx: index('complaints_sla_idx').on(t.slaDeadline, t.status),
  }),
);

export const complaintEvents = pgTable(
  'complaint_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    complaintId: uuid('complaint_id')
      .notNull()
      .references(() => complaints.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    kind: complaintEventKindEnum('kind').notNull(),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    complaintIdx: index('complaint_events_complaint_idx').on(t.complaintId, t.occurredAt),
  }),
);

export type Complaint = typeof complaints.$inferSelect;
export type ComplaintEvent = typeof complaintEvents.$inferSelect;

/* ----------------------------- placement offers ----------------------------- */

export const offerStatusEnum = pgEnum('offer_status', OFFER_STATUSES);
export const offerCurrencyEnum = pgEnum('offer_currency', OFFER_CURRENCIES);
export const offerAccommodationEnum = pgEnum(
  'offer_accommodation_type',
  OFFER_ACCOMMODATION_TYPES,
);

export const placementOffers = pgTable(
  'placement_offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shortlistId: uuid('shortlist_id')
      .notNull()
      .references(() => shortlists.id, { onDelete: 'cascade' }),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    status: offerStatusEnum('status').notNull().default('DRAFT'),
    pipelineType: pipelineTypeEnum('pipeline_type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    salaryAmountMinor: bigint('salary_amount_minor', { mode: 'number' }).notNull(),
    salaryCurrency: offerCurrencyEnum('salary_currency').notNull(),
    accommodationType: offerAccommodationEnum('accommodation_type'),
    schedule: text('schedule'),
    notes: text('notes'),
    agentReviewedBy: uuid('agent_reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    agentReviewedAt: timestamp('agent_reviewed_at', { withTimezone: true }),
    workerRespondedAt: timestamp('worker_responded_at', { withTimezone: true }),
    counterOfferId: uuid('counter_offer_id'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    declinedReason: text('declined_reason'),
    placementId: uuid('placement_id').references(() => placements.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shortlistIdx: index('placement_offers_shortlist_idx').on(t.shortlistId, t.workerId),
    employerIdx: index('placement_offers_employer_idx').on(t.employerId, t.status),
    workerIdx: index('placement_offers_worker_idx').on(t.workerId, t.status),
    statusIdx: index('placement_offers_status_idx').on(t.status, t.updatedAt),
  }),
);

export type PlacementOffer = typeof placementOffers.$inferSelect;

/* -------------------------------- messaging -------------------------------- */

export const conversationStatusEnum = pgEnum('conversation_status', CONVERSATION_STATUSES);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shortlistId: uuid('shortlist_id')
      .notNull()
      .references(() => shortlists.id, { onDelete: 'cascade' }),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    status: conversationStatusEnum('status').notNull().default('OPEN'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerIdx: index('conversations_employer_idx').on(t.employerId, t.lastMessageAt),
    workerIdx: index('conversations_worker_idx').on(t.workerId, t.lastMessageAt),
    uniqShortlistPair: index('conversations_uniq_idx').on(t.shortlistId, t.workerId),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    flaggedForReview: boolean('flagged_for_review').notNull().default(false),
    flaggedReasons: jsonb('flagged_reasons').$type<string[]>().notNull().default([]),
    redactedBody: text('redacted_body'),
    reviewedByAgentId: uuid('reviewed_by_agent_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    readByRecipientAt: timestamp('read_by_recipient_at', { withTimezone: true }),
    // Set when the message was rejected for containing contact details — never delivered.
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    convIdx: index('messages_conv_idx').on(t.conversationId, t.createdAt),
    flaggedIdx: index('messages_flagged_idx').on(t.flaggedForReview, t.createdAt),
  }),
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;

/* ------------------------------ saved searches ----------------------------- */

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    filters: jsonb('filters').notNull(),
    notifyOnNewMatch: boolean('notify_on_new_match').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employerIdx: index('saved_searches_employer_idx').on(t.employerId, t.updatedAt),
  }),
);

export type SavedSearch = typeof savedSearches.$inferSelect;

/* ------------------------------ welfare reports + escalations ------------- */

export const welfareReports = pgTable(
  'welfare_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    welfareCheckId: uuid('welfare_check_id')
      .notNull()
      .references(() => welfareChecks.id, { onDelete: 'cascade' })
      .unique(),
    placementId: uuid('placement_id')
      .notNull()
      .references(() => placements.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key'),
    pdfBase64: text('pdf_base64'),
    deliveredToEmail: text('delivered_to_email'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    placementIdx: index('welfare_reports_placement_idx').on(t.placementId, t.createdAt),
  }),
);

export const welfareEscalations = pgTable(
  'welfare_escalations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    welfareCheckId: uuid('welfare_check_id')
      .notNull()
      .references(() => welfareChecks.id, { onDelete: 'cascade' }),
    placementId: uuid('placement_id')
      .notNull()
      .references(() => placements.id, { onDelete: 'cascade' }),
    severity: wellbeingLevelEnum('severity').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolutionNotes: text('resolution_notes'),
    overdueNotifiedAt: timestamp('overdue_notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    openIdx: index('welfare_escalations_open_idx').on(t.placementId, t.resolvedAt),
    dueIdx: index('welfare_escalations_due_idx').on(t.dueAt),
  }),
);

export type WelfareReport = typeof welfareReports.$inferSelect;
export type WelfareEscalation = typeof welfareEscalations.$inferSelect;

export const savedSearchMatches = pgTable(
  'saved_search_matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    savedSearchId: uuid('saved_search_id')
      .notNull()
      .references(() => savedSearches.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id, { onDelete: 'cascade' }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqIdx: index('saved_search_matches_uniq_idx').on(t.savedSearchId, t.workerId),
  }),
);

export type SavedSearchMatch = typeof savedSearchMatches.$inferSelect;

/**
 * Admin-configurable workforce categories. Becomes the source of truth for the
 * worker taxonomy; the menu/config arrays are non-queried JSONB config.
 */
export const workforceCategories = pgTable(
  'workforce_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    requiredCertifications: jsonb('required_certifications')
      .$type<{ name: string; lmsCourseRef?: string }[]>()
      .notNull()
      .default([]),
    requiredIdentityFields: jsonb('required_identity_fields')
      .$type<string[]>()
      .notNull()
      .default([]),
    skillsMenu: jsonb('skills_menu').$type<string[]>().notNull().default([]),
    specialistTags: jsonb('specialist_tags').$type<string[]>().notNull().default([]),
    applicableSettings: jsonb('applicable_settings').$type<string[]>().notNull().default([]),
    applicableEmploymentTypes: jsonb('applicable_employment_types')
      .$type<string[]>()
      .notNull()
      .default([]),
    requiredComplianceFields: jsonb('required_compliance_fields')
      .$type<string[]>()
      .notNull()
      .default([]),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('workforce_categories_active_idx').on(t.isActive),
  }),
);

export type WorkforceCategory = typeof workforceCategories.$inferSelect;
export type NewWorkforceCategory = typeof workforceCategories.$inferInsert;

export type CareType = typeof careTypes.$inferSelect;
export type NewCareType = typeof careTypes.$inferInsert;

/**
 * Admin-configurable employer types (§5). Source of truth for the employer
 * taxonomy; menu/config values are non-queried JSONB. The legacy
 * `employers.employer_type` enum stays as the route/dashboard key during
 * migration and is dropped once all reads use `employer_type_id`.
 */
type EmployerTypePriceConfig = {
  subscription?: { amountMinor: number; currency: string; provider: string } | null;
  placementFee?: { amountMinor: number; currency: string; provider: string } | null;
};

export const employerTypes = pgTable(
  'employer_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    roleKey: text('role_key').notNull(),
    registrationFields: jsonb('registration_fields').$type<string[]>().notNull().default([]),
    verificationMethods: jsonb('verification_methods').$type<string[]>().notNull().default([]),
    serviceModel: text('service_model').notNull().default('SELF_SERVICE'),
    jobPostingEnabled: boolean('job_posting_enabled').notNull().default(false),
    onboardingSteps: jsonb('onboarding_steps').$type<string[]>().notNull().default([]),
    /** null = all worker categories accessible; otherwise the allow-list of category UUIDs. */
    allowedWorkerCategoryIds: jsonb('allowed_worker_category_ids').$type<string[] | null>(),
    applicableContractTypes: jsonb('applicable_contract_types')
      .$type<string[]>()
      .notNull()
      .default([]),
    pricing: jsonb('pricing').$type<EmployerTypePriceConfig>().notNull().default({}),
    paymentProviders: jsonb('payment_providers').$type<string[]>().notNull().default([]),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('employer_types_active_idx').on(t.isActive),
    roleKeyIdx: index('employer_types_role_key_idx').on(t.roleKey),
  }),
);

export type EmployerTypeRow = typeof employerTypes.$inferSelect;
export type NewEmployerTypeRow = typeof employerTypes.$inferInsert;

/**
 * §14.2 Payroll — internal NGN worker-payout ledger. Business Rule #6: this is
 * deliberately separate from the employer-facing `invoices`/`payments` tables;
 * money paid TO workers (NGN, Oakvale Nigeria) never mixes with money received
 * FROM employers (GBP/USD Stripe or NGN Paystack).
 */
export const payrollRuns = pgTable(
  'payroll_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    status: payrollRunStatusEnum('status').notNull().default('DRAFT'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('payroll_runs_status_idx').on(t.status),
  }),
);

export const workerPayouts = pgTable(
  'worker_payouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    payrollRunId: uuid('payroll_run_id')
      .notNull()
      .references(() => payrollRuns.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    placementId: uuid('placement_id').references(() => placements.id, { onDelete: 'set null' }),
    // NGN-only ledger — workers are paid in Naira by Oakvale Nigeria (Rule #6).
    currency: text('currency').notNull().default('NGN'),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    status: workerPayoutStatusEnum('status').notNull().default('PENDING'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    reference: text('reference'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index('worker_payouts_run_idx').on(t.payrollRunId),
    workerIdx: index('worker_payouts_worker_idx').on(t.workerId),
    runWorkerUnique: uniqueIndex('worker_payouts_run_worker_unique').on(t.payrollRunId, t.workerId),
  }),
);
