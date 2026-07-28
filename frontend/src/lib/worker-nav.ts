/** Single source of truth for the worker portal sidebar/nav. */
import {
  Award,
  Briefcase,
  CalendarCheck,
  FileSignature,
  FileText,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserCircle,
  UserCog,
} from 'lucide-react';
import type { NavItem } from '@/components/dashboard/Shell';

export const WORKER_NAV: NavItem[] = [
  { href: '/worker/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/worker/profile', label: 'My profile', icon: UserCircle },
  { href: '/worker/verification', label: 'Verification', icon: ShieldCheck },
  { href: '/worker/compliance', label: 'CPD & compliance', icon: Award },
  { href: '/worker/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/worker/interviews', label: 'Interviews', icon: CalendarCheck },
  { href: '/worker/offers', label: 'Offers', icon: Sparkles },
  { href: '/worker/contracts', label: 'Contracts', icon: FileSignature },
  { href: '/worker/placements', label: 'Placements', icon: FileText },
  { href: '/worker/messages', label: 'Messages', icon: MessageSquare },
  { href: '/worker/complaints', label: 'Complaints', icon: TriangleAlert },
  { href: '/worker/account', label: 'Account', icon: UserCog },
];
