import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { db } from './client.js';
import { agentProfiles, users } from './schema.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { AGENT_SPECIALTIES, type AgentSpecialty } from '@oakvale/shared/enums/admin.js';

const email = process.env.SEED_AGENT_EMAIL ?? 'agent@oakvale.local';
const password = process.env.SEED_AGENT_PASSWORD ?? 'Agent123!';
const fullName = process.env.SEED_AGENT_FULL_NAME ?? 'Oakvale Agent';
const specialtyInput = process.env.SEED_AGENT_SPECIALTY ?? 'RECRUITER';

function resolveSpecialty(value: string): AgentSpecialty {
  if ((AGENT_SPECIALTIES as readonly string[]).includes(value)) {
    return value as AgentSpecialty;
  }
  logger.warn({ value }, 'Unknown SEED_AGENT_SPECIALTY; falling back to RECRUITER');
  return 'RECRUITER';
}

async function main(): Promise<void> {
  loadEnv();

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    logger.info({ email }, 'Agent user already exists');
    process.exit(0);
  }

  const passwordHash = await hash(password);
  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      fullName,
      role: 'AGENT',
      emailVerifiedAt: new Date(),
      isActive: true,
    })
    .returning({ id: users.id });

  if (!created) {
    logger.error({ email }, 'Failed to insert agent user');
    process.exit(1);
  }

  const specialty = resolveSpecialty(specialtyInput);
  await db.insert(agentProfiles).values({ id: created.id, specialty });

  logger.info({ email, specialty }, 'Agent user seeded successfully');
  process.exit(0);
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to seed agent user');
  process.exit(1);
});
