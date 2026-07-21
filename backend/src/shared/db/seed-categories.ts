import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { workforceCategories, type NewWorkforceCategory } from './schema.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../logger/logger.js';

/**
 * The two launch workforce categories. Idempotent: inserts only if the slug is
 * absent, so re-running never duplicates or overwrites admin edits.
 */
const CATEGORIES: NewWorkforceCategory[] = [
  {
    slug: 'CERTIFIED_CAREGIVER',
    name: 'Certified Caregiver (Elderly / Home Care)',
    description:
      'CPD-accredited caregivers for elderly and home-care placements across the diaspora and corporate pipelines.',
    requiredCertifications: [{ name: 'Oakvale Elderly & Home Care Certificate' }],
    requiredIdentityFields: ['NIN', 'SELFIE', 'PROOF_OF_ADDRESS'],
    skillsMenu: [
      'Personal care / activities of daily living',
      'Mobility assistance',
      'Medication reminders',
      'Meal preparation',
      'Companionship',
      'Dementia / Alzheimer’s care',
      'Palliative care support',
    ],
    specialistTags: ['Dementia care', 'Post-operative care', 'Live-in care'],
    applicableSettings: ['HOME', 'CLINIC', 'HOSPITAL'],
    applicableEmploymentTypes: ['FULL_TIME', 'PART_TIME', 'SHIFT', 'LIVE_IN'],
    requiredComplianceFields: ['IMMUNISATION', 'DBS_EQUIVALENT'],
    displayOrder: 1,
    isActive: true,
  },
  {
    slug: 'CERTIFIED_CHILDCARE_WORKER',
    name: 'Certified Childcare Worker (Early Years)',
    description:
      'CPD-accredited early-years childcare workers for family homes, crèches, and corporate crèche placements.',
    requiredCertifications: [{ name: 'Oakvale Early Years Childcare Certificate' }],
    requiredIdentityFields: ['NIN', 'SELFIE', 'PROOF_OF_ADDRESS'],
    skillsMenu: [
      'Early years development',
      'Feeding and weaning',
      'Nappy changing / toileting',
      'Play-based learning',
      'Safeguarding awareness',
      'First aid (paediatric)',
      'Routine and sleep management',
    ],
    specialistTags: ['Newborn care', 'Special educational needs', 'Montessori'],
    applicableSettings: ['HOME', 'CORPORATE'],
    applicableEmploymentTypes: ['FULL_TIME', 'PART_TIME', 'SHIFT', 'LIVE_IN'],
    requiredComplianceFields: ['IMMUNISATION', 'DBS_EQUIVALENT'],
    displayOrder: 2,
    isActive: true,
  },
];

async function main(): Promise<void> {
  loadEnv();

  let inserted = 0;
  for (const category of CATEGORIES) {
    const existing = await db.query.workforceCategories.findFirst({
      where: eq(workforceCategories.slug, category.slug),
    });
    if (existing) {
      logger.info({ slug: category.slug }, 'Workforce category already exists');
      continue;
    }
    await db.insert(workforceCategories).values(category);
    inserted += 1;
    logger.info({ slug: category.slug }, 'Workforce category seeded');
  }

  logger.info({ inserted }, 'Workforce category seed complete');
  process.exit(0);
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to seed workforce categories');
  process.exit(1);
});
