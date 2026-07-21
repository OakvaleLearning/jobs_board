import type { Config } from 'drizzle-kit';

export default {
  schema: './src/shared/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://oakvale:oakvale@localhost:5432/oakvale_jobs',
  },
  strict: true,
} satisfies Config;
