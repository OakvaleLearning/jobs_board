// PRD §3 agent roles: BDM, Recruiter, Liaison Nurse, Account Manager, Admin.
// 'GENERAL' is deprecated (legacy rows are migrated to 'ADMIN'); kept in the enum
// only because Postgres cannot drop an enum value from a live type. Do not offer it
// in the admin UI — see AGENT_SPECIALTY_OPTIONS.
export const AGENT_SPECIALTIES = [
  'BDM',
  'RECRUITER',
  'LIAISON_NURSE',
  'ACCOUNT_MANAGER',
  'ADMIN',
  'GENERAL',
] as const;
export type AgentSpecialty = (typeof AGENT_SPECIALTIES)[number];

/** Selectable agent specialties (excludes the deprecated GENERAL). */
export const AGENT_SPECIALTY_OPTIONS = [
  'BDM',
  'RECRUITER',
  'LIAISON_NURSE',
  'ACCOUNT_MANAGER',
  'ADMIN',
] as const satisfies readonly AgentSpecialty[];

export const AGENT_SPECIALTY_LABELS: Record<AgentSpecialty, string> = {
  BDM: 'Business Development Manager',
  RECRUITER: 'Recruiter',
  LIAISON_NURSE: 'Liaison Nurse',
  ACCOUNT_MANAGER: 'Account Manager',
  ADMIN: 'Admin',
  GENERAL: 'General (legacy)',
};

export const ASSIGNMENT_ROLES = ['PRIMARY', 'SHADOW', 'COVERING'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

/**
 * Admin sidebar queues that show a "new since you last opened it" count bubble.
 * Shared between the backend counts endpoint (allow-list for GET/POST /admin/nav-counts)
 * and the frontend AdminShell (each nav link tags itself with its `countKey`).
 */
export const ADMIN_NAV_KEYS = [
  'verification',
  'employer-verification',
  'background-checks',
  'certifications',
  'job-review',
  'offers',
  'interviews',
  'complaints',
  'messaging',
  'replacements',
  'welfare-escalations',
  'contracts-renewals',
  'compliance-flags',
] as const;
export type AdminNavKey = (typeof ADMIN_NAV_KEYS)[number];
