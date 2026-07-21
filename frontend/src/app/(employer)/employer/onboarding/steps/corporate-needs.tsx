'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  corporateNeedsAssessmentSchema,
  type CorporateNeedsAssessmentInput,
} from '@oakvale/shared/schema/employer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { ChipsInput } from '@/app/(worker)/worker/profile/sections/ChipsInput';
import { SECTOR_LABELS } from '@oakvale/shared/enums/worker';
import { cn } from '@/lib/cn';
import { toastApiError, toastFormErrors } from '@/lib/toast';
import { employersApi, type EmployerProfile } from '@/lib/employers-api';

// Operating days for the "Hours of operation" field. The assessment records the
// days the site runs and its daily hours — not a calendar date.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// Budget parameters: currency + min/max + period, composed into the string.
const CURRENCIES = ['NGN', 'GBP', 'USD'] as const;
const PERIODS = ['hour', 'day', 'week', 'month', 'year'] as const;

// Sector-aware copy for the workforce-needs step. The org step stores the human
// sector label in `profile.sector`; we adapt labels/placeholders/copy and hide
// the child-only "Age ranges served" field for elderly / home care.
const SECTOR_COPY = {
  elderly: {
    intro:
      'Workforce sizing and the care needs of the people you support. We’ll match to certified elderly / home-care workers.',
    skillsPlaceholder: 'e.g. Dementia care, mobility assistance, medication management',
    showAgeRanges: false,
    ageRangesLabel: 'Age ranges served',
    ageRangesPlaceholder: '',
  },
  creche: {
    intro:
      'Workforce sizing and the skills you need. We’ll match to certified early-years caregivers.',
    skillsPlaceholder: 'e.g. Paediatric first aid, SEND experience',
    showAgeRanges: true,
    ageRangesLabel: 'Age ranges served',
    ageRangesPlaceholder: 'e.g. 0–12 months, 1–2 yrs',
  },
  default: {
    intro: 'Workforce sizing and the skills you need. We’ll match to certified caregivers.',
    skillsPlaceholder: 'e.g. Paediatric first aid, SEND experience',
    showAgeRanges: true,
    ageRangesLabel: 'Age ranges served',
    ageRangesPlaceholder: 'e.g. 0–12 months, 1–2 yrs',
  },
} as const;

export function CorporateNeedsStep({
  profile,
  onNext,
}: {
  profile: EmployerProfile;
  onNext: () => void;
}) {
  const queryClient = useQueryClient();
  const isIndividualEmployer =
    profile.employerTypeConfig?.usesIndividualEmployerNeeds ??
    profile.employerType === 'INDIVIDUAL_EMPLOYER';
  const copy =
    profile.sector === SECTOR_LABELS.ELDERLY_CARE
      ? SECTOR_COPY.elderly
      : profile.sector === SECTOR_LABELS.CRECHE_EARLY_YEARS
        ? SECTOR_COPY.creche
        : SECTOR_COPY.default;
  const seed = (profile.corporateNeedsAssessment ?? {}) as Partial<CorporateNeedsAssessmentInput>;
  // Best-effort parse of the stored string so editing repopulates. Legacy
  // datetime-local values still contain an HH:MM, so they degrade gracefully.
  const seedHours = seed.hoursOfOperation ?? '';
  const seedTimes = seedHours.match(/\d{1,2}:\d{2}/g) ?? [];
  const [selectedDays, setSelectedDays] = useState<string[]>(
    DAYS.filter((d) => seedHours.includes(d)),
  );
  const [fromTime, setFromTime] = useState(seedTimes[0] ?? '');
  const [toTime, setToTime] = useState(seedTimes[1] ?? '');
  // Budget: best-effort parse of the stored string so editing repopulates.
  const seedBudget = seed.budgetParameters ?? '';
  const seedAmounts = seedBudget.match(/[\d,]+(?:\.\d+)?/g) ?? [];
  const [budgetCurrency, setBudgetCurrency] = useState<string>(
    CURRENCIES.find((c) => seedBudget.includes(c)) ?? 'NGN',
  );
  const [budgetMin, setBudgetMin] = useState(seedAmounts[0]?.replace(/,/g, '') ?? '');
  const [budgetMax, setBudgetMax] = useState(seedAmounts[1]?.replace(/,/g, '') ?? '');
  const [budgetPeriod, setBudgetPeriod] = useState<string>(
    PERIODS.find((p) => seedBudget.includes(p)) ?? 'month',
  );
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CorporateNeedsAssessmentInput>({
    resolver: zodResolver(corporateNeedsAssessmentSchema),
    defaultValues: {
      numStaffRequired: seed.numStaffRequired ?? 1,
      ageRangesServed: seed.ageRangesServed ?? [],
      hoursOfOperation: seed.hoursOfOperation ?? '',
      existingStaffCount: seed.existingStaffCount ?? 0,
      specificSkillsNeeded: seed.specificSkillsNeeded ?? [],
      budgetParameters: seed.budgetParameters ?? '',
      siteAssessmentNotes: seed.siteAssessmentNotes ?? '',
    },
  });
  const v = watch();

  function composeHours(days: string[], from: string, to: string) {
    const daysPart = days.join(', ');
    const timePart = [from, to].filter(Boolean).join('–');
    const nextValue = [daysPart, timePart].filter(Boolean).join(' · ');
    setValue('hoursOfOperation', nextValue, { shouldDirty: true });
  }

  function composeBudget(currency: string, min: string, max: string, period: string) {
    const amount = [min, max].filter(Boolean).join('–');
    const head = [currency, amount].filter(Boolean).join(' ');
    const nextValue = period && head ? `${head} / ${period}` : head;
    setValue('budgetParameters', nextValue, { shouldDirty: true });
  }

  function toggleDay(day: string) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : DAYS.filter((d) => selectedDays.includes(d) || d === day);
    setSelectedDays(next);
    composeHours(next, fromTime, toTime);
  }

  const mut = useMutation({
    mutationFn: employersApi.upsertCorporateNeeds,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      onNext();
    },
    onError: (e) => toastApiError(e, 'Could not save your requirements.'),
  });

  return (
    <Card className="space-y-5">
      <div className="inline-flex w-fit items-center rounded-full border border-ink/10 bg-ink/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-ink-700">
        {isIndividualEmployer ? 'Individual' : 'Corporate'}
      </div>
      <p className="text-sm text-ink-600">
        {isIndividualEmployer
          ? 'Tell us about the care arrangement and the support needed. We’ll use this to build the shortlist.'
          : copy.intro}
      </p>
      <form
        onSubmit={handleSubmit((vals) => mut.mutate(vals), toastFormErrors)}
        className="grid md:grid-cols-2 gap-5"
      >
        <Field label="Staff required" error={errors.numStaffRequired?.message}>
          <Input type="number" min={1} {...register('numStaffRequired', { valueAsNumber: true })} />
        </Field>
        <Field label="Existing staff count" error={errors.existingStaffCount?.message}>
          <Input
            type="number"
            min={0}
            {...register('existingStaffCount', { valueAsNumber: true })}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Hours of operation" error={errors.hoursOfOperation?.message}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const active = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm transition',
                        active
                          ? 'border-primary bg-primary text-white'
                          : 'border-ink/12 bg-white text-ink-700 hover:bg-ink/5',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm text-ink-700">
                  <span className="font-medium">From</span>
                  <Input
                    type="time"
                    value={fromTime}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFromTime(next);
                      composeHours(selectedDays, next, toTime);
                    }}
                  />
                </label>
                <label className="space-y-1.5 text-sm text-ink-700">
                  <span className="font-medium">To</span>
                  <Input
                    type="time"
                    value={toTime}
                    onChange={(e) => {
                      const next = e.target.value;
                      setToTime(next);
                      composeHours(selectedDays, fromTime, next);
                    }}
                  />
                </label>
              </div>
            </div>
          </Field>
        </div> 
          {copy.showAgeRanges ? (
            <div className="md:col-span-2">
              <Field label={copy.ageRangesLabel}>
                <ChipsInput
                  value={v.ageRangesServed}
                  onChange={(next) => setValue('ageRangesServed', next, { shouldDirty: true })}
                  placeholder={copy.ageRangesPlaceholder}
                />
              </Field>
            </div>
          ) : null}

        <div className="md:col-span-2">
          <Field label="Specific skills needed">
            <ChipsInput
              value={v.specificSkillsNeeded}
              onChange={(next) => setValue('specificSkillsNeeded', next, { shouldDirty: true })}
              placeholder={copy.skillsPlaceholder}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Budget parameters" error={errors.budgetParameters?.message}>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1.5 text-sm text-ink-700">
                <span className="font-medium">Currency</span>
                <Select
                  icon={null}
                  value={budgetCurrency}
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBudgetCurrency(next);
                    composeBudget(next, budgetMin, budgetMax, budgetPeriod);
                  }}
                />
              </label>
              <label className="space-y-1.5 text-sm text-ink-700">
                <span className="font-medium">From</span>
                <Input
                  type="number"
                  min={0}
                  value={budgetMin}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBudgetMin(next);
                    composeBudget(budgetCurrency, next, budgetMax, budgetPeriod);
                  }}
                />
              </label>
              <label className="space-y-1.5 text-sm text-ink-700">
                <span className="font-medium">To</span>
                <Input
                  type="number"
                  min={0}
                  value={budgetMax}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBudgetMax(next);
                    composeBudget(budgetCurrency, budgetMin, next, budgetPeriod);
                  }}
                />
              </label>
              <label className="space-y-1.5 text-sm text-ink-700">
                <span className="font-medium">Per</span>
                <Select
                  icon={null}
                  value={budgetPeriod}
                  options={PERIODS.map((p) => ({ value: p, label: p }))}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBudgetPeriod(next);
                    composeBudget(budgetCurrency, budgetMin, budgetMax, next);
                  }}
                />
              </label>
            </div>
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Site assessment notes">
            <Textarea {...register('siteAssessmentNotes')} />
          </Field>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={isSubmitting || mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save & continue'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
