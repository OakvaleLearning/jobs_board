export const INTERVIEW_FORMATS = ['IN_PERSON', 'VIDEO', 'PHONE'] as const;
export type InterviewFormat = (typeof INTERVIEW_FORMATS)[number];

export const INTERVIEW_STATUSES = [
  'REQUESTED',
  'CONFIRMED',
  'RESCHEDULE_PROPOSED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_OUTCOMES = ['PROGRESSING', 'NOT_PROGRESSING', 'ON_HOLD'] as const;
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];
