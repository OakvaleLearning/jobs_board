import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { cpdEnrolments, workers } from '@/shared/db/schema.js';
import { AppError } from '@/shared/errors/app-error.js';
import { recordAudit } from '@/shared/audit/record.js';
import { enrolWorker } from '@/shared/lms/client.js';
import { addCpdRecord } from './service.js';

/**
 * §14.2 in-app CPD refresh enrolment. The catalogue is a small static list at launch
 * (the brief's CPD refresh cycle is annual, per category); a Platform Admin can expand
 * it later. Enrolment is brokered to the Oakvale LMS via the stub seam in shared/lms.
 */

export interface CpdProgramme {
  id: string;
  name: string;
  /** Default CPD hours awarded on completion — feeds the worker's CPD hours total. */
  hours: number;
}

const PROGRAMMES: CpdProgramme[] = [
  { id: 'cpd-safeguarding-refresh', name: 'Safeguarding Refresher (Annual)', hours: 6 },
  { id: 'cpd-medication-management', name: 'Medication Management Update', hours: 8 },
  { id: 'cpd-dementia-care', name: 'Dementia Care Advanced', hours: 10 },
  { id: 'cpd-infant-first-aid', name: 'Infant & Paediatric First Aid', hours: 6 },
  { id: 'cpd-send-awareness', name: 'SEND Awareness (Early Years)', hours: 6 },
];

export function listProgrammes(): CpdProgramme[] {
  return PROGRAMMES;
}

function programmeOrThrow(programmeId: string): CpdProgramme {
  const p = PROGRAMMES.find((x) => x.id === programmeId);
  if (!p) {
    throw new AppError({ code: 'NOT_FOUND', message: 'Unknown CPD programme.', statusCode: 404 });
  }
  return p;
}

export async function listEnrolments(workerId: string) {
  return db
    .select()
    .from(cpdEnrolments)
    .where(eq(cpdEnrolments.workerId, workerId))
    .orderBy(desc(cpdEnrolments.enrolledAt));
}

export async function enrol(workerId: string, programmeId: string) {
  const programme = programmeOrThrow(programmeId);
  // No duplicate active enrolment in the same programme.
  const active = await db.query.cpdEnrolments.findFirst({
    where: and(eq(cpdEnrolments.workerId, workerId), eq(cpdEnrolments.programmeId, programmeId)),
  });
  if (active && active.status !== 'COMPLETED') {
    throw new AppError({
      code: 'CONFLICT',
      message: 'You are already enrolled in this programme.',
      statusCode: 409,
    });
  }
  const { enrolmentId } = await enrolWorker({
    workerId,
    programmeId,
    programmeName: programme.name,
  });
  const [row] = await db
    .insert(cpdEnrolments)
    .values({
      workerId,
      programmeId,
      programmeName: programme.name,
      lmsEnrolmentId: enrolmentId,
    })
    .returning();
  void recordAudit({
    actorId: null,
    action: 'cpd.enrolled',
    targetType: 'worker',
    targetId: workerId,
    metadata: { programmeId, lmsEnrolmentId: enrolmentId },
  });
  return row;
}

/**
 * Mark an enrolment complete. In production this is driven by an LMS completion
 * callback; until that endpoint exists the worker confirms completion in-app, which
 * writes a CPD record (and refreshes the worker's CPD hours total).
 */
export async function completeEnrolment(enrolmentId: string, workerId: string) {
  const enrolment = await db.query.cpdEnrolments.findFirst({
    where: eq(cpdEnrolments.id, enrolmentId),
  });
  if (!enrolment || enrolment.workerId !== workerId) {
    throw new AppError({ code: 'NOT_FOUND', message: 'Enrolment not found.', statusCode: 404 });
  }
  if (enrolment.status === 'COMPLETED') return enrolment;

  const programme = programmeOrThrow(enrolment.programmeId);
  const today = new Date().toISOString().slice(0, 10);
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  await addCpdRecord(workerId, {
    courseName: programme.name,
    provider: 'Oakvale LMS',
    completedAt: today,
    expiresAt: expires.toISOString().slice(0, 10),
    hoursCompleted: programme.hours,
  });

  const [updated] = await db
    .update(cpdEnrolments)
    .set({ status: 'COMPLETED', completedAt: new Date() })
    .where(eq(cpdEnrolments.id, enrolmentId))
    .returning();
  return updated;
}
