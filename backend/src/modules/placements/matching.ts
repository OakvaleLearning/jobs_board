/**
 * Pure matching algorithm. Takes pre-fetched candidates + assessment context
 * (no DB access). Used by PlacementService.generateShortlist.
 */

export interface CandidateInput {
  workerId: string;
  fullName: string | null;
  stateOfOrigin: string | null;
  employmentType: string | null;
  preferredCities: string[];
  relocationWillingness: boolean | null;
  availabilityStart: string | null;
  skills: { name: string; category: string | null; selfRating: number | null }[];
  experience: { sector: string | null; durationDays: number }[];
  /** Worker's assigned workforce category (§4). */
  workforceCategoryId?: string | null;
  oakvaleCertified: boolean;
  /** Average rating (0–5) from previous placements; 0 when the worker has none. */
  averageRating: number;
}

export interface AssessmentContext {
  pipelineType: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
  desiredCity?: string | null;
  desiredEmploymentType?: string | null;
  requiredSkills?: string[];
  preferredSector?: string | null;
  /** Target workforce category for the role. When set, candidates in the same
   * category get an experience-score bonus. (Demand-side sourcing is a follow-up —
   * job postings / needs assessments don't yet capture a category.) */
  categoryId?: string | null;
}

export interface MatchedCandidate {
  workerId: string;
  score: number;
  breakdown: {
    skills: number;
    experience: number;
    certification: number;
    rating: number;
  };
}

const WEIGHTS = { skills: 40, experience: 30, certification: 20, rating: 10 } as const;

function scoreSkills(candidate: CandidateInput, required: string[]): number {
  if (required.length === 0) return 50; // baseline when no required skills declared
  const lowerSkills = new Set(candidate.skills.map((s) => s.name.toLowerCase()));
  const matched = required.filter((r) => lowerSkills.has(r.toLowerCase())).length;
  const ratio = matched / required.length;
  return Math.round(ratio * 100);
}

function scoreExperience(candidate: CandidateInput, ctx: AssessmentContext): number {
  const totalDays = candidate.experience.reduce((sum, e) => sum + (e.durationDays || 0), 0);
  // Saturate at 5 years (1825 days)
  let score = Math.min(100, Math.round((totalDays / 1825) * 100));
  const preferredSector = ctx.preferredSector;
  if (preferredSector) {
    const sectorMatched = candidate.experience.some(
      (e) => (e.sector ?? '').toLowerCase() === preferredSector.toLowerCase(),
    );
    if (sectorMatched) score += 15;
  }
  // Strong signal: candidate is in the exact workforce category sought.
  if (ctx.categoryId && candidate.workforceCategoryId === ctx.categoryId) {
    score += 20;
  }
  return Math.min(100, score);
}

function scoreCertification(candidate: CandidateInput): number {
  return candidate.oakvaleCertified ? 100 : 0;
}

function scoreRating(candidate: CandidateInput): number {
  // averageRating is on 0-5; map to 0-100
  return Math.max(0, Math.min(100, Math.round((candidate.averageRating / 5) * 100)));
}

function passesHardFilters(candidate: CandidateInput, ctx: AssessmentContext): boolean {
  if (!candidate.oakvaleCertified) return false;
  if (ctx.desiredEmploymentType && candidate.employmentType) {
    if (
      candidate.employmentType !== ctx.desiredEmploymentType &&
      candidate.employmentType !== 'EITHER' &&
      ctx.desiredEmploymentType !== 'EITHER'
    ) {
      return false;
    }
  }
  if (ctx.desiredCity) {
    const desired = ctx.desiredCity.toLowerCase();
    const inPreferred = candidate.preferredCities.some((c) => c.toLowerCase() === desired);
    if (!inPreferred && !candidate.relocationWillingness) return false;
  }
  return true;
}

export function matchWorkers(
  candidates: CandidateInput[],
  ctx: AssessmentContext,
  topN = 5,
): MatchedCandidate[] {
  const required = ctx.requiredSkills ?? [];
  const eligible = candidates.filter((c) => passesHardFilters(c, ctx));
  const scored: MatchedCandidate[] = eligible.map((c) => {
    const s = scoreSkills(c, required);
    const e = scoreExperience(c, ctx);
    const cert = scoreCertification(c);
    const r = scoreRating(c);
    const score = Math.round(
      (s * WEIGHTS.skills + e * WEIGHTS.experience + cert * WEIGHTS.certification + r * WEIGHTS.rating) /
        100,
    );
    return { workerId: c.workerId, score, breakdown: { skills: s, experience: e, certification: cert, rating: r } };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

export const __test = { passesHardFilters, scoreSkills, scoreExperience, WEIGHTS };
