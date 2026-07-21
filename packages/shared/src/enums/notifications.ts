export const NOTIFICATION_KINDS = [
  'welfare_check_due',
  'cpd_expiry_warning',
  'replacement_sla_warning',
  'placement_activated',
  'placement_suspended',
  'invoice_overdue_day1',
  'invoice_overdue_day7',
  'invoice_overdue_day14_admin',
  'payment_failed',
  'subscription_cancelled',
  'identity_verified',
  'welfare_report_monthly',
  'welfare_escalation_opened',
  'welfare_escalation_overdue',
  'contract_amended',
  'contract_renewal_due',
  'partnership_lapsed',
  'saved_search_new_matches',
  'worker_shortlisted',
  'cpd_action_needed',
  'background_check_attention',
  'profile_resubmitted',
  'job_post_approved',
  'job_post_revision_requested',
  'job_application_received',
  'interview_requested',
  'interview_confirmed',
  'worker_job_match',
  'employer_verification_pending',
  'employer_verification_approved',
  'employer_verification_rejected',
  'email_verification',
  'rate_worker',
  'worker_payout_paid',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_CHANNELS = ['EMAIL', 'SMS', 'IN_APP'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED', 'READ'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

// Kinds that cannot be opted out of (safety / legal / admin escalation)
export const FORCED_KINDS = [
  'placement_suspended',
  'replacement_sla_warning',
  'invoice_overdue_day14_admin',
  'identity_verified',
  'background_check_attention',
  'welfare_escalation_opened',
  'welfare_escalation_overdue',
  'contract_renewal_due',
  'partnership_lapsed',
  'email_verification',
] as const;
export type ForcedKind = (typeof FORCED_KINDS)[number];

export function isForcedKind(kind: string): boolean {
  return (FORCED_KINDS as readonly string[]).includes(kind);
}

export interface TemplateVariableMeta {
  name: string;
  sample: string;
}
export interface TemplateKindMeta {
  label: string;
  variables: TemplateVariableMeta[];
}

/**
 * Human label + the `{{token}}` variables (with sample values) available to each notification
 * kind's template. Kept in sync with the per-kind `buildContext` outputs in the backend
 * notifications templates. Drives the admin editor's variable chips and the live preview samples.
 */
export const NOTIFICATION_TEMPLATE_META: Record<NotificationKind, TemplateKindMeta> = {
  identity_verified: { label: 'Identity verified', variables: [{ name: 'name', sample: 'Amara' }] },
  profile_resubmitted: {
    label: 'Verified profile resubmitted (admin)',
    variables: [{ name: 'worker', sample: 'Amara Obi' }],
  },
  worker_shortlisted: { label: 'Worker shortlisted', variables: [] },
  cpd_action_needed: { label: 'CPD action needed', variables: [] },
  background_check_attention: { label: 'Background check needs attention', variables: [] },
  welfare_check_due: {
    label: 'Welfare check due',
    variables: [{ name: 'placement', sample: 'a1b2c3d4' }],
  },
  cpd_expiry_warning: {
    label: 'CPD expiry warning',
    variables: [{ name: 'days', sample: '60' }],
  },
  replacement_sla_warning: {
    label: 'Replacement SLA warning (admin)',
    variables: [{ name: 'hours', sample: '24' }],
  },
  placement_activated: {
    label: 'Placement activated',
    variables: [{ name: 'name', sample: 'Amara Obi' }],
  },
  placement_suspended: {
    label: 'Placement suspended',
    variables: [{ name: 'reason', sample: 'safeguarding flag' }],
  },
  invoice_overdue_day1: {
    label: 'Invoice overdue (day 1)',
    variables: [{ name: 'inv', sample: 'a1b2c3d4' }],
  },
  invoice_overdue_day7: {
    label: 'Invoice overdue (day 7)',
    variables: [{ name: 'inv', sample: 'a1b2c3d4' }],
  },
  invoice_overdue_day14_admin: {
    label: 'Invoice overdue (day 14, admin)',
    variables: [
      { name: 'inv', sample: 'a1b2c3d4' },
      { name: 'employer', sample: 'Lagos Crèche Ltd' },
    ],
  },
  payment_failed: {
    label: 'Payment failed',
    variables: [{ name: 'inv', sample: 'a1b2c3d4' }],
  },
  welfare_report_monthly: {
    label: 'Monthly welfare report',
    variables: [
      { name: 'recipient', sample: 'Mrs Okafor' },
      { name: 'wellbeing', sample: 'STABLE' },
    ],
  },
  welfare_escalation_opened: {
    label: 'Welfare escalation opened (admin)',
    variables: [
      { name: 'severity', sample: 'AMBER' },
      { name: 'placement', sample: 'a1b2c3d4' },
    ],
  },
  welfare_escalation_overdue: {
    label: 'Welfare escalation overdue (admin)',
    variables: [{ name: 'placement', sample: 'a1b2c3d4' }],
  },
  contract_amended: {
    label: 'Contract amended',
    variables: [{ name: 'contract', sample: 'a1b2c3d4' }],
  },
  contract_renewal_due: {
    label: 'Partnership renewal due',
    variables: [
      { name: 'contract', sample: 'a1b2c3d4' },
      { name: 'days', sample: '60' },
    ],
  },
  partnership_lapsed: {
    label: 'Partnership lapsed (admin)',
    variables: [
      { name: 'contract', sample: 'a1b2c3d4' },
      { name: 'employer', sample: 'Lagos Crèche Ltd' },
    ],
  },
  saved_search_new_matches: {
    label: 'Saved search — new matches',
    variables: [
      { name: 'name', sample: 'Live-in caregivers, Lagos' },
      { name: 'total', sample: '3' },
      { name: 'workerPlural', sample: 's' },
      { name: 'matchPlural', sample: 'es' },
    ],
  },
  subscription_cancelled: { label: 'Subscription cancelled', variables: [] },
  job_post_approved: {
    label: 'Job posting approved',
    variables: [{ name: 'title', sample: 'Certified Caregiver' }],
  },
  job_post_revision_requested: {
    label: 'Job posting revision requested',
    variables: [
      { name: 'title', sample: 'Certified Caregiver' },
      { name: 'notes', sample: 'Please add the shift pattern.' },
    ],
  },
  job_application_received: {
    label: 'Job application received',
    variables: [
      { name: 'title', sample: 'Certified Caregiver' },
      { name: 'worker', sample: 'Amara Obi' },
    ],
  },
  interview_requested: {
    label: 'Interview requested',
    variables: [{ name: 'employer', sample: 'Lagos Crèche Ltd' }],
  },
  interview_confirmed: {
    label: 'Interview confirmed',
    variables: [{ name: 'when', sample: '15 Jul 2026, 10:00' }],
  },
  employer_verification_pending: {
    label: 'Employer awaiting verification (admin)',
    variables: [{ name: 'org', sample: 'Lagos Crèche Ltd' }],
  },
  employer_verification_approved: {
    label: 'Employer verified',
    variables: [{ name: 'org', sample: 'Lagos Crèche Ltd' }],
  },
  employer_verification_rejected: {
    label: 'Employer verification rejected',
    variables: [{ name: 'notes', sample: 'CAC number could not be confirmed.' }],
  },
  worker_job_match: {
    label: 'Worker job match',
    variables: [
      { name: 'title', sample: 'Certified Caregiver' },
      { name: 'org', sample: 'Lagos Crèche Ltd' },
    ],
  },
  email_verification: {
    label: 'Email verification',
    variables: [
      { name: 'name', sample: 'Amara' },
      { name: 'link', sample: 'https://jobs.oakvaleltd.com/verify-email?token=abc123' },
    ],
  },
  rate_worker: {
    label: 'Rate your worker',
    variables: [{ name: 'worker', sample: 'Amara Obi' }],
  },
  worker_payout_paid: {
    label: 'Payout paid',
    variables: [
      { name: 'amount', sample: '₦150,000' },
      { name: 'period', sample: 'June 2026' },
    ],
  },
};
