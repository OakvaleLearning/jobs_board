import { EventEmitter } from 'node:events';
import { logger } from '../logger/logger.js';
import type {
  BackgroundCheckStatus,
  FlagSeverity,
  FlagType,
} from '@oakvale/shared/enums/verification.js';
import type { JobVisibility } from '@oakvale/shared/enums/employer.js';

export interface AppEvents {
  'user.registered': { userId: string; role: string; employerTypeId?: string };
  'worker.identityApproved': { workerId: string; reviewedBy: string };
  'worker.identityRejected': { workerId: string; reviewedBy: string; reason?: string };
  'worker.profileResubmitted': { workerId: string };
  /** An admin reviewed the worker's uploaded background documents (advisory). */
  'worker.backgroundReviewed': { workerId: string; status: BackgroundCheckStatus };
  /** A worker certification was added — may make the worker eligible for APPROVED. */
  'worker.certificationAdded': { workerId: string };
  'worker.flagged': {
    workerId: string;
    flagType: FlagType;
    severity: FlagSeverity;
    flagId: string;
  };
  'placement.selected': { placementId: string; employerId: string; workerId: string };
  'placement.activated': { placementId: string; employerId: string; workerId: string };
  'placement.completed': { placementId: string; employerId: string; workerId: string };
  'placement.suspended': { placementId: string; workerId: string; reason: string };
  'placement.replacementRequested': {
    placementId: string;
    requestId: string;
    pipelineType: 'INDIVIDUAL_EMPLOYER' | 'CORPORATE';
    slaDeadline: string;
  };
  'replacement.slaWarning': { requestId: string; placementId: string; slaDeadline: string };
  'shortlist.generated': { shortlistId: string; employerId: string; candidateCount: number };
  'invoice.opened': { invoiceId: string; employerId: string; purpose: string; amountMinor: number };
  'invoice.paid': { invoiceId: string; employerId: string; placementId: string | null };
  'invoice.refunded': { invoiceId: string; employerId: string; reason: string };
  'subscription.activated': { subscriptionId: string; employerId: string; plan: string };
  'subscription.cancelled': { subscriptionId: string; employerId: string };
  'invoice.pastDue': { invoiceId: string; employerId: string };
  'notification.sent': { notificationId: string; userId: string; kind: string };
  'notification.failed': { notificationId: string; userId: string; kind: string; reason: string };
  'contract.drafted': { contractId: string; type: string; placementId: string | null };
  'contract.signed': { contractId: string; party: string; signerUserId: string };
  'contract.fullyExecuted': { contractId: string; placementId: string | null };
  'contract.terminated': { contractId: string; reason: string };
  'complaint.raised': {
    complaintId: string;
    caseRef: string;
    category: string;
    urgency: string;
    raisedByUserId: string;
    againstUserId: string | null;
    placementId: string | null;
  };
  'complaint.safeguardingRaised': {
    complaintId: string;
    placementId: string | null;
    againstUserId: string | null;
  };
  'complaint.resolved': { complaintId: string; outcome: string };
  'offer.created': { offerId: string; employerId: string; workerId: string; shortlistId: string };
  'offer.submittedForReview': { offerId: string };
  'offer.approved': { offerId: string; reviewedBy: string };
  'offer.sent': { offerId: string };
  'offer.accepted': { offerId: string; placementId: string };
  'offer.declined': { offerId: string; reason: string };
  'offer.countered': { offerId: string; counterOfferId: string };
  'offer.withdrawn': { offerId: string };
  'message.sent': { messageId: string; conversationId: string; senderUserId: string };
  'message.flagged': {
    messageId: string;
    conversationId: string;
    senderUserId: string;
    reasons: string[];
  };
  'contact.unlocked': { employerId: string; workerId: string };
  'welfare.checkCompleted': {
    placementId: string;
    welfareCheckId: string;
    recipientWellbeing: string | null;
    workerAttendance: string | null;
    issuesFlagged: boolean;
  };
  'welfare.escalationOpened': {
    escalationId: string;
    placementId: string;
    welfareCheckId: string;
    severity: string;
    dueAt: string;
  };
  'welfare.escalationResolved': { escalationId: string; placementId: string };
  'contract.amended': {
    originalContractId: string;
    supersedingContractId: string;
    changedFields: Record<string, { from: unknown; to: unknown }>;
  };
  'contract.renewalDue': { contractId: string; employerId: string | null; daysUntilExpiry: number };
  'partnership.lapsed': { contractId: string; employerId: string | null };
  'savedSearch.matchesFound': { savedSearchId: string; employerId: string; newWorkerIds: string[] };
  'jobPosting.reviewed': {
    jobPostingId: string;
    employerId: string;
    approved: boolean;
    notes?: string;
  };
  /** §6.2 employer verification workflow. */
  'employer.submittedForVerification': { employerId: string };
  'employer.verificationApproved': { employerId: string };
  'employer.verificationRejected': { employerId: string };
  /** A posting went live — RESTRICTED postings notify category-matched workers. */
  'jobPosting.published': {
    jobPostingId: string;
    employerId: string;
    visibility: JobVisibility;
    workforceCategoryId: string | null;
  };
  'job.applicationReceived': {
    applicationId: string;
    jobPostingId: string;
    employerId: string;
    workerId: string;
  };
  'interview.requested': { interviewId: string; employerId: string; workerId: string };
  'interview.confirmed': {
    interviewId: string;
    employerId: string;
    workerId: string;
    slot: string;
  };
  /** A worker payout inside a payroll run was marked paid. */
  'payroll.payoutPaid': {
    payoutId: string;
    workerId: string;
    amountMinor: number;
    period: string;
  };
}

type Listener<K extends keyof AppEvents> = (payload: AppEvents[K]) => void | Promise<void>;

class TypedEmitter {
  private readonly inner = new EventEmitter();

  on<K extends keyof AppEvents>(event: K, listener: Listener<K>): void {
    this.inner.on(event, (payload) => {
      const result = listener(payload as AppEvents[K]);
      if (result instanceof Promise) {
        result.catch((err: unknown) => {
          logger.error({ err, event: String(event) }, 'event listener failed');
        });
      }
    });
  }

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    this.inner.emit(event, payload);
  }

  removeAllListeners(): void {
    this.inner.removeAllListeners();
  }
}

export const events = new TypedEmitter();
