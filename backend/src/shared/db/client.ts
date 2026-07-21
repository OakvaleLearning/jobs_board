import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { loadEnv } from '../config/env.js';
import * as schema from './schema.js';

const env = loadEnv();

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
});

export const db = drizzle(sql, { schema });

export async function pingDb(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
