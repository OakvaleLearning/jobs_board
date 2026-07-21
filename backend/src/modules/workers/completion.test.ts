import { describe, it, expect } from 'vitest';
import { calculateCompletionPct, evaluateSections, type CompletionAggregate } from './completion.js';

const empty: CompletionAggregate = {
  personalInfo: null,
  identity: null,
  consent: null,
  education: [],
  experience: [],
  references: [],
  skills: [],
  preferences: null,
  salary: null,
  extras: { personalStatement: null, videoIntroDocumentId: null, cpdEnrolled: false, oakvaleProgrammeAcknowledged: false },
};

describe('worker completion', () => {
  it('returns 0% for an empty profile', () => {
    expect(calculateCompletionPct(evaluateSections(empty))).toBe(0);
  });

  it('returns 100% when every section is satisfied', () => {
    const full: CompletionAggregate = {
      personalInfo: { fullName: 'Ada', dob: '1990-01-01', address: 'Lagos', phone: '+234' },
      identity: { idType: 'NIN', idNumber: '12345', idDocumentId: 'd1', selfieId: 's1' },
      consent: { consentGiven: true },
      education: [{ id: 'e1' }],
      experience: [{ id: 'x1' }],
      references: [{ id: 'r1' }],
      skills: [{ id: 'sk1' }],
      preferences: { employmentType: 'FULL_TIME', availabilityStart: '2026-07-01' },
      salary: { wageStructure: 'MONTHLY', minRate: '50000' },
      extras: {
        personalStatement: 'x'.repeat(60),
        videoIntroDocumentId: 'v1',
        cpdEnrolled: true,
        oakvaleProgrammeAcknowledged: true,
      },
    };
    expect(calculateCompletionPct(evaluateSections(full))).toBe(100);
  });

  it('weights identity and experience more heavily than other sections', () => {
    const status = evaluateSections(empty);
    status.A = true;
    const pctOnlyA = calculateCompletionPct(status);

    const status2 = evaluateSections(empty);
    status2.B = true;
    const pctOnlyB = calculateCompletionPct(status2);

    expect(pctOnlyB).toBeGreaterThan(pctOnlyA);
  });

  it('does not score the withheld skills section (brief §4)', () => {
    // Section H is always "satisfied" but carries zero weight, so it never
    // moves the needle — an otherwise-empty profile stays at 0%.
    const status = evaluateSections(empty);
    expect(status.H).toBe(true);
    expect(calculateCompletionPct(status)).toBe(0);
  });

  it('counts references (section F) toward completion', () => {
    const status = evaluateSections(empty);
    expect(status.F).toBe(false);
    const withRefs = evaluateSections({ ...empty, references: [{ id: 'r1' }] });
    expect(withRefs.F).toBe(true);
    expect(calculateCompletionPct(withRefs)).toBeGreaterThan(0);
  });

  it('requires a personal statement of at least 40 characters', () => {
    const short: CompletionAggregate = {
      ...empty,
      extras: { personalStatement: 'too short', videoIntroDocumentId: null, cpdEnrolled: false, oakvaleProgrammeAcknowledged: false },
    };
    expect(evaluateSections(short).I).toBe(false);
  });
});
