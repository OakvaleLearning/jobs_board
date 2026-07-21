import { asc, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { careTypes } from '@/shared/db/schema.js';

export interface CareTypeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
}

/**
 * Active care types for the employer job-posting picker (brief §5). Admin-managed
 * taxonomy — the list grows without a code change as Oakvale finalises it.
 */
export async function listActiveCareTypes(): Promise<CareTypeRow[]> {
  return db
    .select({
      id: careTypes.id,
      slug: careTypes.slug,
      name: careTypes.name,
      description: careTypes.description,
      displayOrder: careTypes.displayOrder,
    })
    .from(careTypes)
    .where(eq(careTypes.isActive, true))
    .orderBy(asc(careTypes.displayOrder), asc(careTypes.name));
}
