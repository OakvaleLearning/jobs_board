'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionASchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import { GENDERS, NIGERIAN_STATES } from '@oakvale/shared/enums/worker';
import { Field, SectionFrame, Select } from '../SectionFrame';
import { Input } from '@/components/ui/Input';
import { useSectionSave } from '../use-section-save';
import { useAuth } from '@/lib/auth-store';
import { toastFormErrors } from '@/lib/toast';

type Values = SectionPayloads['A'];

export function SectionA({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('A');
  const accountName = useAuth((s) => s.user?.fullName);
  const seed = (initial ?? {}) as Partial<Values & { fullName?: string }>;
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(sectionASchema),
    defaultValues: {
      // Prefill from the section data, falling back to the registered account name.
      fullName: seed.fullName ?? accountName ?? '',
      dob: seed.dob ?? '',
      gender: seed.gender ?? ('' as never),
      nationality: seed.nationality ?? 'Nigerian',
      stateOfOrigin: seed.stateOfOrigin ?? '',
      lga: seed.lga ?? '',
      address: seed.address ?? '',
      phone: seed.phone ?? '',
      emergencyContact: seed.emergencyContact ?? { name: '', relationship: '', phone: '' },
    },
  });

  function onBlur() {
    void handleSubmit((v) => save(v))();
  }

  return (
    <SectionFrame
      letter="A"
      title="Personal information"
      description="Who you are and how to reach you."
      status={status}
      onSave={() => void handleSubmit((v) => save(v), toastFormErrors)()}
    >
      <form onBlur={onBlur} className="grid md:grid-cols-2 gap-5">
        <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
          <Input id="fullName" {...register('fullName')} />
        </Field>
        <Field label="Date of birth" htmlFor="dob" required error={errors.dob?.message}>
          <Input id="dob" type="date" {...register('dob')} />
        </Field>
        <Field label="Gender" required error={errors.gender?.message}>
          <Select
            {...register('gender')}
            options={GENDERS.map((g) => ({ value: g, label: g.replace('_', ' ').toLowerCase() }))}
          />
        </Field>
        <Field label="Nationality" htmlFor="nationality" required error={errors.nationality?.message}>
          <Input id="nationality" {...register('nationality')} />
        </Field>
        <Field label="State of origin" required error={errors.stateOfOrigin?.message}>
          <Select
            {...register('stateOfOrigin')}
            options={NIGERIAN_STATES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="LGA" htmlFor="lga" required error={errors.lga?.message}>
          <Input id="lga" {...register('lga')} />
        </Field>
        <Field label="Residential address" htmlFor="address" required error={errors.address?.message}>
          <Input id="address" {...register('address')} className="md:col-span-2" />
        </Field>
        <Field label="Phone" htmlFor="phone" required error={errors.phone?.message}>
          <Input id="phone" type="tel" {...register('phone')} />
        </Field>

        <div className="md:col-span-2 mt-4 rounded-xl bg-cream-200/40 p-5 grid md:grid-cols-3 gap-4">
          <p className="md:col-span-3 text-eyebrow text-muted">Emergency contact</p>
          <Field label="Name" required error={errors.emergencyContact?.name?.message}>
            <Input {...register('emergencyContact.name')} />
          </Field>
          <Field label="Relationship" required error={errors.emergencyContact?.relationship?.message}>
            <Input {...register('emergencyContact.relationship')} />
          </Field>
          <Field label="Phone" required error={errors.emergencyContact?.phone?.message}>
            <Input type="tel" {...register('emergencyContact.phone')} />
          </Field>
        </div>
      </form>
    </SectionFrame>
  );
}
