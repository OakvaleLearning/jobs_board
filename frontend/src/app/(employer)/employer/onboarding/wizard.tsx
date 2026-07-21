'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { employersApi, type EmployerProfile } from '@/lib/employers-api';
import { Lockup } from '@/components/brand/Lockup';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { OrgStep } from './steps/org';
import { ContactStep } from './steps/contact';
import { IndividualEmployerNeedsStep } from './steps/individual-employer-needs';
import { CorporateNeedsStep } from './steps/corporate-needs';
import { NdpaStep } from './steps/ndpa';
import { DocumentsStep } from './steps/documents';
import { DoneStep } from './steps/done';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

type StepKey = 'org' | 'contact' | 'needs' | 'ndpa' | 'documents' | 'done';

export function OnboardingWizard() {
  const router = useRouter();
  const hydrated = useHydratedTokens();
  const [step, setStep] = useState<StepKey>('org');

  const profile = useQuery({
    queryKey: ['employerProfile'],
    queryFn: employersApi.me,
    enabled: hydrated,
  });

  // §5: onboarding always returns to the unified, config-driven dashboard.
  const dashboardHref = '/employer/dashboard';

  useEffect(() => {
    if (profile.data?.onboardingCompletedAt) {
      router.replace(dashboardHref);
    }
  }, [profile.data?.onboardingCompletedAt, router, dashboardHref]);

  const configSteps = profile.data?.employerTypeConfig?.onboardingSteps;
  const usesIndividualEmployerNeeds = profile.data?.employerTypeConfig?.usesIndividualEmployerNeeds ?? false;

  const steps = useMemo<{ key: StepKey; label: string }[]>(() => {
    if (configSteps && configSteps.length > 0) {
      const out: { key: StepKey; label: string }[] = [];
      for (const k of configSteps) {
        if (k === 'org') out.push({ key: 'org', label: 'Organisation' });
        else if (k === 'contact') out.push({ key: 'contact', label: 'Primary contact' });
        else if (k === 'individual_employer_needs') out.push({ key: 'needs', label: 'Care assessment' });
        else if (k === 'corporate_needs') out.push({ key: 'needs', label: 'Workforce needs' });
        else if (k === 'ndpa') out.push({ key: 'ndpa', label: 'NDPA consent' });
      }
      out.push({ key: 'documents', label: 'Verification documents' });
      out.push({ key: 'done', label: 'Done' });
      return out;
    }
    const base: { key: StepKey; label: string }[] = [
      { key: 'org', label: 'Organisation' },
      { key: 'contact', label: 'Primary contact' },
      { key: 'needs', label: usesIndividualEmployerNeeds ? 'Care assessment' : 'Workforce needs' },
    ];
    if (profile.data?.employerType === 'CORPORATE') base.push({ key: 'ndpa', label: 'NDPA consent' });
    base.push({ key: 'documents', label: 'Verification documents' });
    base.push({ key: 'done', label: 'Done' });
    return base;
  }, [configSteps, usesIndividualEmployerNeeds, profile.data?.employerType]);

  function next() {
    const idx = steps.findIndex((s) => s.key === step);
    const nextStep = steps[idx + 1];
    if (nextStep) setStep(nextStep.key);
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="border-b border-ink/8 px-6 h-16 flex items-center justify-between">
        <Lockup size="md" />
        <Badge tone="neutral">Onboarding · {profile.data?.employerType?.toLowerCase() ?? '…'}</Badge>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 grid lg:grid-cols-[220px_1fr] gap-10">
        <aside className="space-y-2 lg:sticky lg:top-6 self-start">
          <p className="text-eyebrow text-muted mb-3">Steps</p>
          {steps.map((s, i) => {
            const active = s.key === step;
            const completed = steps.findIndex((x) => x.key === step) > i;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                className={cn(
                  'w-full text-left rounded-xl px-3 py-2 text-sm transition flex items-center gap-3',
                  active ? 'bg-primary text-white' : 'text-ink-600 hover:bg-ink/5',
                )}
              >
                <span
                  className={cn(
                    'h-5 w-5 rounded-full grid place-items-center text-[12px]',
                    active
                      ? 'bg-cream-50 text-ink'
                      : completed
                        ? 'bg-primary text-white'
                        : 'bg-ink/10 text-ink-600',
                  )}
                >
                  {completed ? '✓' : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </aside>

        <main className="space-y-6">
          <div className="space-y-2">
            <p className="text-eyebrow text-muted">Step {steps.findIndex((s) => s.key === step) + 1} of {steps.length}</p>
            <h1 className="h-display text-3xl md:text-4xl">{titleFor(step, profile.data)}</h1>
          </div>

          {!profile.data ? (
            <div className="rounded-2xl border border-ink/8 bg-cream-50/60 p-12 text-center text-muted text-sm">
              Loading…
            </div>
          ) : (
            <StepRouter
              step={step}
              profile={profile.data}
              usesIndividualEmployerNeeds={usesIndividualEmployerNeeds}
              onNext={next}
              onFinish={() => router.replace(dashboardHref)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function titleFor(step: StepKey, p: EmployerProfile | undefined): string {
  switch (step) {
    case 'org':
      return p?.employerType === 'INDIVIDUAL_EMPLOYER' ? 'Your family contact details.' : 'Your organisation.';
    case 'contact':
      return 'Primary contact.';
    case 'needs':
      return p?.employerType === 'INDIVIDUAL_EMPLOYER' ? 'Care recipient assessment.' : 'Workforce needs assessment.';
    case 'ndpa':
      return 'NDPA 2023 data-processing consent.';
    case 'documents':
      return 'Verification documents.';
    case 'done':
      return 'You’re ready.';
  }
}

function StepRouter({
  step,
  profile,
  usesIndividualEmployerNeeds,
  onNext,
  onFinish,
}: {
  step: StepKey;
  profile: EmployerProfile;
  usesIndividualEmployerNeeds: boolean;
  onNext: () => void;
  onFinish: () => void;
}) {
  switch (step) {
    case 'org':
      return <OrgStep profile={profile} onNext={onNext} />;
    case 'contact':
      return <ContactStep profile={profile} onNext={onNext} />;
    case 'needs':
      return usesIndividualEmployerNeeds
        ? <IndividualEmployerNeedsStep profile={profile} onNext={onNext} />
        : <CorporateNeedsStep profile={profile} onNext={onNext} />;
    case 'ndpa':
      return <NdpaStep profile={profile} onNext={onNext} />;
    case 'documents':
      return <DocumentsStep profile={profile} onNext={onNext} />;
    case 'done':
      return <DoneStep profile={profile} onFinish={onFinish} />;
  }
}
