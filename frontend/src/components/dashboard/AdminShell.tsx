'use client';

import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileCheck,
  FileText,
  Flag,
  Gauge,
  HeartPulse,
  Layers,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquareWarning,
  Repeat,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { DashboardShell, type NavGroup } from './Shell';
import type { ReactNode } from 'react';

export const ADMIN_NAV: NavGroup[] = [
  {
    heading: 'Overview',
    icon: LayoutDashboard,
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/admin/kpis', label: 'KPIs', icon: Gauge },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    heading: 'People',
    icon: Users,
    items: [
      { href: '/admin/workers', label: 'Workers', icon: Users },
      { href: '/admin/employers', label: 'Employers', icon: Building2 },
      { href: '/admin/employer-verification', label: 'Employer verification', icon: BadgeCheck, countKey: 'employer-verification' },
      { href: '/admin/agents', label: 'Agents', icon: UserCog, roles: ['ADMIN'] },
    ],
  },
  {
    heading: 'Vetting & compliance',
    icon: ShieldCheck,
    items: [
      { href: '/admin/verification', label: 'Verification queue', icon: ClipboardCheck, countKey: 'verification' },
      { href: '/admin/background-checks', label: 'Background checks', icon: ShieldCheck, countKey: 'background-checks' },
      { href: '/admin/certifications', label: 'Certificate cross-check', icon: Award, countKey: 'certifications' },
      { href: '/admin/compliance/flags', label: 'Compliance flags', icon: Flag, countKey: 'compliance-flags' },
    ],
  },
  {
    heading: 'Placements',
    icon: Briefcase,
    items: [
      { href: '/admin/shortlists', label: 'Shortlists', icon: ListChecks },
      { href: '/admin/offers', label: 'Offer review queue', icon: Sparkles, countKey: 'offers' },
      { href: '/admin/interviews', label: 'Interviews', icon: CalendarCheck, countKey: 'interviews' },
      { href: '/admin/placements', label: 'Placements', icon: Briefcase },
      { href: '/admin/replacements', label: 'Replacements', icon: Repeat, countKey: 'replacements' },
      { href: '/admin/welfare-escalations', label: 'Welfare escalations', icon: HeartPulse, countKey: 'welfare-escalations' },
    ],
  },
  {
    heading: 'Contracts',
    icon: FileText,
    items: [
      { href: '/admin/contracts', label: 'Contracts', icon: FileText },
      { href: '/admin/contract-templates', label: 'Contract templates', icon: FileCheck, roles: ['ADMIN'] },
      { href: '/admin/contracts/renewals', label: 'Renewals due', icon: CalendarCheck, countKey: 'contracts-renewals' },
    ],
  },
  {
    heading: 'Jobs & catalog',
    icon: Layers,
    items: [
      { href: '/admin/job-review', label: 'Job post review', icon: ClipboardList, countKey: 'job-review' },
      { href: '/admin/workforce-categories', label: 'Workforce categories', icon: Tags, roles: ['ADMIN'] },
      { href: '/admin/employer-types', label: 'Employer types', icon: Layers, roles: ['ADMIN'] },
    ],
  },
  {
    heading: 'Trust & safety',
    icon: ShieldAlert,
    items: [
      { href: '/admin/complaints', label: 'Complaints', icon: AlertTriangle, countKey: 'complaints' },
      { href: '/admin/messaging', label: 'Flagged messages', icon: MessageSquareWarning, countKey: 'messaging' },
    ],
  },
  {
    heading: 'Finance & system',
    icon: Wallet,
    items: [
      { href: '/admin/finance', label: 'Finance', icon: Coins, roles: ['ADMIN'] },
      { href: '/admin/audit-log', label: 'Audit log', icon: ScrollText, roles: ['ADMIN'] },
      { href: '/admin/notifications', label: 'Inbox', icon: Bell },
      { href: '/admin/notification-templates', label: 'Notification templates', icon: Mail, roles: ['ADMIN'] },
      { href: '/admin/settings/notifications', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell surface="Admin · operations" nav={ADMIN_NAV}>
      {children}
    </DashboardShell>
  );
}
