import {
  Bell,
  Briefcase,
  HeartHandshake,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { NOTIFICATION_TEMPLATE_META } from '@oakvale/shared/enums/notifications';

/**
 * Central presentation map for notification kinds — label / category / icon / tone — so the inbox
 * and the preferences grid stay visually consistent. Mirrors the `field-icons.ts` idiom.
 *
 * Categories are ordered; any kind not listed falls into a trailing "Other" group, so adding a new
 * kind to the enum never silently disappears.
 */
export type NotificationTone = 'sage' | 'teal' | 'brand' | 'amber' | 'neutral';

export interface NotificationCategory {
  title: string;
  icon: LucideIcon;
  tone: NotificationTone;
  kinds: string[];
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    title: 'Placements & welfare',
    icon: HeartHandshake,
    tone: 'sage',
    kinds: [
      'welfare_check_due',
      'welfare_report_monthly',
      'welfare_escalation_opened',
      'welfare_escalation_overdue',
      'placement_activated',
      'placement_suspended',
      'replacement_sla_warning',
      'rate_worker',
    ],
  },
  {
    title: 'Compliance & verification',
    icon: ShieldCheck,
    tone: 'teal',
    kinds: [
      'identity_verified',
      'cpd_expiry_warning',
      'cpd_action_needed',
      'background_check_attention',
      'profile_resubmitted',
      'email_verification',
      'employer_verification_pending',
      'employer_verification_approved',
      'employer_verification_rejected',
    ],
  },
  {
    title: 'Jobs & hiring',
    icon: Briefcase,
    tone: 'brand',
    kinds: [
      'job_post_approved',
      'job_post_revision_requested',
      'job_application_received',
      'interview_requested',
      'interview_confirmed',
      'worker_job_match',
      'worker_shortlisted',
      'saved_search_new_matches',
    ],
  },
  {
    title: 'Billing & contracts',
    icon: Receipt,
    tone: 'amber',
    kinds: [
      'invoice_overdue_day1',
      'invoice_overdue_day7',
      'invoice_overdue_day14_admin',
      'payment_failed',
      'subscription_cancelled',
      'contract_amended',
      'contract_renewal_due',
      'partnership_lapsed',
      'worker_payout_paid',
    ],
  },
];

const OTHER: NotificationCategory = { title: 'Other', icon: Bell, tone: 'neutral', kinds: [] };

const BY_KIND = new Map<string, NotificationCategory>();
for (const category of NOTIFICATION_CATEGORIES) {
  for (const kind of category.kinds) BY_KIND.set(kind, category);
}

export function labelForKind(kind: string): string {
  return NOTIFICATION_TEMPLATE_META[kind as keyof typeof NOTIFICATION_TEMPLATE_META]?.label ?? kind;
}

export function categoryForKind(kind: string): NotificationCategory {
  return BY_KIND.get(kind) ?? OTHER;
}

export function iconForKind(kind: string): LucideIcon {
  return categoryForKind(kind).icon;
}

export function toneForKind(kind: string): NotificationTone {
  return categoryForKind(kind).tone;
}

/** Tailwind classes for a tinted icon-avatar, keyed by tone. */
export const TONE_AVATAR_CLASSES: Record<NotificationTone, string> = {
  sage: 'bg-sage-100 text-sage-600',
  teal: 'bg-teal-100 text-teal-700',
  brand: 'bg-brand-100 text-brand-700',
  amber: 'bg-amber-100 text-amber-700',
  neutral: 'bg-ink/5 text-ink',
};
