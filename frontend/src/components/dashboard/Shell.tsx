'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Lockup } from '@/components/brand/Lockup';
import { Badge } from '@/components/ui/Badge';
import { InboxBell } from '@/components/dashboard/InboxBell';
import { useAuth, useSignOut, type AuthUser } from '@/lib/auth-store';
import type { Role } from '@oakvale/shared/roles';
import { adminApi } from '@/lib/admin-api';
import { api, hydrateTokens } from '@/lib/api-client';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { cn } from '@/lib/cn';

const NAV_OPEN_STORAGE_KEY = 'oak_nav_open';

export interface NavItem {
  href: string;
  label: string;
  /** Leading icon shown beside the label. */
  icon?: LucideIcon;
  /** Item is gated behind admin/agent validation — shown disabled with an "Awaiting approval" tag. */
  locked?: boolean;
  /** If set, the item is shown only to these roles. Undefined = visible to all. */
  roles?: Role[];
  /**
   * If set, the link shows a "new since you last opened it" count bubble driven by
   * GET /admin/nav-counts, keyed by this value (an ADMIN_NAV_KEY). Clicking the link
   * clears it. Admin sidebar only.
   */
  countKey?: string;
}

export interface NavGroup {
  heading?: string;
  icon?: LucideIcon;
  items: NavItem[];
}

function isGrouped(nav: NavItem[] | NavGroup[]): nav is NavGroup[] {
  const first = nav[0];
  return first !== undefined && 'items' in first;
}

export function DashboardShell({
  surface,
  nav,
  children,
}: {
  surface: string;
  nav: NavItem[] | NavGroup[];
  children: ReactNode;
}) {
  const allGroups: NavGroup[] = isGrouped(nav) ? nav : [{ items: nav }];
  const pathname = usePathname();
  const role = useAuth((s) => s.user?.role);
  const hydrated = useHydratedTokens();
  const isAdminSurface = pathname?.startsWith('/admin') ?? false;

  // "New since last visit" counts for admin sidebar queues. Cheap poll like InboxBell;
  // gated to the admin surface so it never fires on worker/employer shells.
  const navCounts = useQuery({
    queryKey: ['adminNavCounts'],
    queryFn: adminApi.navCounts,
    enabled: hydrated && isAdminSurface,
    refetchInterval: 60_000,
  });
  const queryClient = useQueryClient();
  const markSeen = useMutation({
    mutationFn: (key: string) => adminApi.markNavSeen(key),
    onMutate: (key: string) => {
      // Optimistically clear the bubble; the click already routes to the page.
      queryClient.setQueryData<Record<string, number>>(['adminNavCounts'], (prev) =>
        prev ? { ...prev, [key]: 0 } : prev,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['adminNavCounts'] }),
  });

  // Show each item only to the role(s) it concerns (undefined roles = everyone).
  // Drop any group left with no visible items.
  const groups: NavGroup[] = allGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => !it.roles || (role !== undefined && it.roles.includes(role))),
    }))
    .filter((g) => g.items.length > 0);

  // The heading of the group containing the current page — open by default.
  const activeHeading = groups.find((g) => g.items.some((it) => it.href === pathname))?.heading;

  // Manual open/close overrides, persisted across navigations. Starts empty on
  // both server and first client render to avoid hydration mismatch; localStorage
  // is merged in after mount.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(NAV_OPEN_STORAGE_KEY);
      if (saved) setOpenOverrides(JSON.parse(saved) as Record<string, boolean>);
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const isOpen = (heading: string) => openOverrides[heading] ?? heading === activeHeading;

  const toggleGroup = (heading: string) => {
    setOpenOverrides((prev) => {
      const next = { ...prev, [heading]: !(prev[heading] ?? heading === activeHeading) };
      try {
        window.localStorage.setItem(NAV_OPEN_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const inboxHref = pathname?.startsWith('/admin')
    ? '/admin/notifications'
    : pathname?.startsWith('/employer')
      ? '/employer/notifications'
      : '/worker/notifications';
  const user = useAuth((s) => s.user);
  const signOut = useSignOut();

  useEffect(() => {
    hydrateTokens();
    if (typeof window === 'undefined') return;
    const haveTokens = Boolean(window.localStorage.getItem('oak_tokens'));
    if (haveTokens && !useAuth.getState().user) {
      api
        .get<{ data: { user: AuthUser } }>('/auth/me')
        .then((r) => useAuth.setState({ user: r.data.user }))
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen grid md:grid-cols-[260px_1fr]">
      <aside className="hidden md:flex flex-col gap-8 border-r border-ink/8 p-6 bg-white">
        <div className="flex items-center justify-between">
          <Lockup size="md" />
          <InboxBell inboxHref={inboxHref} />
        </div>
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 text-eyebrow font-semibold text-brand-600">
            <span className="h-1.5 w-6 rounded-full bg-brand-500" />
            {surface}
          </p>
          {groups.map((group, gi) => {
            const open = group.heading ? isOpen(group.heading) : true;
            const Icon = group.icon;
            return (
              <div key={group.heading ?? gi}>
                {group.heading ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.heading!)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-eyebrow text-ink-600 hover:bg-brand-50 transition"
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0 text-brand-500" /> : null}
                    <span className="flex-1 text-left">{group.heading}</span>
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
                    />
                  </button>
                ) : null}
                {open ? (
                  <ul className={cn('space-y-1', group.heading && 'mt-1')}>
                    {group.items.map((item) => {
                      const active = pathname === item.href;
                      const ItemIcon = item.icon;
                      const count = item.countKey ? (navCounts.data?.[item.countKey] ?? 0) : 0;
                      const showBubble = !item.locked && !active && count > 0;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.locked ? '#' : item.href}
                            onClick={() => {
                              if (item.countKey && !item.locked) markSeen.mutate(item.countKey);
                            }}
                            aria-disabled={item.locked}
                            title={
                              item.locked
                                ? 'Requires admin validation — unlocks once an Oakvale agent approves your account.'
                                : undefined
                            }
                            className={cn(
                              'flex items-center justify-between rounded-xl px-3 py-2 text-sm transition',
                              group.heading && 'pl-9',
                              active
                                ? 'bg-brand-500 text-white font-medium shadow-card'
                                : 'text-ink-600 hover:bg-brand-50 hover:text-brand-700',
                              item.locked && 'opacity-60 cursor-not-allowed',
                            )}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              {ItemIcon ? (
                                <ItemIcon
                                  className={cn(
                                    'h-4 w-4 shrink-0',
                                    active ? 'text-white' : 'text-brand-500',
                                  )}
                                />
                              ) : null}
                              <span className="truncate">{item.label}</span>
                            </span>
                            {item.locked ? (
                              <span className="text-eyebrow text-amber-700">
                                Awaiting approval
                              </span>
                            ) : showBubble ? (
                              <span
                                aria-label={`${count} new`}
                                className={cn(
                                  'ml-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-medium flex items-center justify-center shrink-0',
                                  active ? 'bg-white text-brand-600' : 'bg-brand-500 text-white',
                                )}
                              >
                                {count > 99 ? '99+' : count}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-auto space-y-3 text-xs text-muted">
          {user ? (
            <div>
              <p className="text-ink-600 font-medium text-sm truncate">{user.fullName}</p>
              <p className="truncate">{user.email}</p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-3 text-ink-600 hover:text-ink underline underline-offset-4 decoration-ink/20"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="underline underline-offset-4">Sign in</Link>
          )}
        </div>
      </aside>

      <div>
        <div className="md:hidden border-b border-ink/8 px-6 h-14 flex items-center justify-between">
          <Lockup size="sm" />
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{surface}</Badge>
            <InboxBell inboxHref={inboxHref} />
          </div>
        </div>
        <main className="p-6 md:p-10 lg:p-14">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
      <div className="space-y-2 max-w-2xl">
        {eyebrow ? (
          <p className="inline-flex items-center gap-2 text-eyebrow text-brand-600">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="h-display text-ink text-xl md:text-3xl leading-tight">{title}</h1>
        {description ? <p className="text-ink-600 max-w-xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
