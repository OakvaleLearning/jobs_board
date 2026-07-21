import type { Role } from '@oakvale/shared/roles';

/**
 * Where each role lands after login / "go to dashboard". Shared by the login
 * redirect and the marketing header so they never drift apart.
 */
export const ROLE_LANDING: Record<string, string> = {
  WORKER: '/worker/dashboard',
  // §5: all employer roles land on the unified dashboard, which (and onboarding)
  // renders generically from the configurable employer-type config.
  EMPLOYER: '/employer/dashboard',
  INDIVIDUAL_EMPLOYER: '/employer/dashboard',
  EMPLOYER_CORPORATE: '/employer/dashboard',
  ADMIN: '/admin',
  AGENT: '/admin',
};

export function homeForRole(role?: Role | string | null): string {
  if (!role) return '/';
  return ROLE_LANDING[role] ?? '/';
}
