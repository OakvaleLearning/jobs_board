'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card, CardEyebrow } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api-client';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { REFERRAL_SOURCE_LABELS, type ReferralSource } from '@oakvale/shared/schema/auth';

interface AdminWorkerProfile {
  id: string;
  visibilityStatus: string;
  profileCompletionPct: number;
  referral?: { source: string | null; referrerName: string | null } | null;
  sections: Record<string, unknown>;
}

function referralSourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return REFERRAL_SOURCE_LABELS[source as ReferralSource] ?? source;
}

interface PersonalInfo {
  fullName?: string | null;
  dob?: string | null;
  gender?: string | null;
  nationality?: string | null;
  stateOfOrigin?: string | null;
  lga?: string | null;
  address?: string | null;
  phone?: string | null;
  emergencyContact?: { name?: string | null; relationship?: string | null; phone?: string | null } | string | null;
}

function formatEmergencyContact(ec: PersonalInfo['emergencyContact']): string | null {
  if (!ec) return null;
  if (typeof ec === 'string') return ec;
  const parts = [
    ec.name,
    ec.relationship ? `(${ec.relationship})` : null,
    ec.phone,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

interface Identity {
  idType?: string | null;
  idNumber?: string | null;
}

interface ExperienceItem {
  jobTitle?: string | null;
  employerName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean | null;
  duties?: string | null;
}

interface EducationItem {
  level?: string | null;
  institution?: string | null;
  country?: string | null;
  endDate?: string | null;
}

interface SkillItem {
  name?: string | null;
  selfRating?: number | null;
}

export function AdminWorkerDetail({ workerId }: { workerId: string }) {
  const hydrated = useHydratedTokens();

  const profile = useQuery({
    queryKey: ['adminWorker', workerId],
    queryFn: () => api.get<{ data: AdminWorkerProfile }>(`/workers/${workerId}`).then((r) => r.data),
    enabled: hydrated,
  });

  const data = profile.data;
  const sections = (data?.sections ?? {}) as Record<string, unknown>;
  const a = (sections.A ?? null) as PersonalInfo | null;
  const b = (sections.B ?? null) as Identity | null;
  const extras = (sections.I ?? null) as { interests?: string | null; personalStatement?: string | null } | null;
  const experience = ((sections.E as { items?: ExperienceItem[] } | null)?.items ?? []) as ExperienceItem[];
  const education = ((sections.D as { items?: EducationItem[] } | null)?.items ?? []) as EducationItem[];
  const skills = ((sections.H as { items?: SkillItem[] } | null)?.items ?? []) as SkillItem[];

  return (
    <AdminShell>
      <Link
        href="/admin/workers"
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink/12 bg-white px-4 h-9 text-sm font-medium text-ink transition hover:border-brand-500/40 hover:bg-cream-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to roster
      </Link>

      <PageHeader
        eyebrow="Admin · worker"
        title={a?.fullName ?? 'Worker profile'}
        description="Operations view of the full worker profile. No visibility gate applied."
        actions={
          data?.visibilityStatus === 'PENDING_REVIEW' ? (
            <Link
              href={`/admin/verification/${workerId}`}
              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink hover:bg-ink/5"
            >
              Review for verification
            </Link>
          ) : null
        }
      />

      {!data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-5">
            <Card>
              <CardEyebrow>Personal</CardEyebrow>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Detail label="Full name" value={a?.fullName} />
                <Detail label="Date of birth" value={a?.dob} />
                <Detail label="Gender" value={a?.gender} />
                <Detail label="Nationality" value={a?.nationality} />
                <Detail label="State of origin" value={a?.stateOfOrigin} />
                <Detail label="LGA" value={a?.lga} />
                <Detail label="Phone" value={a?.phone} />
                <Detail label="Emergency contact" value={formatEmergencyContact(a?.emergencyContact)} />
                <Detail label="Address" value={a?.address} className="col-span-2" />
              </dl>
            </Card>

            <Card>
              <CardEyebrow>Identity</CardEyebrow>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Detail label="ID type" value={b?.idType} />
                <Detail label="ID number" value={b?.idNumber} />
              </dl>
            </Card>

            {extras?.personalStatement ? (
              <Card>
                <CardEyebrow>Personal statement</CardEyebrow>
                <p className="text-ink-600 mt-3 leading-relaxed">{extras.personalStatement}</p>
              </Card>
            ) : null}

            <Card>
              <CardEyebrow>Experience</CardEyebrow>
              <ul className="mt-3 space-y-4">
                {experience.length === 0 ? (
                  <li className="text-sm text-muted">No experience entries.</li>
                ) : null}
                {experience.map((e, i) => (
                  <li key={i} className="border-l-2 border-ink/10 pl-4">
                    <p className="font-medium text-ink">
                      {e.jobTitle ?? '—'} <span className="text-muted">@ {e.employerName ?? '—'}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {e.startDate ?? ''} – {e.isCurrent ? 'present' : e.endDate ?? ''}
                    </p>
                    {e.duties ? <p className="text-sm text-ink-600 mt-1">{e.duties}</p> : null}
                  </li>
                ))}
              </ul>
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
                      {e.institution ?? '—'} · {e.country ?? '—'}
                      {e.endDate ? ` · ${e.endDate}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <CardEyebrow>Status</CardEyebrow>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-ink-600">Visibility</span>
                <Badge
                  tone={
                    data.visibilityStatus === 'APPROVED'
                      ? 'sage'
                      : data.visibilityStatus === 'REJECTED' || data.visibilityStatus === 'SUSPENDED'
                        ? 'terracotta'
                        : 'neutral'
                  }
                >
                  {data.visibilityStatus}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-ink-600">Profile complete</span>
                <span className="tabular-nums text-ink">{data.profileCompletionPct}%</span>
              </div>
            </Card>

            <Card>
              <CardEyebrow>Referral</CardEyebrow>
              <dl className="mt-3 space-y-3 text-sm">
                <Detail label="Source" value={referralSourceLabel(data.referral?.source)} />
                {data.referral?.referrerName ? (
                  <Detail label="Referred by" value={data.referral.referrerName} />
                ) : null}
              </dl>
            </Card>

            <Card>
              <CardEyebrow>Skills</CardEyebrow>
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.length === 0 ? <p className="text-sm text-muted">None listed.</p> : null}
                {skills.map((s, i) => (
                  <Badge key={i} tone="neutral">
                    {s.name}
                    {s.selfRating ? ` · ${s.selfRating}/5` : ''}
                  </Badge>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      )}
    </AdminShell>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-eyebrow text-muted">{label}</dt>
      <dd className="text-ink mt-0.5">{value ?? '—'}</dd>
    </div>
  );
}
