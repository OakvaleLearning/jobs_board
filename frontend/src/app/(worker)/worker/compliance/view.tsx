'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { complianceApi, type CpdRecord, type Certification } from '@/lib/compliance-api';
import {
  IDENTITY_FIELD_LABELS,
  COMPLIANCE_FIELD_LABELS,
  type IdentityFieldKey,
  type ComplianceFieldKey,
} from '@oakvale/shared/enums/workforce-category';
import { Modal } from '@/components/ui/Modal';
import { AddCpdForm } from './add-cpd';
import { AddCertForm } from './add-cert';
import { CpdRefreshPanel } from './cpd-refresh';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

export function ComplianceView() {
  const hydrated = useHydratedTokens();
  const [showCpd, setShowCpd] = useState(false);
  const [showCert, setShowCert] = useState(false);

  const q = useQuery({ queryKey: ['complianceStatus'], queryFn: complianceApi.me, enabled: hydrated });
  const data = q.data;

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · CPD & compliance"
        title="Stay credentialed, stay visible."
        description="Your Oakvale certification, plus any CPD courses you’ve completed. We’ll nudge you 60 days before anything expires."
        actions={
          data?.oakvaleCertified ? (
            <Badge tone="sage">Oakvale-certified</Badge>
          ) : (
            <Badge tone="terracotta">Not certified yet</Badge>
          )
        }
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between">
            <CardEyebrow>Certifications</CardEyebrow>
            <Button size="sm" variant="outline" onClick={() => setShowCert(true)}>
              Add certification
            </Button>
          </div>
          <CardTitle>Oakvale + external</CardTitle>
          <ul className="mt-5 space-y-3">
            {(data?.certifications ?? []).map((c) => (
              <CertItem key={c.id} c={c} />
            ))}
            {(data?.certifications ?? []).length === 0 ? (
              <li className="text-sm text-muted">No certifications on file yet.</li>
            ) : null}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <CardEyebrow>CPD courses</CardEyebrow>
            <Button size="sm" variant="outline" onClick={() => setShowCpd(true)}>
              Log a CPD course
            </Button>
          </div>
          <CardTitle>Continuing development</CardTitle>
          <ul className="mt-5 space-y-3">
            {(data?.cpdRecords ?? []).map((r) => (
              <CpdItem key={r.id} r={r} />
            ))}
            {(data?.cpdRecords ?? []).length === 0 ? (
              <li className="text-sm text-muted">No CPD records logged yet.</li>
            ) : null}
          </ul>
        </Card>

        <CpdRefreshPanel />

        {data?.categoryRequirements ? (
          <Card className="lg:col-span-2">
            <CardEyebrow>Requirements · {data.categoryRequirements.categoryName}</CardEyebrow>
            <CardTitle>What your category needs</CardTitle>
            <div className="mt-4 grid md:grid-cols-3 gap-5 text-sm">
              <div>
                <p className="text-label text-muted mb-2">Certifications</p>
                <ul className="space-y-1.5">
                  {data.categoryRequirements.requiredCertifications.map((rc) => (
                    <li key={rc.name} className="flex items-center gap-2">
                      <Badge tone={rc.met ? 'sage' : 'terracotta'}>{rc.met ? '✓' : 'Needed'}</Badge>
                      <span className="text-ink">{rc.name}</span>
                    </li>
                  ))}
                  {data.categoryRequirements.requiredCertifications.length === 0 ? (
                    <li className="text-muted">None required.</li>
                  ) : null}
                </ul>
              </div>
              <div>
                <p className="text-label text-muted mb-2">Identity</p>
                <ul className="space-y-1.5">
                  {data.categoryRequirements.requiredIdentityFields.map((f) => (
                    <li key={f} className="text-ink">
                      {IDENTITY_FIELD_LABELS[f as IdentityFieldKey] ?? f}
                    </li>
                  ))}
                  {data.categoryRequirements.requiredIdentityFields.length === 0 ? (
                    <li className="text-muted">None required.</li>
                  ) : null}
                </ul>
              </div>
              <div>
                <p className="text-label text-muted mb-2">Compliance</p>
                <ul className="space-y-1.5">
                  {data.categoryRequirements.requiredComplianceFields.map((f) => (
                    <li key={f} className="text-ink">
                      {COMPLIANCE_FIELD_LABELS[f as ComplianceFieldKey] ?? f}
                    </li>
                  ))}
                  {data.categoryRequirements.requiredComplianceFields.length === 0 ? (
                    <li className="text-muted">None required.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </Card>
        ) : null}

        {data?.activeFlags && data.activeFlags.length > 0 ? (
          <Card className="lg:col-span-2 border-terracotta-500/30">
            <CardEyebrow>Active compliance flags</CardEyebrow>
            <CardTitle>Heads up</CardTitle>
            <ul className="mt-4 space-y-3">
              {data.activeFlags.map((f) => (
                <li key={f.id} className="flex items-start gap-3 text-sm">
                  <Badge tone="terracotta">{f.flagType}</Badge>
                  <div>
                    <p className="text-ink">{f.details}</p>
                    <p className="text-xs text-muted mt-1">
                      Raised {new Date(f.raisedAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <Modal open={showCert} onClose={() => setShowCert(false)} title="Add certification">
        <AddCertForm onDone={() => setShowCert(false)} />
      </Modal>
      <Modal open={showCpd} onClose={() => setShowCpd(false)} title="Log a CPD course">
        <AddCpdForm onDone={() => setShowCpd(false)} />
      </Modal>
    </DashboardShell>
  );
}

function CertItem({ c }: { c: Certification }) {
  const days = c.expiresAt ? Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / 86_400_000) : null;
  const expired = days != null && days < 0;
  const soon = days != null && days >= 0 && days <= 60;
  return (
    <li className="rounded-xl border border-ink/8 bg-cream-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{c.issuedBy}</p>
        <Badge tone={c.isOakvaleCert ? 'sage' : 'neutral'}>{labelType(c.certType)}</Badge>
      </div>
      <p className="text-xs text-muted mt-1">
        Issued {c.issuedAt}{c.certNumber ? ` · #${c.certNumber}` : ''}
      </p>
      <p className="text-xs mt-2">
        {c.expiresAt ? (
          <span className={expired ? 'text-terracotta-700' : soon ? 'text-terracotta-700' : 'text-muted'}>
            {expired
              ? `Expired ${Math.abs(days!)} day${Math.abs(days!) === 1 ? '' : 's'} ago`
              : soon
                ? `Expires in ${days} day${days === 1 ? '' : 's'}`
                : `Expires ${c.expiresAt}`}
          </span>
        ) : (
          <span className="text-muted">No expiry recorded</span>
        )}
      </p>
    </li>
  );
}

function CpdItem({ r }: { r: CpdRecord }) {
  return (
    <li className="rounded-xl border border-ink/8 bg-cream-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{r.courseName}</p>
        <Badge tone={r.verifiedByOakvale ? 'sage' : 'neutral'}>{r.verifiedByOakvale ? 'Verified' : 'Pending verification'}</Badge>
      </div>
      <p className="text-xs text-muted mt-1">{r.provider} · completed {r.completedAt}</p>
      {r.hoursCompleted ? <p className="text-xs text-muted mt-1">{r.hoursCompleted} hours</p> : null}
    </li>
  );
}

function labelType(t: string): string {
  switch (t) {
    case 'OAKVALE_FOUNDATION':
      return 'Oakvale · Foundation';
    case 'OAKVALE_ADVANCED':
      return 'Oakvale · Advanced';
    default:
      return 'External';
  }
}
