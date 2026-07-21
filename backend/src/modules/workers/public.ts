import { eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { workerDocuments } from '@/shared/db/schema.js';
import { storage } from '@/shared/storage/r2.js';
import { getProfile } from './service.js';
import { blurredKeyFor } from './selfie.js';
import { getStatusFor as getComplianceStatus } from '@/modules/compliance/service.js';
import { getStatus as getVerificationStatus } from '@/modules/verification/service.js';

/**
 * Presign the worker's selfie for an employer-facing view: the clear image when
 * `unlocked`, otherwise the server-blurred variant. Returns null when there is no
 * CLEAN selfie or storage is not configured.
 */
async function resolveSelfieUrl(selfieId: string | null, unlocked: boolean): Promise<string | null> {
  if (!selfieId || !storage.isConfigured()) return null;
  const doc = await db.query.workerDocuments.findFirst({
    where: eq(workerDocuments.id, selfieId),
  });
  if (!doc || doc.status !== 'CLEAN') return null;
  const key = unlocked ? doc.storageKey : blurredKeyFor(doc.storageKey);
  return storage.getGetUrl(key).catch(() => null);
}

/** Public-safe projection of a worker profile, intended for employer-facing views. */
export async function buildPublicProfile(workerId: string, opts: { includeContact?: boolean } = {}) {
  const [profile, verification, compliance] = await Promise.all([
    getProfile(workerId),
    getVerificationStatus(workerId),
    getComplianceStatus(workerId),
  ]);

  const a = (profile.sections.A ?? null) as
    | {
        fullName?: string | null;
        stateOfOrigin?: string | null;
        lga?: string | null;
        nationality?: string | null;
        gender?: string | null;
        phone?: string | null;
        email?: string | null;
      }
    | null;
  const b = profile.sections.B as { idType?: string | null; selfieId?: string | null } | null;
  const bIdType = b?.idType ?? null;
  const photoUrl = await resolveSelfieUrl(b?.selfieId ?? null, opts.includeContact ?? false);
  const education = (profile.sections.D as { items?: unknown[] } | null)?.items ?? [];
  const experience = (profile.sections.E as { items?: unknown[] } | null)?.items ?? [];
  const skills = (profile.sections.H as { items?: unknown[] } | null)?.items ?? [];
  const interestsStatement = profile.sections.I as
    | { interests?: string | null; personalStatement?: string | null }
    | null;
  const preferences = profile.sections.G as
    | { employmentType?: string | null; preferredCities?: unknown; relocationWillingness?: boolean | null }
    | null;
  const salary = profile.sections.K as
    | { wageStructure?: string | null; minRate?: string | null; maxRate?: string | null; currency?: string | null; negotiable?: boolean | null }
    | null;

  const latestOakvale = compliance.certifications
    .filter((c) => c.isOakvaleCert)
    .sort((x, y) => (x.issuedAt < y.issuedAt ? 1 : -1))[0];

  return {
    id: profile.id,
    visibilityStatus: profile.visibilityStatus,
    photoUrl,
    photoUnlocked: opts.includeContact ?? false,
    personal: {
      fullName: a?.fullName ?? null,
      stateOfOrigin: a?.stateOfOrigin ?? null,
      lga: a?.lga ?? null,
      nationality: a?.nationality ?? null,
      gender: a?.gender ?? null,
    },
    contact: {
      phone: opts.includeContact ? (a?.phone ?? null) : null,
      email: opts.includeContact ? (a?.email ?? null) : null,
    },
    identity: { idType: bIdType },
    education,
    experience,
    skills,
    interests: interestsStatement?.interests ?? null,
    personalStatement: interestsStatement?.personalStatement ?? null,
    preferences: {
      employmentType: preferences?.employmentType ?? null,
      preferredCities: preferences?.preferredCities ?? [],
      relocationWillingness: preferences?.relocationWillingness ?? null,
    },
    salary: salary ?? null,
    credentials: {
      identityVerified: verification.identity.status === 'VERIFIED',
      backgroundClear: verification.background.status === 'CLEAR',
      oakvaleCertified: compliance.oakvaleCertified,
      latestOakvaleCertExpiresAt: latestOakvale?.expiresAt ?? null,
    },
  };
}

export type PublicWorkerProfile = Awaited<ReturnType<typeof buildPublicProfile>>;
