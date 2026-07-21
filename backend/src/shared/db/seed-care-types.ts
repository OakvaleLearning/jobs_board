import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { careTypes, type NewCareType } from './schema.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * MVP care types for the employer job-posting picker (brief §5). The two launch
 * categories; Oakvale can add finer sub-needs later via admin without code changes.
 * Idempotent: inserts only if the slug is absent, so re-running never duplicates.
 */
const CARE_TYPES: NewCareType[] = [
  {
    slug: 'ELDERLY_CARE',
    name: 'Elderly / Geriatric Care',
    description: 'Support for older adults — daily living, mobility, companionship, home care.',
    displayOrder: 1,
    isActive: true,
  },
  {
    slug: 'CHILD_CARE',
    name: 'Child Care / Early Years',
    description: 'Early-years and childcare support for family homes and crèches.',
    displayOrder: 2,
    isActive: true,
  },
];

async function main(): Promise<void> {
  loadEnv();

  let inserted = 0;
  for (const careType of CARE_TYPES) {
    const existing = await db.query.careTypes.findFirst({
      where: eq(careTypes.slug, careType.slug),
    });
    if (existing) {
      logger.info({ slug: careType.slug }, 'Care type already exists');
      continue;
    }
    await db.insert(careTypes).values(careType);
    inserted += 1;
    logger.info({ slug: careType.slug }, 'Care type seeded');
  }

  logger.info({ inserted }, 'Care type seed complete');
  process.exit(0);
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to seed care types');
  process.exit(1);
});
