export const PIPELINE_TYPES = ['INDIVIDUAL_EMPLOYER', 'CORPORATE'] as const;
export type PipelineType = (typeof PIPELINE_TYPES)[number];

export const PLACEMENT_STATUSES = [
  'PENDING_PAYMENT',
  'SHORTLISTED',
  'INTERVIEWING',
  'SELECTED',
  'CONTRACT_PENDING',
  'ACTIVE',
  'COMPLETED',
  'TERMINATED',
  'SUSPENDED',
] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

export const END_REASONS = [
  'COMPLETED',
  'REPLACED',
  'EMPLOYER_TERMINATED',
  'WORKER_RESIGNED',
  'SAFEGUARDING',
  'OTHER',
] as const;
export type EndReason = (typeof END_REASONS)[number];

export const WELLBEING_LEVELS = ['GOOD', 'FAIR', 'POOR', 'UNKNOWN'] as const;
export type WellbeingLevel = (typeof WELLBEING_LEVELS)[number];

export const REPLACEMENT_REQUEST_STATUSES = [
  'OPEN',
  'FULFILLED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type ReplacementRequestStatus = (typeof REPLACEMENT_REQUEST_STATUSES)[number];

export const PLACEMENT_EVENT_TYPES = [
  'SHORTLISTED',
  'VIEWED',
  'SELECTED',
  'CONTRACT_EXECUTED',
  'ACTIVATED',
  'WELFARE_LOGGED',
  'REPLACEMENT_REQUESTED',
  'REPLACED',
  'COMPLETED',
  'TERMINATED',
  'SUSPENDED',
] as const;
export type PlacementEventType = (typeof PLACEMENT_EVENT_TYPES)[number];

export const INDIVIDUAL_EMPLOYER_SLA_BUSINESS_DAYS = 5;
export const CORPORATE_SLA_BUSINESS_DAYS = 3;
export const GUARANTEE_WINDOW_DAYS = 90;
