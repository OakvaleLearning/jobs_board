'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { sectionGSchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import {
  EMPLOYMENT_TYPES,
  PREFERRED_SETTINGS,
  PREFERRED_SETTING_LABELS,
  SECTORS,
  SECTOR_LABELS,
} from '@oakvale/shared/enums/worker';
import { Field, SectionFrame, Select } from '../SectionFrame';
import { Input } from '@/components/ui/Input';
import { useSectionSave } from '../use-section-save';
import { ChipsInput } from './ChipsInput';
import { SelectChips } from './SelectChips';
import { workforceCategoriesApi } from '@/lib/workforce-categories-api';
import { toastFormErrors } from '@/lib/toast';

type Values = SectionPayloads['G'];

export function SectionG({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('G');
  const seed = (initial as Partial<Values> | null) ?? {};
  const { register, setValue, watch, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(sectionGSchema),
    defaultValues: {
      workforceCategoryId: seed.workforceCategoryId ?? undefined,
      desiredSectors: seed.desiredSectors ?? [],
      employmentType: seed.employmentType ?? 'LIVE_IN',
      preferredSettings: seed.preferredSettings ?? [],
      availabilityStart: seed.availabilityStart,
      shiftPreferences: seed.shiftPreferences ?? [],
      relocationWillingness: seed.relocationWillingness ?? false,
      preferredCities: seed.preferredCities ?? [],
    },
  });

  function persist() { void handleSubmit((v) => save(v))(); }
  const v = watch();

  // Admin-configured categories drive the desired-sector options; fall back to
  // the legacy SECTORS enum if none are configured/active yet.
  const categories = useQuery({
    queryKey: ['workforceCategories', 'active'],
    queryFn: () => workforceCategoriesApi.list(),
  });
  const sectorOptions =
    categories.data && categories.data.length > 0
      ? categories.data.map((c) => ({ value: c.slug, label: c.name }))
      : SECTORS.map((s) => ({ value: s, label: SECTOR_LABELS[s] }));

  return (
    <SectionFrame
      letter="G"
      title="Preferences & availability"
      description="When and where you want to work."
      status={status}
      onSave={() => void handleSubmit((v) => save(v), toastFormErrors)()}
    >
      <form onBlur={persist} className="grid md:grid-cols-2 gap-5">
        <Field
          label="Workforce category"
          className="md:col-span-2"
          required={false}
          hint="Your primary Oakvale role. It drives your skills menu and what employers can filter you by."
        >
          <Select
            {...register('workforceCategoryId')}
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="Employment type" required error={errors.employmentType?.message}>
          <Select
            {...register('employmentType')}
            options={EMPLOYMENT_TYPES.map((e) => ({ value: e, label: e.replace('_', ' ').toLowerCase() }))}
          />
        </Field>
        <Field label="Available from" required={false}>
          <Input type="date" {...register('availabilityStart')} />
        </Field>
        <Field label="Desired sectors" required={false}>
          <SelectChips
            value={v.desiredSectors}
            onChange={(next) => { setValue('desiredSectors', next as Values['desiredSectors'], { shouldDirty: true }); persist(); }}
            options={sectorOptions}
          />
        </Field>
        <Field label="Preferred settings" required={false}>
          <SelectChips
            value={v.preferredSettings}
            onChange={(next) => { setValue('preferredSettings', next as Values['preferredSettings'], { shouldDirty: true }); persist(); }}
            options={PREFERRED_SETTINGS.map((s) => ({ value: s, label: PREFERRED_SETTING_LABELS[s] }))}
          />
        </Field>
        <Field label="Shift preferences" required={false}>
          <ChipsInput
            value={v.shiftPreferences}
            onChange={(next) => { setValue('shiftPreferences', next, { shouldDirty: true }); persist(); }}
            placeholder="e.g. Days, Nights"
          />
        </Field>
        <Field label="Preferred cities" required={false}>
          <ChipsInput
            value={v.preferredCities}
            onChange={(next) => { setValue('preferredCities', next, { shouldDirty: true }); persist(); }}
            placeholder="e.g. Lagos, Abuja"
          />
        </Field>
        <label className="md:col-span-2 inline-flex items-center gap-3 text-sm text-ink-600">
          <input type="checkbox" {...register('relocationWillingness')} className="h-4 w-4 accent-terracotta-500" />
          I&rsquo;m willing to relocate.
        </label>
      </form>
    </SectionFrame>
  );
}
