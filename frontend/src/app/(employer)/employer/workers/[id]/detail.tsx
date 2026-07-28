'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { employersApi, type PublicWorkerProfile } from '@/lib/employers-api';
import { WorkerRatingsCard } from '@/components/placements/WorkerRatings';
import { RequestInterviewButton } from '@/components/interviews/RequestInterviewButton';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export function WorkerDetail({ id }: { id: string }) {
  const hydrated = useHydratedTokens();

  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });
  const detail = useQuery({
    queryKey: ['employerWorker', id],
    queryFn: () => employersApi.getBrowsedWorker(id),
    enabled: hydrated,
  });

  return (
    <EmployerShell config={profile.data?.employerTypeConfig}>
      <Link
        href="/employer/workers"
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-4 h-9 text-sm font-medium text-ink transition hover:border-brand-500/40 hover:bg-cream-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to browse
      </Link>
      <PageHeader
        eyebrow="Worker · profile"
        title={detail.data?.personal.fullName ?? 'Worker profile'}
        description="Public-safe view. We never expose DOB, address, phone, or document numbers, only what you need to evaluate fit."
      />

      {!detail.data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <DetailBody profile={detail.data} workerId={id} />
      )}
    </EmployerShell>
  );
}

function DetailBody({ profile, workerId }: { profile: PublicWorkerProfile; workerId: string }) {
  const skills = profile.skills ?? [];
  const experience = profile.experience as Array<{
    jobTitle?: string;
    employerName?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    duties?: string;
  }>;
  const education = profile.education as Array<{
    level?: string;
    institution?: string;
    country?: string;
    endDate?: string;
  }>;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-5">
        <Card>
          <CardEyebrow>Personal statement</CardEyebrow>
          <p className="text-ink-600 mt-3 leading-relaxed">
            {profile.personalStatement ?? 'No statement on file.'}
          </p>
        </Card>

        <Card>
          <CardEyebrow>Experience</CardEyebrow>
          <ul className="mt-3 space-y-4">
            {experience.length === 0 ? (
              <li className="text-sm text-muted">No experience entries.</li>
            ) : null}
            {experience.map((e, i) => (
              <li key={i} className="border-l-2 border-ink/10 pl-4">
                <p className="font-medium text-ink">
                  {e.jobTitle ?? '—'}{' '}
                  <span className="text-muted">@ {e.employerName ?? '—'}</span>
                </p>
                <p className="text-xs text-muted">
                  {e.startDate ?? ''} - {e.isCurrent ? 'present' : e.endDate ?? ''}
                </p>
                {e.duties ? <p className="text-sm text-ink-600 mt-1">{e.duties}</p> : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardEyebrow>Skills</CardEyebrow>
          <div className="mt-3 flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <Badge key={i} tone="neutral">
                {s.name}
                {s.selfRating ? ` · ${s.selfRating}/5` : ''}
              </Badge>
            ))}
            {skills.length === 0 ? <p className="text-sm text-muted">None listed.</p> : null}
          </div>
        </Card>

        <Card>
          <CardEyebrow>Education</CardEyebrow>
          <ul className="mt-3 space-y-3">
            {education.length === 0 ? (
              <li className="text-sm text-muted">No qualifications listed.</li>
            ) : null}
            {education.map((e, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-ink">{e.level ?? '—'}</p>
                <p className="text-muted">
                  {e.institution ?? '—'} · {e.country ?? '—'}{e.endDate ? ` · ${e.endDate}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <aside className="space-y-5">
        <Card>
          <CardEyebrow>Engage this carer</CardEyebrow>
          <p className="text-sm text-muted mt-2">
            Propose interview times. We&apos;ll notify the carer to confirm a slot.
          </p>
          <div className="mt-4">
            <RequestInterviewButton workerId={workerId} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <Avatar
              src={profile.photoUrl}
              name={profile.personal.fullName}
              blurred={!profile.photoUnlocked}
              size="lg"
            />
            <div className="min-w-0">
              <CardEyebrow>Worker</CardEyebrow>
              <p className="h-display text-lg truncate">
                {profile.personal.fullName ?? 'Unnamed worker'}
              </p>
              {!profile.photoUnlocked ? (
                <p className="text-xs text-muted mt-0.5">Photo unlocks after engagement</p>
              ) : null}
            </div>
          </div>
        </Card>

        <WorkerRatingsCard workerId={workerId} />

        <Card>
          <CardEyebrow>Credentials</CardEyebrow>
          <ul className="mt-3 space-y-2 text-sm">
            <CredentialRow label="Identity verified" ok={profile.credentials.identityVerified} />
            <CredentialRow label="Background CLEAR" ok={profile.credentials.backgroundClear} />
            <CredentialRow label="Oakvale CPD active" ok={profile.credentials.oakvaleCertified} />
          </ul>
          {profile.credentials.latestOakvaleCertExpiresAt ? (
            <p className="text-xs text-muted mt-4">
              Latest CPD expires {profile.credentials.latestOakvaleCertExpiresAt}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardEyebrow>Location</CardEyebrow>
          <CardTitle>{profile.personal.stateOfOrigin ?? '—'}</CardTitle>
          <p className="text-sm text-muted mt-1">
            {profile.personal.lga ?? ''}{profile.personal.lga ? ', ' : ''}{profile.personal.nationality ?? ''}
          </p>
        </Card>

        <Card>
          <CardEyebrow>Preferences</CardEyebrow>
          <p className="text-sm text-ink-600 mt-3">
            Employment: {profile.preferences.employmentType ?? '—'}
          </p>
          <p className="text-sm text-ink-600">
            Relocation: {profile.preferences.relocationWillingness ? 'Yes' : 'No'}
          </p>
        </Card>

        {profile.salary ? (
          <Card>
            <CardEyebrow>Salary expectations</CardEyebrow>
            <p className="text-sm text-ink-600 mt-3">
              {profile.salary.minRate} - {profile.salary.maxRate} {profile.salary.currency} ·{' '}
              {profile.salary.wageStructure?.toLowerCase()}
              {profile.salary.negotiable ? ' · negotiable' : ''}
            </p>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}

function CredentialRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-ink-600">{label}</span>
      <Badge tone={ok ? 'sage' : 'neutral'}>{ok ? 'Yes' : 'No'}</Badge>
    </li>
  );
}
