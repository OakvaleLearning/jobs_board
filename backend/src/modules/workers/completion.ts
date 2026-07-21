import type { WorkerSection } from '@oakvale/shared/enums/worker.js';

export const SECTION_WEIGHTS: Record<WorkerSection, number> = {
  A: 8,
  B: 16, // identity — double-weighted
  C: 4,
  D: 6,
  E: 16, // experience — double-weighted
  F: 6,
  G: 8,
  H: 0, // skills & specialization — withheld from caregivers (brief §4), no longer scored
  I: 6,
  J: 2,
  K: 6,
  L: 4,
};

const TOTAL = Object.values(SECTION_WEIGHTS).reduce((a, b) => a + b, 0);

export interface CompletionAggregate {
  personalInfo: { fullName: string | null; dob: unknown; address: string | null; phone: string | null } | null;
  identity: { idType: unknown; idNumber: string | null; idDocumentId: unknown; selfieId: unknown } | null;
  consent: { consentGiven: boolean } | null;
  education: { id: string }[];
  experience: { id: string }[];
  references: { id: string }[];
  skills: { id: string }[];
  preferences: { employmentType?: unknown; availabilityStart?: unknown } | null;
  salary: { wageStructure: unknown; minRate: unknown } | null;
  extras: {
    personalStatement: string | null;
    videoIntroDocumentId: unknown;
    cpdEnrolled: boolean;
    oakvaleProgrammeAcknowledged: boolean;
  };
}

export type SectionStatus = Record<WorkerSection, boolean>;

export function evaluateSections(agg: CompletionAggregate): SectionStatus {
  return {
    A: Boolean(
      agg.personalInfo?.fullName &&
        agg.personalInfo.dob &&
        agg.personalInfo.address &&
        agg.personalInfo.phone,
    ),
    B: Boolean(
      agg.identity?.idType &&
        agg.identity.idNumber &&
        agg.identity.idDocumentId &&
        agg.identity.selfieId,
    ),
    C: Boolean(agg.consent?.consentGiven),
    D: agg.education.length >= 1,
    E: agg.experience.length >= 1,
    F: agg.references.length >= 1,
    G: Boolean(agg.preferences?.employmentType && agg.preferences.availabilityStart),
    // Withheld from caregivers (brief §4) — not gating; weight is 0.
    H: true,
    I: Boolean(agg.extras?.personalStatement && agg.extras.personalStatement.length >= 40),
    J: Boolean(agg.extras?.videoIntroDocumentId),
    K: Boolean(agg.salary?.wageStructure && agg.salary.minRate !== null),
    L: Boolean(agg.extras?.cpdEnrolled || agg.extras?.oakvaleProgrammeAcknowledged),
  };
}

export function calculateCompletionPct(status: SectionStatus): number {
  const earned = (Object.keys(SECTION_WEIGHTS) as WorkerSection[]).reduce(
    (sum, s) => sum + (status[s] ? SECTION_WEIGHTS[s] : 0),
    0,
  );
  return Math.round((earned / TOTAL) * 100);
}
