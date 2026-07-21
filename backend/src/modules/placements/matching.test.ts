import { describe, expect, it } from 'vitest';
import { matchWorkers, type CandidateInput } from './matching.js';

const base: CandidateInput = {
  workerId: 'w1',
  fullName: 'Ada',
  stateOfOrigin: 'Lagos',
  employmentType: 'FULL_TIME',
  preferredCities: ['Lagos'],
  relocationWillingness: false,
  availabilityStart: null,
  skills: [{ name: 'Paediatric first aid', category: null, selfRating: 4 }],
  experience: [{ sector: 'Childcare', durationDays: 365 }],
  oakvaleCertified: true,
  averageRating: 4,
};

describe('placement matching', () => {
  it('excludes workers who are not Oakvale certified', () => {
    const cands = [{ ...base, workerId: 'w1' }, { ...base, workerId: 'w2', oakvaleCertified: false }];
    const r = matchWorkers(cands, { pipelineType: 'INDIVIDUAL_EMPLOYER', requiredSkills: ['Paediatric first aid'] });
    expect(r.map((c) => c.workerId)).toEqual(['w1']);
  });

  it('excludes workers in the wrong city who will not relocate', () => {
    const cands: CandidateInput[] = [
      { ...base, workerId: 'lagos' },
      { ...base, workerId: 'abuja', preferredCities: ['Abuja'] },
      { ...base, workerId: 'abujaRelo', preferredCities: ['Abuja'], relocationWillingness: true },
    ];
    const r = matchWorkers(cands, { pipelineType: 'INDIVIDUAL_EMPLOYER', desiredCity: 'Lagos' });
    const ids = r.map((c) => c.workerId);
    expect(ids).toContain('lagos');
    expect(ids).toContain('abujaRelo');
    expect(ids).not.toContain('abuja');
  });

  it('ranks better skill match higher', () => {
    const cands: CandidateInput[] = [
      { ...base, workerId: 'matchAll', skills: [{ name: 'Skill A', category: null, selfRating: 5 }, { name: 'Skill B', category: null, selfRating: 5 }] },
      { ...base, workerId: 'matchOne', skills: [{ name: 'Skill A', category: null, selfRating: 5 }] },
    ];
    const r = matchWorkers(cands, { pipelineType: 'CORPORATE', requiredSkills: ['Skill A', 'Skill B'] });
    expect(r[0]?.workerId).toBe('matchAll');
  });

  it('returns at most topN candidates', () => {
    const cands: CandidateInput[] = Array.from({ length: 10 }, (_, i) => ({ ...base, workerId: `w${i}` }));
    const r = matchWorkers(cands, { pipelineType: 'INDIVIDUAL_EMPLOYER' }, 3);
    expect(r).toHaveLength(3);
  });

  it('ranks a candidate in the sought workforce category higher', () => {
    const cands: CandidateInput[] = [
      { ...base, workerId: 'sameCategory', workforceCategoryId: 'cat-childcare' },
      { ...base, workerId: 'otherCategory', workforceCategoryId: 'cat-elderly' },
    ];
    const r = matchWorkers(cands, { pipelineType: 'CORPORATE', categoryId: 'cat-childcare' });
    expect(r[0]?.workerId).toBe('sameCategory');
    const same = r.find((c) => c.workerId === 'sameCategory');
    const other = r.find((c) => c.workerId === 'otherCategory');
    expect((same?.breakdown.experience ?? 0)).toBeGreaterThan(other?.breakdown.experience ?? 0);
  });

  it('ranks a higher-rated worker above an unrated one, all else equal (§14.2)', () => {
    const cands: CandidateInput[] = [
      { ...base, workerId: 'rated', averageRating: 5 },
      { ...base, workerId: 'unrated', averageRating: 0 },
    ];
    const r = matchWorkers(cands, { pipelineType: 'INDIVIDUAL_EMPLOYER', requiredSkills: ['Paediatric first aid'] });
    expect(r[0]?.workerId).toBe('rated');
    const rated = r.find((c) => c.workerId === 'rated');
    const unrated = r.find((c) => c.workerId === 'unrated');
    expect(rated?.breakdown.rating ?? 0).toBeGreaterThan(unrated?.breakdown.rating ?? 0);
  });

  it('ignores the category bonus when the role has no target category', () => {
    const cands: CandidateInput[] = [
      { ...base, workerId: 'a', workforceCategoryId: 'cat-childcare' },
      { ...base, workerId: 'b', workforceCategoryId: 'cat-elderly' },
    ];
    const r = matchWorkers(cands, { pipelineType: 'CORPORATE' });
    const a = r.find((c) => c.workerId === 'a');
    const b = r.find((c) => c.workerId === 'b');
    expect(a?.breakdown.experience).toBe(b?.breakdown.experience);
  });
});
