'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionKSchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import { WAGE_STRUCTURES } from '@oakvale/shared/enums/worker';
import { Field, SectionFrame, Select } from '../SectionFrame';
import { Input } from '@/components/ui/Input';
import { useSectionSave } from '../use-section-save';
import { ChipsInput } from './ChipsInput';
import { toastFormErrors } from '@/lib/toast';

type Values = SectionPayloads['K'];

export function SectionK({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('K');
  const seed = (initial as Partial<Values> | null) ?? {};
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(sectionKSchema),
    defaultValues: {
      wageStructure: seed.wageStructure ?? 'MONTHLY',
      minRate: seed.minRate ?? 0,
      maxRate: seed.maxRate ?? 0,
      currency: seed.currency ?? 'NGN',
      negotiable: seed.negotiable ?? true,
      expectedBenefits: seed.expectedBenefits ?? [],
    },
  });
  const v = watch();

  function persist() { void handleSubmit((vals) => save(vals))(); }

  return (
    <SectionFrame
      letter="K"
      title="Salary expectations"
      description="A range we can negotiate within."
      status={status}
      onSave={() => void handleSubmit((vals) => save(vals), toastFormErrors)()}
    >
      <form onBlur={persist} className="grid md:grid-cols-2 gap-5">
        <Field label="Wage structure" required>
          <Select
            {...register('wageStructure')}
            options={WAGE_STRUCTURES.map((w) => ({ value: w, label: w.toLowerCase() }))}
          />
        </Field>
        <Field label="Currency" required>
          <Select
            {...register('currency')}
            options={[
              { value: 'NGN', label: 'NGN' },
              { value: 'GBP', label: 'GBP' },
              { value: 'USD', label: 'USD' },
            ]}
          />
        </Field>
        <Field label="Minimum rate" required error={errors.minRate?.message}>
          <Input type="number" min={0} step="any" {...register('minRate', { valueAsNumber: true })} />
        </Field>
        <Field label="Maximum rate" required error={errors.maxRate?.message}>
          <Input type="number" min={0} step="any" {...register('maxRate', { valueAsNumber: true })} />
        </Field>
        <label className="md:col-span-2 inline-flex items-center gap-3 text-sm text-ink-600">
          <input type="checkbox" {...register('negotiable')} className="h-4 w-4 accent-terracotta-500" />
          Open to negotiation.
        </label>
        <div className="md:col-span-2">
          <Field label="Expected benefits" required={false}>
            <ChipsInput
              value={v.expectedBenefits}
              onChange={(next) => { setValue('expectedBenefits', next, { shouldDirty: true }); persist(); }}
              placeholder="e.g. Accommodation, Stipend, Travel allowance"
            />
          </Field>
        </div>
      </form>
    </SectionFrame>
  );
}
