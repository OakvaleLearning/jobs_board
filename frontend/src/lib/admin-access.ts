// Admin-area route prefixes that only the ADMIN role may access. AGENT users are
// redirected away from these (the matching nav items are already hidden via
// `roles: ['ADMIN']` in AdminShell). Kept framework-agnostic — no React/zustand
// imports — so the edge middleware can import it too.
//
// Prefixes are chosen not to collide with agent-allowed siblings, e.g.
// `/admin/notifications` (inbox, AGENT ok) vs `/admin/notification-templates`,
// and `/admin/contracts` (AGENT ok) vs `/admin/contract-templates`.
export const ADMIN_ONLY_PREFIXES = [
  '/admin/agents',
  '/admin/contract-templates',
  '/admin/workforce-categories',
  '/admin/employer-types',
  '/admin/finance',
  '/admin/audit-log',
  '/admin/notification-templates',
  '/admin/settings',
] as const;

/** True if the path is one of the ADMIN-only admin sub-areas. */
export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
