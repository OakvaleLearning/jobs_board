import { asc, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { workforceCategories } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import type {
  WorkforceCategoryCreateInput,
  WorkforceCategoryUpdateInput,
} from '@oakvale/shared/schema/workforce-category.js';

export async function listCategories(opts: { activeOnly?: boolean } = {}) {
  return db
    .select()
    .from(workforceCategories)
    .where(opts.activeOnly ? eq(workforceCategories.isActive, true) : undefined)
    .orderBy(asc(workforceCategories.displayOrder), asc(workforceCategories.name));
}

export async function getCategory(id: string) {
  const row = await db.query.workforceCategories.findFirst({
    where: eq(workforceCategories.id, id),
  });
  if (!row) {
    throw new AppError({
      code: 'WORKFORCE_CATEGORY_NOT_FOUND',
      message: 'Workforce category not found.',
      statusCode: 404,
    });
  }
  return row;
}

export async function createCategory(input: WorkforceCategoryCreateInput, createdBy: string) {
  const existing = await db.query.workforceCategories.findFirst({
    where: eq(workforceCategories.slug, input.slug),
  });
  if (existing) {
    throw new AppError({
      code: 'WORKFORCE_CATEGORY_SLUG_TAKEN',
      message: `A category with slug ${input.slug} already exists.`,
      statusCode: 409,
    });
  }

  const [row] = await db
    .insert(workforceCategories)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description,
      requiredCertifications: input.requiredCertifications,
      requiredIdentityFields: input.requiredIdentityFields,
      skillsMenu: input.skillsMenu,
      specialistTags: input.specialistTags,
      applicableSettings: input.applicableSettings,
      applicableEmploymentTypes: input.applicableEmploymentTypes,
      requiredComplianceFields: input.requiredComplianceFields,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
      createdBy,
    })
    .returning();
  if (!row) {
    throw new AppError({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create workforce category.',
      statusCode: 500,
    });
  }
  await recordAudit({
    actorId: createdBy,
    action: 'workforce_category.created',
    targetType: 'workforce_category',
    targetId: row.id,
    metadata: { slug: row.slug, isActive: row.isActive },
  });
  return row;
}

export async function updateCategory(
  id: string,
  input: WorkforceCategoryUpdateInput,
  actorId: string,
) {
  await getCategory(id);
  const [row] = await db
    .update(workforceCategories)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.requiredCertifications !== undefined
        ? { requiredCertifications: input.requiredCertifications }
        : {}),
      ...(input.requiredIdentityFields !== undefined
        ? { requiredIdentityFields: input.requiredIdentityFields }
        : {}),
      ...(input.skillsMenu !== undefined ? { skillsMenu: input.skillsMenu } : {}),
      ...(input.specialistTags !== undefined ? { specialistTags: input.specialistTags } : {}),
      ...(input.applicableSettings !== undefined
        ? { applicableSettings: input.applicableSettings }
        : {}),
      ...(input.applicableEmploymentTypes !== undefined
        ? { applicableEmploymentTypes: input.applicableEmploymentTypes }
        : {}),
      ...(input.requiredComplianceFields !== undefined
        ? { requiredComplianceFields: input.requiredComplianceFields }
        : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(workforceCategories.id, id))
    .returning();
  await recordAudit({
    actorId,
    action: 'workforce_category.updated',
    targetType: 'workforce_category',
    targetId: id,
    metadata: { changes: Object.keys(input) },
  });
  return row;
}

export async function setActive(id: string, isActive: boolean, actorId: string) {
  return updateCategory(id, { isActive }, actorId);
}
