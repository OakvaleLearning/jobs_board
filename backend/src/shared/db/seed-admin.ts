import { hash } from '@node-rs/argon2';
import { db } from './client.js';
import { users } from './schema.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../logger/logger.js';

const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@oakvale.local';
const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'Oakvale Admin';

async function main(): Promise<void> {
  loadEnv();

  const passwordHash = await hash(password);
  await db
    .insert(users)
    .values({
      email,
      passwordHash,
      fullName,
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash,
        fullName,
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
        isActive: true,
        deletedAt: null,
        updatedAt: new Date(),
      },
    });

  logger.info({ email }, 'Admin user upserted successfully');
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to seed admin user');
  process.exit(1);
});
