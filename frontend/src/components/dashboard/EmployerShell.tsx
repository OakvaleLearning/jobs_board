'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  ClipboardList,
  CreditCard,
  Inbox,
  LayoutDashboard,
  Settings,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import { employersApi, type EmployerTypeConfig } from '@/lib/employers-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { DashboardShell, type NavItem } from './Shell';

/**
 * The employer dashboard nav is built entirely from the configurable employer-type
 * config (derived flags), so a brand-new type gets a sensible, generic dashboard with
 * no code change. All routes live under the unified `/employer/*` set.
 */
export function buildEmployerNav(
  config: EmployerTypeConfig | null | undefined,
  approved = true,
): NavItem[] {
  const nav: NavItem[] = [
    { href: '/employer/dashboard', label: 'Overview', icon: LayoutDashboard },
  ];

  if (config?.usesIndividualEmployerNeeds) {
    nav.push({ href: '/employer/needs-assessment', label: 'Care assessment', icon: ClipboardList });
  } else if (config?.usesCorporateNeeds) {
    nav.push({ href: '/employer/needs-assessment', label: 'Workforce needs', icon: ClipboardList });
  }

  // §6.2 — searching/hiring is locked until an agent verifies the employer.
  if (config?.jobPostingEnabled) {
    nav.push({ href: '/employer/jobs', label: 'Job postings', icon: Briefcase, locked: !approved });
  }

  nav.push({ href: '/employer/workers', label: 'Browse workers', icon: Users, locked: !approved });

  if (config?.isAccountManaged) {
    nav.push({ href: '/employer/shortlist', label: 'Shortlist', icon: Sparkles });
    nav.push({ href: '/employer/placement', label: 'Placement', icon: UserPlus });
  }
  if (config?.jobPostingEnabled) {
    nav.push({ href: '/employer/team', label: 'Placed team', icon: Users });
  }

  nav.push(
    { href: '/employer/billing', label: 'Billing', icon: CreditCard },
    { href: '/employer/notifications', label: 'Inbox', icon: Inbox },
    { href: '/employer/profile', label: 'My profile', icon: UserCog },
    { href: '/employer/settings/notifications', label: 'Settings', icon: Settings },
  );
  return nav;
}

export function EmployerShell({
  config,
  children,
}: {
  config: EmployerTypeConfig | null | undefined;
  children: ReactNode;
}) {
  const hydrated = useHydratedTokens();
  const profile = useQuery({ queryKey: ['employerProfile'], queryFn: employersApi.me, enabled: hydrated });
  const status = profile.data?.verificationStatus;
  const approved = status === 'APPROVED';
  const surface = config?.name ? `${config.name} · jobs portal` : 'Employer · jobs portal';
  return (
    <DashboardShell surface={surface} nav={buildEmployerNav(config, approved)}>
      {status && status !== 'APPROVED' ? <VerificationBanner status={status} notes={profile.data?.verificationNotes ?? null} /> : null}
      {children}
    </DashboardShell>
  );
}

function VerificationBanner({ status, notes }: { status: 'PENDING' | 'REJECTED'; notes: string | null }) {
  const rejected = status === 'REJECTED';
  return (
    <div
      className={
        'mb-6 rounded-2xl border px-5 py-4 ' +
        (rejected ? 'border-terracotta-500/40 bg-terracotta-500/5' : 'border-ink/12 bg-cream-50')
      }
    >
      <p className="text-sm font-medium text-ink">
        {rejected ? 'Your registration needs attention' : 'Your account is awaiting verification'}
      </p>
      <p className="text-sm text-ink-600 mt-1">
        {rejected
          ? `An Oakvale agent could not verify your account yet${notes ? `: ${notes}` : '.'} Your account manager will be in touch.`
          : 'An Oakvale agent is reviewing your registration. Searching and hiring unlock once you’re approved, usually within 2 working days.'}
      </p>
    </div>
  );
}
