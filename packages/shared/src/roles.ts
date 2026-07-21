// `EMPLOYER` is the unified employer role (§5 decouple). `INDIVIDUAL_EMPLOYER` and
// `EMPLOYER_CORPORATE` are retained as legacy aliases so existing JWTs/sessions keep
// working; treat all three as "an employer" via `isEmployerRole`.
export const ROLES = [
  'WORKER',
  'EMPLOYER',
  'INDIVIDUAL_EMPLOYER',
  'EMPLOYER_CORPORATE',
  'AGENT',
  'ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

/** Every role that denotes an employer (unified + legacy). */
export const EMPLOYER_ROLES = ['EMPLOYER', 'INDIVIDUAL_EMPLOYER', 'EMPLOYER_CORPORATE'] as const;
export type EmployerRole = (typeof EMPLOYER_ROLES)[number];

export function isEmployerRole(role: string | null | undefined): role is EmployerRole {
  return role === 'EMPLOYER' || role === 'INDIVIDUAL_EMPLOYER' || role === 'EMPLOYER_CORPORATE';
}

// New employer signups use the unified `EMPLOYER` role; the employer *type* is chosen
// separately (configurable entity), not encoded in the role.
export const PUBLIC_SIGNUP_ROLES = ['WORKER', 'EMPLOYER'] as const;
export type PublicSignupRole = (typeof PUBLIC_SIGNUP_ROLES)[number];
