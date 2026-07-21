'use client';

import { Progress } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export function CompletionBar({
  pct,
  visibilityStatus,
  onSubmit,
  submitting,
  onCancel,
  cancelling,
  rejectionReason,
}: {
  pct: number;
  visibilityStatus: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  onSubmit: () => void;
  submitting: boolean;
  onCancel: () => void;
  cancelling: boolean;
  rejectionReason?: string | null;
}) {
  const editable = visibilityStatus === 'DRAFT' || visibilityStatus === 'REJECTED';
  const submittable = pct >= 80 && editable;
  return (
    <div className="rounded-2xl border border-ink/8 bg-white p-5 sticky top-4 z-10 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-eyebrow text-muted">Profile completion</p>
          <p className="h-display text-2xl mt-1 tabular-nums">{pct}%</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={visibilityStatus} />
          {visibilityStatus === 'PENDING_REVIEW' ? (
            <Button onClick={onCancel} disabled={cancelling} size="sm" variant="outline">
              {cancelling ? 'Withdrawing…' : 'Withdraw submission'}
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={!submittable || submitting} size="sm">
              {submitting
                ? 'Submitting…'
                : visibilityStatus === 'REJECTED'
                  ? 'Resubmit for review'
                  : visibilityStatus === 'DRAFT'
                    ? 'Submit for review'
                    : 'Submitted'}
            </Button>
          )}
        </div>
      </div>
      <Progress value={pct} className="mt-4" />
      {visibilityStatus === 'REJECTED' ? (
        <p className="text-xs text-terracotta-700 mt-3">
          Changes requested: {rejectionReason ?? 'see the notes from our agents on the verification page.'}
        </p>
      ) : null}
      {!submittable && visibilityStatus === 'DRAFT' ? (
        <p className="text-xs text-muted mt-3">Reach 80% to submit. Identity and experience count double.</p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'APPROVED' ? 'sage' : status === 'REJECTED' || status === 'SUSPENDED' ? 'terracotta' : 'neutral';
  const label = status.replace('_', ' ').toLowerCase();
  return (
    <Badge tone={tone}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </Badge>
  );
}
