'use client';

import { forwardRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionLSchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import { SectionFrame } from '../SectionFrame';
import { useSectionSave } from '../use-section-save';

type Values = SectionPayloads['L'];

export function SectionL({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('L');
  const seed = (initial as Partial<Values> | null) ?? {};
  const { register, handleSubmit } = useForm<Values>({
    resolver: zodResolver(sectionLSchema),
    defaultValues: {
      cpdEnrolled: seed.cpdEnrolled ?? false,
      oakvaleProgrammeAcknowledged: seed.oakvaleProgrammeAcknowledged ?? false,
      immunisationDeclared: seed.immunisationDeclared ?? false,
    },
  });

  function persist() { void handleSubmit((v) => save(v))(); }

  return (
    <SectionFrame
      letter="L"
      title="Compliance & training"
      description="CPD enrolment, Oakvale programme, immunisation."
      status={status}
      onSave={persist}
    >
      <form onChange={persist} className="space-y-3 max-w-2xl">
        <Item label="I’m enrolled in (or willing to enrol in) a CPD-accredited childcare/care programme." {...register('cpdEnrolled')} />
        <Item label="I acknowledge that the Oakvale CPD programme is required to remain visible to employers." {...register('oakvaleProgrammeAcknowledged')} />
        <Item label="I’ve declared my immunisation status. (Optional but helpful for crèche placements.)" {...register('immunisationDeclared')} />
      </form>
    </SectionFrame>
  );
}

const Item = forwardRef<HTMLInputElement, { label: string } & React.InputHTMLAttributes<HTMLInputElement>>(
  function Item({ label, ...inputProps }, ref) {
    return (
      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-ink/8 bg-cream-50 p-4 hover:border-ink/30 transition">
        <input ref={ref} type="checkbox" {...inputProps} className="mt-0.5 h-4 w-4 accent-terracotta-500" />
        <span className="text-sm text-ink-600">{label}</span>
      </label>
    );
  },
);
