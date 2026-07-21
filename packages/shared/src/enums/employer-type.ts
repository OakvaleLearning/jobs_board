// Vocabulary the Platform Admin picks from when configuring an employer type (§5.4).
// These are the *menus* of allowed values — an employer type stores a chosen subset.

/** Verification methods an employer type may require. */
export const VERIFICATION_METHODS = [
  'CAC_NUMBER',
  'COMPANY_EMAIL',
  'PROOF_OF_RESIDENCY',
  'ID_DOCUMENT',
  'MANUAL',
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const VERIFICATION_METHOD_LABELS: Record<VerificationMethod, string> = {
  CAC_NUMBER: 'CAC registration number',
  COMPANY_EMAIL: 'Company email domain',
  PROOF_OF_RESIDENCY: 'Proof of residency',
  ID_DOCUMENT: 'Identity document',
  MANUAL: 'Manual agent review',
};

/** Service delivery model for an employer type. */
export const SERVICE_MODELS = ['SELF_SERVICE', 'ACCOUNT_MANAGED', 'HYBRID'] as const;
export type ServiceModel = (typeof SERVICE_MODELS)[number];

export const SERVICE_MODEL_LABELS: Record<ServiceModel, string> = {
  SELF_SERVICE: 'Self-service',
  ACCOUNT_MANAGED: 'Account-managed',
  HYBRID: 'Hybrid',
};

/** Onboarding steps an employer type may include, in order. Keys map to wizard components. */
export const ONBOARDING_STEP_KEYS = [
  'org',
  'contact',
  'individual_employer_needs',
  'corporate_needs',
  'ndpa',
] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStepKey, string> = {
  org: 'Organisation',
  contact: 'Primary contact',
  individual_employer_needs: 'Care assessment',
  corporate_needs: 'Workforce needs',
  ndpa: 'NDPA consent',
};
