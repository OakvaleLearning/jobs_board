'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workersApi } from '@/lib/workers-api';
import { verificationApi } from '@/lib/verification-api';
import { DashboardShell, PageHeader } from '@/components/dashboard/Shell';
import { CompletionBar } from './CompletionBar';
import { ProfilePhoto } from './ProfilePhoto';
import { cn } from '@/lib/cn';
import { REVALIDATION_SECTIONS, WORKER_SECTIONS, type WorkerSection } from '@oakvale/shared/enums/worker';
import { Button } from '@/components/ui/Button';
import { SectionA } from './sections/a';
import { SectionB } from './sections/b';
import { SectionC } from './sections/c';
import { SectionD } from './sections/d';
import { SectionE } from './sections/e';
import { SectionF } from './sections/f';
import { SectionG } from './sections/g';
import { SectionI } from './sections/i';
import { SectionJ } from './sections/j';
import { SectionK } from './sections/k';
import { SectionL } from './sections/l';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { WORKER_NAV } from '@/lib/worker-nav';

const SECTION_META: Record<WorkerSection, { title: string; description: string }> = {
  A: { title: 'Personal information', description: 'Who you are and how to reach you.' },
  B: { title: 'Identity verification', description: 'A valid ID, a selfie, and proof of address.' },
  C: { title: 'Background check', description: 'Consent + upload your background documents for review.' },
  D: { title: 'Educational qualifications', description: 'Add every qualification you want recognised.' },
  E: { title: 'Professional experience', description: 'Each role you want employers to weigh.' },
  F: { title: 'References', description: 'People who can vouch for your work.' },
  G: { title: 'Preferences & availability', description: 'When and where you want to work.' },
  // Section H (skills & specialization) is intentionally not shown to caregivers
  // (brief §4): Oakvale training has no specialty tracks, so self-declared
  // specialties would mislead employers. What care a role needs is captured on
  // the employer's job posting instead (brief §5).
  H: { title: 'Skills & competencies', description: 'Not collected.' },
  I: { title: 'Interests & personal statement', description: 'Help employers see the person behind the credentials.' },
  J: { title: 'Video introduction', description: 'A short clip. Optional but lifts shortlist rate.' },
  K: { title: 'Salary expectations', description: 'A range we can negotiate within.' },
  L: { title: 'Compliance & training', description: 'CPD enrolment, Oakvale programme, immunisation.' },
};

/** Sections shown to caregivers — Section H is withheld per brief §4. */
const VISIBLE_SECTIONS = WORKER_SECTIONS.filter((s) => s !== 'H');

export function ProfileEditor() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<WorkerSection>('A');
  const hydrated = useHydratedTokens();


  const profileQuery = useQuery({
    queryKey: ['workerProfile'],
    queryFn: workersApi.getProfile,
    enabled: hydrated,
  });

  const completionQuery = useQuery({
    queryKey: ['workerCompletion'],
    queryFn: workersApi.getCompletion,
    enabled: hydrated,
  });

  const verificationQuery = useQuery({
    queryKey: ['verificationStatus'],
    queryFn: verificationApi.me,
    enabled: hydrated,
  });

  const submitMutation = useMutation({
    mutationFn: () => workersApi.submit(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workerProfile'] });
      void queryClient.invalidateQueries({ queryKey: ['verificationStatus'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => workersApi.cancelSubmission(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workerProfile'] }),
  });

  const requestEditMutation = useMutation({
    mutationFn: () => workersApi.requestEdit(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workerProfile'] }),
  });

  function onRequestEdit() {
    if (
      window.confirm(
        'Editing verified details requires revalidation by our team. While the changes are reviewed, your profile will be hidden from employers. Continue?',
      )
    ) {
      requestEditMutation.mutate();
    }
  }

  const profile = profileQuery.data;
  const pct = completionQuery.data ?? profile?.profileCompletionPct ?? 0;

  return (
    <DashboardShell surface="Worker portal" nav={WORKER_NAV}>
      <PageHeader
        eyebrow="Worker · profile"
        title="Your credentialed profile."
        description="Save as you go. Submit for review at 80% or above. Our agents take it from there."
        actions={<ProfilePhoto />}
      />

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-2 lg:sticky lg:top-4 self-start">
          {VISIBLE_SECTIONS.map((s) => {
            const meta = SECTION_META[s];
            const active = section === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={cn(
                  'w-full text-left rounded-xl px-3 py-2.5 transition flex items-center gap-3',
                  active ? 'bg-ink text-cream-50' : 'hover:bg-ink/5 text-ink-600',
                )}
              >
                <span className={cn('h-display text-base w-5', active ? 'text-cream-200/80' : 'text-muted')}>{s}</span>
                <span className="text-sm">{meta.title}</span>
              </button>
            );
          })}
        </aside>

        <div className="space-y-6">
          <CompletionBar
            pct={pct}
            visibilityStatus={profile?.visibilityStatus ?? 'DRAFT'}
            onSubmit={() => submitMutation.mutate()}
            submitting={submitMutation.isPending}
            onCancel={() => cancelMutation.mutate()}
            cancelling={cancelMutation.isPending}
            rejectionReason={verificationQuery.data?.identity.notes}
          />

          {!profile ? (
            <div className="rounded-2xl border border-ink/8 bg-cream-50/60 p-12 text-center text-muted text-sm">
              Loading your profile…
            </div>
          ) : profile.visibilityStatus === 'APPROVED' &&
            (REVALIDATION_SECTIONS as readonly string[]).includes(section) ? (
            <LockedSection
              title={SECTION_META[section].title}
              onRequest={onRequestEdit}
              pending={requestEditMutation.isPending}
            />
          ) : (
            <SectionRouter section={section} profile={profile} />
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function LockedSection({
  title,
  onRequest,
  pending,
}: {
  title: string;
  onRequest: () => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-2xl border border-ink/8 bg-cream-50/60 p-10 text-center space-y-4">
      <p className="text-eyebrow text-muted">Verified detail · locked</p>
      <p className="h-display text-xl text-ink">{title} is locked.</p>
      <p className="text-sm text-ink-600 max-w-md mx-auto">
        This section was verified by our team. Editing it requires revalidation. While we re-review
        your changes, your profile will be hidden from employers.
      </p>
      <Button size="sm" variant="outline" type="button" onClick={onRequest} disabled={pending}>
        {pending ? 'Unlocking…' : 'Request changes'}
      </Button>
    </div>
  );
}

function SectionRouter({
  section,
  profile,
}: {
  section: WorkerSection;
  profile: { sections: Record<WorkerSection, unknown> };
}) {
  switch (section) {
    case 'A':
      return <SectionA initial={profile.sections.A} />;
    case 'B':
      return <SectionB initial={profile.sections.B} />;
    case 'C':
      return <SectionC initial={profile.sections.C} />;
    case 'D':
      return <SectionD initial={profile.sections.D} />;
    case 'E':
      return <SectionE initial={profile.sections.E} />;
    case 'F':
      return <SectionF initial={profile.sections.F} />;
    case 'G':
      return <SectionG initial={profile.sections.G} />;
    case 'H':
      // Withheld from caregivers (brief §4) — never selectable from the sidebar.
      return null;
    case 'I':
      return <SectionI initial={profile.sections.I} />;
    case 'J':
      return <SectionJ initial={profile.sections.J} />;
    case 'K':
      return <SectionK initial={profile.sections.K} />;
    case 'L':
      return <SectionL initial={profile.sections.L} />;
  }
}
