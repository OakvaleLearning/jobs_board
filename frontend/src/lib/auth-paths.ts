// Route prefixes that require authentication. Shared by the edge middleware and
// the API client, so the "needs auth → go to /login" rule lives in one place.
// Framework-agnostic — no React/zustand imports.
export const PROTECTED_PREFIXES = ['/worker', '/employer', '/admin'] as const;

/** True if the path sits under an authenticated area. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
