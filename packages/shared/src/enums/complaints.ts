export const COMPLAINT_CATEGORIES = [
  'SAFEGUARDING',
  'MISCONDUCT',
  'NON_PAYMENT',
  'CONTRACT_DISPUTE',
  'SERVICE_QUALITY',
  'ABSENTEEISM',
  'COMMUNICATION',
  'OTHER',
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_URGENCIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type ComplaintUrgency = (typeof COMPLAINT_URGENCIES)[number];

export const COMPLAINT_STATUSES = [
  'SUBMITTED',
  'ACKNOWLEDGED',
  'IN_INVESTIGATION',
  'RESPONSE_DRAFTED',
  'RESOLVED',
  'CLOSED',
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_OUTCOMES = [
  'UPHELD',
  'PARTIALLY_UPHELD',
  'DISMISSED',
  'MEDIATED',
  'ESCALATED',
] as const;
export type ComplaintOutcome = (typeof COMPLAINT_OUTCOMES)[number];

export const COMPLAINT_EVENT_KINDS = [
  'SUBMITTED',
  'ACKNOWLEDGED',
  'ASSIGNED',
  'NOTE',
  'STATUS_CHANGED',
  'RESOLVED',
  'ESCALATED',
] as const;
export type ComplaintEventKind = (typeof COMPLAINT_EVENT_KINDS)[number];

/**
 * SLA business-day deadlines per urgency tier.
 * CRITICAL is treated as same-day (0.5d → represented as 0 business days = same day).
 */
export const COMPLAINT_SLA_BUSINESS_DAYS: Record<ComplaintUrgency, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 3,
  LOW: 5,
};
