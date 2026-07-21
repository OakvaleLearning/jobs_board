import { beforeAll, describe, expect, it } from 'vitest';

describe('toCsv', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1/x';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.JWT_ACCESS_SECRET = 'x'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(32);
  });

  it('emits header + rows separated by CRLF', async () => {
    const { toCsv } = await import('./exports.service.js');
    const out = toCsv(
      [
        { a: 1, b: 'two' },
        { a: 3, b: 'four' },
      ],
      [
        { header: 'a', pick: (r) => r.a },
        { header: 'b', pick: (r) => r.b },
      ],
    );
    expect(out).toBe('a,b\r\n1,two\r\n3,four');
  });

  it('escapes commas, quotes, newlines per RFC 4180', async () => {
    const { toCsv } = await import('./exports.service.js');
    const out = toCsv(
      [{ s: 'hello, "world"\nnext line' }],
      [{ header: 's', pick: (r) => r.s }],
    );
    expect(out).toBe('s\r\n"hello, ""world""\nnext line"');
  });

  it('serializes null/undefined as empty', async () => {
    const { toCsv } = await import('./exports.service.js');
    const out = toCsv(
      [{ a: null, b: undefined }],
      [
        { header: 'a', pick: (r) => r.a },
        { header: 'b', pick: (r) => r.b },
      ],
    );
    expect(out).toBe('a,b\r\n,');
  });
});
