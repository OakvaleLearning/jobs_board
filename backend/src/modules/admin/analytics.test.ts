import { describe, expect, it } from 'vitest';
import { buildFunnel, pct } from './analytics.helpers.js';

describe('analytics helpers', () => {
  it('pct guards against divide-by-zero', () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(0, 10)).toBe(0);
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(10, 10)).toBe(100);
  });

  it('buildFunnel computes conversion vs top and vs previous stage', () => {
    const funnel = buildFunnel([
      { stage: 'Registered', count: 100 },
      { stage: 'Profile ≥70%', count: 60 },
      { stage: 'Visible', count: 30 },
      { stage: 'Placed', count: 15 },
    ]);
    expect(funnel[0]).toEqual({ stage: 'Registered', count: 100, pctOfTop: 100, pctOfPrev: 100 });
    expect(funnel[1]).toMatchObject({ count: 60, pctOfTop: 60, pctOfPrev: 60 });
    // 30 of 60 from previous, 30 of 100 from top
    expect(funnel[2]).toMatchObject({ pctOfTop: 30, pctOfPrev: 50 });
    // 15 of 30 from previous, 15 of 100 from top
    expect(funnel[3]).toMatchObject({ pctOfTop: 15, pctOfPrev: 50 });
  });

  it('buildFunnel is safe when the cohort is empty', () => {
    const funnel = buildFunnel([
      { stage: 'Registered', count: 0 },
      { stage: 'Placed', count: 0 },
    ]);
    expect(funnel.every((s) => s.pctOfTop === 0 || s.stage === 'Registered')).toBe(true);
    expect(funnel[0]?.pctOfPrev).toBe(100);
  });
});
