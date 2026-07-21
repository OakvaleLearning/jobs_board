import { beforeAll, describe, expect, it } from 'vitest';
import type { SearchFilters } from './service.js';

describe('searchCacheKey', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  const base: SearchFilters = { page: 1, limit: 20, applyVisibilityGate: true };

  it('uses the CLAUDE.md key pattern', async () => {
    const { searchCacheKey } = await import('./service.js');
    expect(searchCacheKey(base)).toMatch(/^search:workers:[0-9a-f]{32}$/);
  });

  it('is stable across object key order and array order', async () => {
    const { searchCacheKey } = await import('./service.js');
    const a: SearchFilters = { ...base, state: 'Lagos', skills: ['childcare', 'first-aid'] };
    const b: SearchFilters = { skills: ['first-aid', 'childcare'], state: 'Lagos', ...base };
    expect(searchCacheKey(a)).toBe(searchCacheKey(b));
  });

  it('ignores undefined values', async () => {
    const { searchCacheKey } = await import('./service.js');
    expect(searchCacheKey({ ...base, q: undefined })).toBe(searchCacheKey(base));
  });

  it('differs for different filters', async () => {
    const { searchCacheKey } = await import('./service.js');
    expect(searchCacheKey({ ...base, state: 'Lagos' })).not.toBe(searchCacheKey(base));
    expect(searchCacheKey({ ...base, page: 2 })).not.toBe(searchCacheKey(base));
  });

  it('includes applyVisibilityGate in the hash', async () => {
    const { searchCacheKey } = await import('./service.js');
    expect(searchCacheKey({ ...base, applyVisibilityGate: false })).not.toBe(searchCacheKey(base));
  });
});
