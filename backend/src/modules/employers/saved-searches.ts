import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { savedSearches } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import type { SavedSearchCreateInput } from '@oakvale/shared/schema/messaging.js';

export async function listForEmployer(employerId: string) {
  return db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.employerId, employerId))
    .orderBy(desc(savedSearches.updatedAt));
}

export async function create(employerId: string, input: SavedSearchCreateInput) {
  const [row] = await db
    .insert(savedSearches)
    .values({
      employerId,
      name: input.name,
      filters: input.filters,
      notifyOnNewMatch: input.notifyOnNewMatch ?? false,
    })
    .returning();
  return row;
}

export async function getOrThrow(employerId: string, id: string) {
  const row = await db.query.savedSearches.findFirst({
    where: and(eq(savedSearches.id, id), eq(savedSearches.employerId, employerId)),
  });
  if (!row) {
    throw new AppError({
      code: 'SAVED_SEARCH_NOT_FOUND',
      message: 'Saved search not found',
      statusCode: 404,
    });
  }
  return row;
}

export async function remove(employerId: string, id: string) {
  await getOrThrow(employerId, id);
  await db.delete(savedSearches).where(eq(savedSearches.id, id));
}

export async function listAlerting() {
  return db.select().from(savedSearches).where(eq(savedSearches.notifyOnNewMatch, true));
}

export async function update(
  employerId: string,
  id: string,
  patch: Partial<SavedSearchCreateInput>,
) {
  await getOrThrow(employerId, id);
  const [row] = await db
    .update(savedSearches)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.filters !== undefined ? { filters: patch.filters } : {}),
      ...(patch.notifyOnNewMatch !== undefined
        ? { notifyOnNewMatch: patch.notifyOnNewMatch }
        : {}),
    })
    .where(eq(savedSearches.id, id))
    .returning();
  return row;
}
