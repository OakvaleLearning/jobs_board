'use client';

import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Input, Label } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { employerTypesApi } from '@/lib/employer-types-api';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import { TextLink } from '@/components/ui/Link';
import { cn } from '@/lib/cn';
import {
  REFERRAL_SOURCES,
  REFERRAL_SOURCE_LABELS,
  type ReferralSource,
} from '@oakvale/shared/schema/auth';

/** A signup choice is either the worker role or a specific configurable employer type. */
type Choice = { kind: 'WORKER' } | { kind: 'EMPLOYER'; typeId: string; roleKey: string };

interface FormValues {
  fullName: string;
  email: string;
  password: string;
  referralSource: ReferralSource | '';
  referrerName: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedBackgroundCheck: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTypeSlug = params.get('type'); // optional ?type=INDIVIDUAL_EMPLOYER hint from marketing

  const types = useQuery({
    queryKey: ['employerTypes', 'public'],
    queryFn: () => employerTypesApi.listPublic(),
  });

  const [choice, setChoice] = useState<Choice>({ kind: 'WORKER' });
  const [done, setDone] = useState(false);

  // Seed the selection from the marketing ?type= hint exactly once (when types
  // load). After that the user is free to pick any option and it sticks — the
  // hint must never re-apply on later renders or the worker card can't be chosen.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !types.data) return;
    seededRef.current = true;
    if (!initialTypeSlug) return;
    const hinted = types.data.find((t) => t.slug === initialTypeSlug);
    if (hinted) setChoice({ kind: 'EMPLOYER', typeId: hinted.id, roleKey: hinted.roleKey });
  }, [initialTypeSlug, types.data]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const referralSource = watch('referralSource');
  const showReferrerName = referralSource === 'PERSONAL_REFERRAL';

  async function onSubmit(values: FormValues) {
    try {
      const consent = {
        acceptedTerms: values.acceptedTerms,
        acceptedPrivacy: values.acceptedPrivacy,
        acceptedBackgroundCheck: values.acceptedBackgroundCheck,
      };
      // Referral attribution (brief §2) — omit empty values; only send the referrer
      // name for personal referrals.
      const referral = {
        ...(values.referralSource ? { referralSource: values.referralSource } : {}),
        ...(values.referralSource === 'PERSONAL_REFERRAL' && values.referrerName
          ? { referrerName: values.referrerName.trim() }
          : {}),
      };
      const body =
        choice.kind === 'WORKER'
          ? { fullName: values.fullName, email: values.email, password: values.password, role: 'WORKER' as const, ...referral, ...consent }
          : {
              fullName: values.fullName,
              email: values.email,
              password: values.password,
              role: 'EMPLOYER' as const,
              employerTypeId: choice.typeId,
              ...referral,
              ...consent,
            };
      await api.post('/auth/register', body);
      toast.success('Account created. Check your email for a verification link.');
      setDone(true);
      const next =
        choice.kind === 'WORKER' ? '/worker/dashboard' : '/employer/onboarding';
      setTimeout(() => router.push(`/login?next=${next}`), 1200);
    } catch (e) {
      toastApiError(e, 'Something went wrong.');
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-eyebrow text-muted">Account created</p>
        <h1 className="h-display text-3xl md:text-4xl">Check your email.</h1>
        <p className="text-sm text-ink-600">
          We&rsquo;ve sent a verification link to your email. Open it to confirm your
          address. Redirecting you to sign in…
        </p>
      </div>
    );
  }

  const isWorker = choice.kind === 'WORKER';

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-eyebrow text-muted">Create an account</p>
        <h1 className="h-display text-3xl md:text-4xl">Get started.</h1>
        <p className="text-sm text-ink-600">
          Already here? <TextLink href="/login">Sign in</TextLink>.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-eyebrow text-muted">Looking for work</p>
          <div className="p-1 rounded-2xl bg-ink/5">
            <ChoiceCard
              title="Care worker"
              subtitle="Build a credentialed profile."
              active={isWorker}
              onClick={() => setChoice({ kind: 'WORKER' })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-ink/8" />
          <span className="text-eyebrow text-muted">or</span>
          <span className="h-px flex-1 bg-ink/8" />
        </div>

        <div className="space-y-1.5">
          <p className="text-eyebrow text-muted">Hiring care workers</p>
          <div className="grid sm:grid-cols-2 gap-2 p-1 rounded-2xl bg-ink/5">
            {(types.data ?? []).map((t) => (
              <ChoiceCard
                key={t.id}
                title={t.name}
                subtitle={t.description ?? 'Hire verified workers.'}
                active={!isWorker && choice.kind === 'EMPLOYER' && choice.typeId === t.id}
                onClick={() => setChoice({ kind: 'EMPLOYER', typeId: t.id, roleKey: t.roleKey })}
              />
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, toastFormErrors)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" autoComplete="name" {...register('fullName', { required: 'Your name is required.' })} error={errors.fullName?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email', { required: 'Email is required.' })} error={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password', { required: 'Password is required.', minLength: { value: 10, message: 'At least 10 characters.' } })}
            error={errors.password?.message}
          />
          <p className="text-[11px] text-muted">At least 10 characters. Mix it up.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="referralSource">How did you hear about the jobs board?</Label>
          <Select id="referralSource" defaultValue="" {...register('referralSource')}>
            <option value="" disabled>
              Select an option…
            </option>
            {REFERRAL_SOURCES.map((source) => (
              <option key={source} value={source}>
                {REFERRAL_SOURCE_LABELS[source]}
              </option>
            ))}
          </Select>
        </div>

        {showReferrerName ? (
          <div className="space-y-1.5">
            <Label htmlFor="referrerName">Who referred you?</Label>
            <Input
              id="referrerName"
              placeholder="Their full name"
              autoComplete="off"
              {...register('referrerName', {
                required: 'Please enter the name of the person who referred you.',
              })}
              error={errors.referrerName?.message}
            />
            <p className="text-[11px] text-muted">
              A name is fine — we use it to thank the person who sent you our way.
            </p>
          </div>
        ) : null}

        <div className="space-y-2.5 pt-1">
          <Consent
            id="acceptedTerms"
            error={errors.acceptedTerms?.message}
            {...register('acceptedTerms', { required: 'You must accept the terms of service.' })}
          >
            I accept the{' '}
            <TextLink href="/legal/terms" target="_blank">
              terms of service
            </TextLink>
            .
          </Consent>
          <Consent
            id="acceptedPrivacy"
            error={errors.acceptedPrivacy?.message}
            {...register('acceptedPrivacy', { required: 'You must accept the privacy policy.' })}
          >
            I accept the{' '}
            <TextLink href="/legal/privacy" target="_blank">
              privacy policy
            </TextLink>{' '}
            (NDPA 2023).
          </Consent>
          {isWorker ? (
            <Consent
              id="acceptedBackgroundCheck"
              error={errors.acceptedBackgroundCheck?.message}
              {...register('acceptedBackgroundCheck', {
                required: 'You must consent to a background check to register.',
              })}
            >
              I consent to a{' '}
              <TextLink href="/legal/background-check" target="_blank">
                background check
              </TextLink>{' '}
              (police, guarantor &amp; affidavit documents).
            </Consent>
          ) : null}
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}

const Consent = forwardRef<
  HTMLInputElement,
  { id: string; error?: string; children: ReactNode } & InputHTMLAttributes<HTMLInputElement>
>(function Consent({ id, error, children, ...props }, ref) {
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2.5 text-sm text-ink-600">
        <input
          id={id}
          type="checkbox"
          ref={ref}
          className="mt-0.5 h-4 w-4 rounded border-ink/30 accent-ink"
          {...props}
        />
        <span>{children}</span>
      </label>
      {error ? <p className="text-[11px] text-terracotta-700 mt-1 ml-6">{error}</p> : null}
    </div>
  );
});

function ChoiceCard({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative rounded-xl border px-3 py-3 pr-9 text-left transition',
        active
          ? 'border-primary-500 bg-white ring-2 ring-primary-500 shadow-card'
          : 'border-ink/10 bg-white/50 hover:border-ink/20 hover:bg-cream-50/60',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full transition',
          active ? 'bg-primary-500 text-white' : 'border border-ink/15 text-transparent',
        )}
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className={cn('text-sm font-medium', active ? 'text-ink' : 'text-ink-600')}>{title}</p>
      <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{subtitle}</p>
    </button>
  );
}
