export const WORKER_SECTIONS = [
  'A','B','C','D','E','F','G','H','I','J','K','L',
] as const;
export type WorkerSection = (typeof WORKER_SECTIONS)[number];

/** Sections that are locked once a profile is APPROVED — editing them requires revalidation. */
export const REVALIDATION_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'H'] as const;
export type RevalidationSection = (typeof REVALIDATION_SECTIONS)[number];

export const VISIBILITY_STATUS = [
  'DRAFT','PENDING_REVIEW','APPROVED','REJECTED','SUSPENDED',
] as const;
export type VisibilityStatus = (typeof VISIBILITY_STATUS)[number];

export const ID_TYPES = ['NIN','PASSPORT','VOTER_CARD','DRIVERS_LICENSE'] as const;
export type IdType = (typeof ID_TYPES)[number];

export const GENDERS = ['FEMALE','MALE'] as const;
export type Gender = (typeof GENDERS)[number];

/** The 36 states of Nigeria plus the Federal Capital Territory (Abuja). */
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const;
export type NigerianState = (typeof NIGERIAN_STATES)[number];

export const EMPLOYMENT_TYPES = ['LIVE_IN','LIVE_OUT','EITHER','FULL_TIME','PART_TIME','SHIFT'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WAGE_STRUCTURES = ['MONTHLY','HOURLY','DAILY'] as const;
export type WageStructure = (typeof WAGE_STRUCTURES)[number];

export const REFERENCE_TYPES = ['PROFESSIONAL','CHARACTER','ACADEMIC'] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export const SKILL_KINDS = ['SKILL','CERTIFICATION','LANGUAGE'] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

export const CARE_CATEGORIES = ['ELDERLY_CARE','CHILDCARE'] as const;
export type CareCategory = (typeof CARE_CATEGORIES)[number];

export const CARE_CATEGORY_LABELS: Record<CareCategory, string> = {
  ELDERLY_CARE: 'Elderly / home care',
  CHILDCARE: 'Childcare / early years',
};

export const EDUCATION_LEVELS = [
  'PRIMARY', 'JSCE', 'SSCE', 'VOCATIONAL', 'NCE', 'OND', 'HND',
  'BSC', 'MSC', 'PHD', 'OTHER',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  PRIMARY: 'Primary (FSLC)',
  JSCE: 'JSCE',
  SSCE: 'SSCE / WAEC / NECO',
  VOCATIONAL: 'Vocational / trade certificate',
  NCE: 'NCE',
  OND: 'OND',
  HND: 'HND',
  BSC: "Bachelor's (BSc / BA / BEd)",
  MSC: "Master's (MSc / MA)",
  PHD: 'PhD / doctorate',
  OTHER: 'Other',
};

export const NATURE_OF_ROLES = [
  'ELDERLY_CARE', 'CHILDCARE_NANNY', 'CRECHE_EARLY_YEARS', 'SPECIAL_NEEDS_CARE',
  'NURSING_CLINICAL', 'HOUSEKEEPING_DOMESTIC', 'TEACHING_TUTORING', 'OTHER',
] as const;
export type NatureOfRole = (typeof NATURE_OF_ROLES)[number];

export const NATURE_OF_ROLE_LABELS: Record<NatureOfRole, string> = {
  ELDERLY_CARE: 'Elderly / home care',
  CHILDCARE_NANNY: 'Childcare / nanny',
  CRECHE_EARLY_YEARS: 'Crèche / early years',
  SPECIAL_NEEDS_CARE: 'Special needs care',
  NURSING_CLINICAL: 'Nursing / clinical',
  HOUSEKEEPING_DOMESTIC: 'Housekeeping / domestic',
  TEACHING_TUTORING: 'Teaching / tutoring',
  OTHER: 'Other',
};

export const SECTORS = [
  'ELDERLY_CARE', 'CHILDCARE_NANNY', 'CRECHE_EARLY_YEARS', 'SPECIAL_NEEDS_CARE',
  'NURSING_CLINICAL', 'HOUSEKEEPING_DOMESTIC', 'TEACHING_TUTORING', 'OTHER',
] as const;
export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  ELDERLY_CARE: 'Elderly / home care',
  CHILDCARE_NANNY: 'Childcare / nanny',
  CRECHE_EARLY_YEARS: 'Crèche / early years',
  SPECIAL_NEEDS_CARE: 'Special needs care',
  NURSING_CLINICAL: 'Nursing / clinical',
  HOUSEKEEPING_DOMESTIC: 'Housekeeping / domestic',
  TEACHING_TUTORING: 'Teaching / tutoring',
  OTHER: 'Other',
};

export const PREFERRED_SETTINGS = [
  'FAMILY_HOME', 'CRECHE', 'CORPORATE_CRECHE', 'DAYCARE_PRESCHOOL',
  'SCHOOL', 'NURSING_HOME', 'HOSPITAL_CLINIC', 'OTHER',
] as const;
export type PreferredSetting = (typeof PREFERRED_SETTINGS)[number];

export const PREFERRED_SETTING_LABELS: Record<PreferredSetting, string> = {
  FAMILY_HOME: 'Family home',
  CRECHE: 'Crèche',
  CORPORATE_CRECHE: 'Workplace / corporate crèche',
  DAYCARE_PRESCHOOL: 'Daycare / preschool',
  SCHOOL: 'School',
  NURSING_HOME: 'Nursing / retirement home',
  HOSPITAL_CLINIC: 'Hospital / clinic',
  OTHER: 'Other',
};

export const DOCUMENT_CATEGORIES = [
  'ID_DOCUMENT',
  'SELFIE',
  'PROOF_OF_ADDRESS',
  'EDUCATION_CERT',
  'EXPERIENCE_LETTER',
  'REFERENCE_LETTER',
  'CPD_CERT',
  'VIDEO_INTRO',
  // Background-check documents (admin-reviewed; replaces the automated Sterling check).
  'POLICE_CHARACTER_CERT',
  'GUARANTOR_LETTER',
  'AFFIDAVIT_GOOD_CONDUCT',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_STATUS = ['UPLOADING','SCANNING','CLEAN','INFECTED','REJECTED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[number];

export const ACCEPTED_MIMES_BY_CATEGORY: Record<DocumentCategory, readonly string[]> = {
  ID_DOCUMENT: ['image/jpeg','image/png','application/pdf'],
  SELFIE: ['image/jpeg','image/png'],
  PROOF_OF_ADDRESS: ['image/jpeg','image/png','application/pdf'],
  EDUCATION_CERT: ['image/jpeg','image/png','application/pdf'],
  EXPERIENCE_LETTER: ['application/pdf','image/jpeg','image/png'],
  REFERENCE_LETTER: ['application/pdf','image/jpeg','image/png'],
  CPD_CERT: ['application/pdf','image/jpeg','image/png'],
  VIDEO_INTRO: ['video/mp4','video/quicktime','video/webm'],
  POLICE_CHARACTER_CERT: ['application/pdf','image/jpeg','image/png'],
  GUARANTOR_LETTER: ['application/pdf','image/jpeg','image/png'],
  AFFIDAVIT_GOOD_CONDUCT: ['application/pdf','image/jpeg','image/png'],
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
