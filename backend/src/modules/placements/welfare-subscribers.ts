import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import {
  agentAssignments,
  individualEmployerNeedsAssessments,
  employers,
  placements,
  users,
  welfareChecks,
  welfareReports,
  workerPersonalInfo,
} from '@/shared/db/schema.js';
import { events } from '@/shared/events/bus.js';
import { logger } from '@/shared/logger/logger.js';
import { storage } from '@/shared/storage/r2.js';
import { queues } from '@/shared/queue/queues.js';
import {
  normaliseWelfareReport,
  renderWelfareReport,
} from '@/shared/pdf/welfare-report.js';
import * as notifications from '@/modules/notifications/service.js';
import { deriveTypeFlags, getEmployerType } from '@/modules/admin/employer-types.service.js';
import { openEscalation } from './welfare-escalations.js';

const OVERDUE_DELAY_MS = 24 * 60 * 60 * 1000;

async function loadAccountManager(placementId: string, workerId: string) {
  const placementAssignment = await db
    .select({ name: users.fullName, email: users.email })
    .from(agentAssignments)
    .innerJoin(users, eq(users.id, agentAssignments.agentId))
    .where(
      and(eq(agentAssignments.placementId, placementId), isNull(agentAssignments.removedAt)),
    )
    .limit(1);
  if (placementAssignment[0]) return placementAssignment[0];
  const workerAssignment = await db
    .select({ name: users.fullName, email: users.email })
    .from(agentAssignments)
    .innerJoin(users, eq(users.id, agentAssignments.agentId))
    .where(and(eq(agentAssignments.workerId, workerId), isNull(agentAssignments.removedAt)))
    .limit(1);
  return workerAssignment[0] ?? { name: null, email: null };
}

async function dispatchIndividualEmployerWelfarePdf(input: {
  placementId: string;
  welfareCheckId: string;
}): Promise<void> {
  const placement = await db.query.placements.findFirst({
    where: eq(placements.id, input.placementId),
  });
  if (!placement) return;
  const employer = await db.query.employers.findFirst({
    where: eq(employers.id, placement.employerId),
  });
  if (!employer) return;
  // Welfare PDFs are an account-managed (individual-employer) feature.
  if (!deriveTypeFlags(await getEmployerType(employer.employerTypeId)).isAccountManaged) {
    return;
  }
  const employerUser = await db.query.users.findFirst({ where: eq(users.id, employer.userId) });
  if (!employerUser) return;

  const check = await db.query.welfareChecks.findFirst({
    where: eq(welfareChecks.id, input.welfareCheckId),
  });
  if (!check) return;

  const needs = await db.query.individualEmployerNeedsAssessments.findFirst({
    where: eq(individualEmployerNeedsAssessments.employerId, employer.id),
  });
  const personal = await db.query.workerPersonalInfo.findFirst({
    where: eq(workerPersonalInfo.workerId, placement.workerId),
  });
  const accountManager = await loadAccountManager(placement.id, placement.workerId);

  const roleCategory =
    placement.pipelineType === 'INDIVIDUAL_EMPLOYER'
      ? 'Certified Caregiver'
      : placement.pipelineType === 'CORPORATE'
        ? 'Certified Childcare Worker'
        : null;

  const data = normaliseWelfareReport({
    placement: { id: placement.id, placedAt: placement.placedAt as Date | string | null },
    check: {
      scheduledAt: check.scheduledAt as Date | string | null,
      completedAt: check.completedAt as Date | string | null,
      recipientWellbeing: check.recipientWellbeing,
      workerAttendance: check.workerAttendance,
      issuesFlagged: check.issuesFlagged,
      notes: check.notes,
    },
    needs: needs ? { careRecipientName: needs.careRecipientName ?? null } : null,
    worker: {
      fullName: personal?.fullName ?? null,
      roleCategory,
    },
    accountManager,
  });
  const pdf = await renderWelfareReport(data);

  let storageKey: string | null = null;
  if (storage.isConfigured()) {
    storageKey = `welfare-reports/${placement.id}/${check.id}.pdf`;
    try {
      await storage.putObject(storageKey, pdf, 'application/pdf');
    } catch (err) {
      logger.warn({ err, storageKey }, 'welfare report R2 upload failed; falling back to inline');
      storageKey = null;
    }
  }

  const pdfBase64 = pdf.toString('base64');
  await db
    .insert(welfareReports)
    .values({
      welfareCheckId: check.id,
      placementId: placement.id,
      storageKey,
      pdfBase64: storageKey ? null : pdfBase64,
      deliveredToEmail: employerUser.email,
      deliveredAt: new Date(),
    })
    .onConflictDoNothing();

  const filename = `welfare_${data.caseRef}_${(check.completedAt ?? new Date())
    .toISOString()
    .slice(0, 10)}.pdf`;

  await notifications.enqueue({
    userId: employerUser.id,
    kind: 'welfare_report_monthly',
    channel: 'EMAIL',
    payload: {
      placementId: placement.id,
      careRecipientName: data.careRecipientName ?? 'your loved one',
      recipientWellbeing: data.recipientWellbeing ?? 'UNKNOWN',
    },
    idempotencyKey: `welfare-report-${check.id}`,
    attachments: [{ filename, contentBase64: pdfBase64 }],
  });
}

async function maybeOpenEscalation(input: {
  placementId: string;
  welfareCheckId: string;
  recipientWellbeing: string | null;
}): Promise<void> {
  const sev = input.recipientWellbeing;
  if (sev !== 'FAIR' && sev !== 'POOR') return;
  const placement = await db.query.placements.findFirst({
    where: eq(placements.id, input.placementId),
  });
  if (!placement) return;
  const escalation = await openEscalation({
    welfareCheckId: input.welfareCheckId,
    placementId: input.placementId,
    severity: sev,
  });
  await notifications.enqueueForRole('ADMIN', {
    kind: 'welfare_escalation_opened',
    channel: 'IN_APP',
    payload: { placementId: input.placementId, severity: sev },
    idempotencyKey: `welfare-esc-inapp-${escalation.id}`,
  });
  await notifications.enqueueForRole('ADMIN', {
    kind: 'welfare_escalation_opened',
    channel: 'EMAIL',
    payload: { placementId: input.placementId, severity: sev },
    idempotencyKey: `welfare-esc-email-${escalation.id}`,
  });
  const assignment = await db
    .select({ agentId: agentAssignments.agentId })
    .from(agentAssignments)
    .where(
      and(eq(agentAssignments.placementId, input.placementId), isNull(agentAssignments.removedAt)),
    )
    .limit(1);
  if (assignment[0]) {
    await notifications.enqueue({
      userId: assignment[0].agentId,
      kind: 'welfare_escalation_opened',
      channel: 'IN_APP',
      payload: { placementId: input.placementId, severity: sev },
      idempotencyKey: `welfare-esc-agent-${escalation.id}`,
    });
  }
  await queues.welfareChecks.add(
    'welfare-escalation-overdue',
    { escalationId: escalation.id },
    { delay: OVERDUE_DELAY_MS, jobId: `welfare-overdue-${escalation.id}` },
  );
}

export function registerWelfareSubscribers(): void {
  events.on('welfare.checkCompleted', async (payload) => {
    try {
      await dispatchIndividualEmployerWelfarePdf({
        placementId: payload.placementId,
        welfareCheckId: payload.welfareCheckId,
      });
    } catch (err) {
      logger.error({ err, payload }, 'welfare PDF dispatch failed');
    }
    try {
      await maybeOpenEscalation({
        placementId: payload.placementId,
        welfareCheckId: payload.welfareCheckId,
        recipientWellbeing: payload.recipientWellbeing,
      });
    } catch (err) {
      logger.error({ err, payload }, 'welfare escalation creation failed');
    }
  });
}
