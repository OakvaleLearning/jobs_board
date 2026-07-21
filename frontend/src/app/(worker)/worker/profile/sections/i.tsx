'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionISchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import { Field, SectionFrame, Textarea } from '../SectionFrame';
import { useSectionSave } from '../use-section-save';
import { toastFormErrors } from '@/lib/toast';

type Values = SectionPayloads['I'];

export function SectionI({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('I');
  const seed = (initial as Partial<Values> | null) ?? {};
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(sectionISchema),
    defaultValues: { interests: seed.interests ?? '', personalStatement: seed.personalStatement ?? '' },
  });

  function persist() { void handleSubmit((v) => save(v))(); }
  const stmt = watch('personalStatement') ?? '';

  return (
    <SectionFrame
      letter="I"
      title="Interests & personal statement"
      description="Help employers see the person behind the credentials."
      status={status}
      onSave={() => void handleSubmit((v) => save(v), toastFormErrors)()}
    >
      <form onBlur={persist} className="space-y-5">
        <Field label="Interests" required={false} hint="Hobbies, languages spoken at home, faith communities, etc.">
          <Textarea {...register('interests')} />
        </Field>
        <Field
          label="Personal statement"
          required
          hint={`At least 40 characters. ${stmt.length} typed.`}
          error={errors.personalStatement?.message}
        >
          <Textarea {...register('personalStatement')} className="min-h-[160px]" />
        </Field>
      </form>
    </SectionFrame>
  );
}
