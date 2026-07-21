'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionDSchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from '@oakvale/shared/enums/worker';
import { Field, SectionFrame, Select } from '../SectionFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DocumentUpload } from '../DocumentUpload';
import { useSectionSave } from '../use-section-save';
import { toastFormErrors } from '@/lib/toast';

type Values = SectionPayloads['D'];

export function SectionD({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('D');
  const seed = (initial as Partial<Values> | null) ?? { items: [] };
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(sectionDSchema),
    defaultValues: { items: seed.items ?? [] },
  });
  const fa = useFieldArray({ control, name: 'items' });

  function persist() {
    void handleSubmit((v) => save(v))();
  }

  return (
    <SectionFrame
      letter="D"
      title="Educational qualifications"
      description="Add every qualification you want recognised."
      status={status}
      onSave={() => void handleSubmit((v) => save(v), toastFormErrors)()}
      actions={
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() =>
            fa.append({ level: '' as never, institution: '', country: 'Nigeria' })
          }
        >
          Add entry
        </Button>
      }
    >
      <form onBlur={persist} className="space-y-4">
        {fa.fields.length === 0 ? (
          <p className="text-sm text-muted">No entries yet. Click <em>Add entry</em> to get started.</p>
        ) : null}
        {fa.fields.map((field, idx) => (
          <div key={field.id} className="rounded-xl border border-ink/8 bg-cream-50 p-5 grid md:grid-cols-2 gap-4 relative">
            <Field label="Level" required error={errors.items?.[idx]?.level?.message}>
              <Select
                {...register(`items.${idx}.level`)}
                options={EDUCATION_LEVELS.map((l) => ({ value: l, label: EDUCATION_LEVEL_LABELS[l] }))}
              />
            </Field>
            <Field label="Course / discipline" required={false}>
              <Input {...register(`items.${idx}.course`)} />
            </Field>
            <Field label="Institution" required error={errors.items?.[idx]?.institution?.message}>
              <Input {...register(`items.${idx}.institution`)} />
            </Field>
            <Field label="Country" required error={errors.items?.[idx]?.country?.message}>
              <Input {...register(`items.${idx}.country`)} />
            </Field>
            <Field label="Start date" required={false}>
              <Input type="date" {...register(`items.${idx}.startDate`)} />
            </Field>
            <Field label="End date" required={false}>
              <Input type="date" {...register(`items.${idx}.endDate`)} />
            </Field>
            <Field label="Grade / class" required={false}>
              <Input {...register(`items.${idx}.grade`)} />
            </Field>
            <div className="md:col-span-2">
              <DocumentUpload
                category="EDUCATION_CERT"
                label="Certificate (optional)"
                description="PDF, JPG, or PNG. The certificate for this qualification."
                documentId={watch(`items.${idx}.certificateDocumentId`) ?? null}
                onUploaded={(doc) => {
                  setValue(`items.${idx}.certificateDocumentId`, doc.id, { shouldDirty: true });
                  persist();
                }}
                onDeleted={() => {
                  setValue(`items.${idx}.certificateDocumentId`, null, { shouldDirty: true });
                  persist();
                }}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => { fa.remove(idx); persist(); }}
                className="text-xs text-muted hover:text-terracotta-700 underline underline-offset-4"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </form>
    </SectionFrame>
  );
}
