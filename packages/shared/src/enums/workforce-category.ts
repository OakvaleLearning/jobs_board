// Vocabulary the Platform Admin picks from when configuring a workforce category.
// These are the *menus* of allowed values — the category stores a chosen subset.

/** Placement settings a category may apply to. */
export const PLACEMENT_SETTINGS = [
  'HOME',
  'CLINIC',
  'HOSPITAL',
  'CORPORATE',
  'NGO',
  'REMOTE',
] as const;
export type PlacementSetting = (typeof PLACEMENT_SETTINGS)[number];

export const PLACEMENT_SETTING_LABELS: Record<PlacementSetting, string> = {
  HOME: 'Home / family residence',
  CLINIC: 'Clinic',
  HOSPITAL: 'Hospital',
  CORPORATE: 'Corporate / workplace',
  NGO: 'NGO',
  REMOTE: 'Remote',
};

/** Employment types a category may apply to. */
export const CATEGORY_EMPLOYMENT_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'SHIFT',
  'LIVE_IN',
  'CONTRACT',
] as const;
export type CategoryEmploymentType = (typeof CATEGORY_EMPLOYMENT_TYPES)[number];

export const CATEGORY_EMPLOYMENT_TYPE_LABELS: Record<CategoryEmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  SHIFT: 'Shift',
  LIVE_IN: 'Live-in',
  CONTRACT: 'Contract',
};

/** Identity verification fields a category may require. */
export const IDENTITY_FIELD_KEYS = [
  'NIN',
  'PASSPORT',
  'VOTER_CARD',
  'DRIVERS_LICENSE',
  'SELFIE',
  'PROOF_OF_ADDRESS',
] as const;
export type IdentityFieldKey = (typeof IDENTITY_FIELD_KEYS)[number];

export const IDENTITY_FIELD_LABELS: Record<IdentityFieldKey, string> = {
  NIN: 'National Identity Number (NIN)',
  PASSPORT: 'International passport',
  VOTER_CARD: "Voter's card",
  DRIVERS_LICENSE: "Driver's licence",
  SELFIE: 'Selfie / liveness check',
  PROOF_OF_ADDRESS: 'Proof of address',
};

/** Compliance fields a category may require. */
export const COMPLIANCE_FIELD_KEYS = [
  'IMMUNISATION',
  'PROFESSIONAL_REGISTRATION',
  'DBS_EQUIVALENT',
] as const;
export type ComplianceFieldKey = (typeof COMPLIANCE_FIELD_KEYS)[number];

export const COMPLIANCE_FIELD_LABELS: Record<ComplianceFieldKey, string> = {
  IMMUNISATION: 'Immunisation status',
  PROFESSIONAL_REGISTRATION: 'Professional registration',
  DBS_EQUIVALENT: 'DBS-equivalent background check',
};
