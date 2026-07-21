'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionFSchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import { REFERENCE_TYPES } from '@oakvale/shared/enums/worker';
import { Field, SectionFrame, Select } from '../SectionFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DocumentUpload } from '../DocumentUpload';
import { useSectionSave } from '../use-section-save';
import { toastFormErrors } from '@/lib/toast';

type Values = SectionPayloads['F'];

const REFERENCE_TYPE_LABELS: Record<(typeof REFERENCE_TYPES)[number], string> = {
  PROFESSIONAL: 'Professional',
  CHARACTER: 'Character',
  ACADEMIC: 'Academic',
};

export function SectionF({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('F');
  const seed = (initial as Partial<Values> | null) ?? { items: [] };
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(sectionFSchema),
    defaultValues: { items: seed.items ?? [] },
  });
  const fa = useFieldArray({ control, name: 'items' });

  function persist() {
    void handleSubmit((v) => save(v))();
  }

  return (
    <SectionFrame
      letter="F"
      title="References"
      description="People who can vouch for your work. Add at least one."
      status={status}
      onSave={() => void handleSubmit((v) => save(v), toastFormErrors)()}
      actions={
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() =>
            fa.append({
              name: '',
              organisation: '',
              phone: '',
              email: '',
              referenceType: 'PROFESSIONAL',
            })
          }
        >
          Add reference
        </Button>
      }
    >
      <form onBlur={persist} className="space-y-4">
        {fa.fields.length === 0 ? (
          <p className="text-sm text-muted">No references yet. Click <em>Add reference</em> to get started.</p>
        ) : null}
        {fa.fields.map((field, idx) => (
          <div key={field.id} className="rounded-xl border border-ink/8 bg-cream-50 p-5 grid md:grid-cols-2 gap-4">
            <Field label="Full name" required error={errors.items?.[idx]?.name?.message}>
              <Input {...register(`items.${idx}.name`)} />
            </Field>
            <Field label="Organisation" required error={errors.items?.[idx]?.organisation?.message}>
              <Input {...register(`items.${idx}.organisation`)} />
            </Field>
            <Field label="Position" required={false}>
              <Input {...register(`items.${idx}.position`)} />
            </Field>
            <Field label="Reference type" required error={errors.items?.[idx]?.referenceType?.message}>
              <Select
                {...register(`items.${idx}.referenceType`)}
                options={REFERENCE_TYPES.map((t) => ({ value: t, label: REFERENCE_TYPE_LABELS[t] }))}
              />
            </Field>
            <Field label="Phone" required error={errors.items?.[idx]?.phone?.message}>
              <Input {...register(`items.${idx}.phone`)} />
            </Field>
            <Field label="Email" required error={errors.items?.[idx]?.email?.message}>
              <Input type="email" {...register(`items.${idx}.email`)} />
            </Field>
            <div className="md:col-span-2">
              <DocumentUpload
                category="REFERENCE_LETTER"
                label="Reference letter (optional)"
                description="PDF, JPG, or PNG. A signed letter from this referee."
                documentId={watch(`items.${idx}.letterDocumentId`) ?? null}
                onUploaded={(doc) => {
                  setValue(`items.${idx}.letterDocumentId`, doc.id, { shouldDirty: true });
                  persist();
                }}
                onDeleted={() => {
                  setValue(`items.${idx}.letterDocumentId`, null, { shouldDirty: true });
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
