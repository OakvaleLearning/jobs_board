import { beforeAll, describe, expect, it } from 'vitest';

describe('visibility gate fragments', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  async function gateQueryChunks(): Promise<string> {
    const { visibilityGateSql } = await import('./visibility.js');
    const { sql } = await import('drizzle-orm');
    const fragment = visibilityGateSql(sql.raw('workers.id'));
    // Join queryChunks into a readable string without needing a live dialect.
    return JSON.stringify(fragment);
  }

  it('produces four conditions (background is advisory, not gated)', async () => {
    const { visibilityGateConds } = await import('./visibility.js');
    const { sql } = await import('drizzle-orm');
    expect(visibilityGateConds(sql.raw('workers.id'))).toHaveLength(4);
  });

  it('does NOT gate on the background check (advisory only)', async () => {
    const chunks = await gateQueryChunks();
    expect(chunks).not.toContain('background_checks');
  });

  it('requires ≥70% completion and a VERIFIED identity', async () => {
    const chunks = await gateQueryChunks();
    expect(chunks).toContain('w.profile_completion_pct >= ');
    expect(chunks).toContain("vr.request_type = 'IDENTITY' AND vr.status = 'VERIFIED'");
  });

  it('treats NULL cert expiry as valid (non-expiring)', async () => {
    const chunks = await gateQueryChunks();
    expect(chunks).toContain('c.is_oakvale_cert = true');
    expect(chunks).toContain('c.expires_at IS NULL OR c.expires_at > now()');
  });

  it('excludes workers with an unresolved SAFEGUARDING flag', async () => {
    const chunks = await gateQueryChunks();
    expect(chunks).toContain('NOT EXISTS');
    expect(chunks).toContain("cf.flag_type = 'SAFEGUARDING'");
    expect(chunks).toContain('cf.resolved_at IS NULL');
  });

  it('visibleWorkerIds short-circuits on empty input', async () => {
    const { visibleWorkerIds } = await import('./visibility.js');
    await expect(visibleWorkerIds([])).resolves.toEqual(new Set());
  });
});
