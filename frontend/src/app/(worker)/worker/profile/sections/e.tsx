'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionESchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import { NATURE_OF_ROLES, NATURE_OF_ROLE_LABELS } from '@oakvale/shared/enums/worker';
import { Field, SectionFrame, Select, Textarea } from '../SectionFrame';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DocumentUpload } from '../DocumentUpload';
import { useSectionSave } from '../use-section-save';
import { ChipsInput } from './ChipsInput';
import { toastFormErrors } from '@/lib/toast';

type Values = SectionPayloads['E'];

export function SectionE({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('E');
  const seed = (initial as Partial<Values> | null) ?? { items: [] };
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(sectionESchema),
    defaultValues: { items: seed.items ?? [] },
  });
  const fa = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  function persist() {
    void handleSubmit((v) => save(v))();
  }

  return (
    <SectionFrame
      letter="E"
      title="Professional experience"
      description="Each role you want employers to weigh."
      status={status}
      onSave={() => void handleSubmit((v) => save(v), toastFormErrors)()}
      actions={
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() =>
            fa.append({
              jobTitle: '',
              employerName: '',
              startDate: '',
              isCurrent: false,
              skillsApplied: [],
            })
          }
        >
          Add role
        </Button>
      }
    >
      <form onBlur={persist} className="space-y-4">
        {fa.fields.length === 0 ? (
          <p className="text-sm text-muted">Add at least one role. Experience is double-weighted.</p>
        ) : null}
        {fa.fields.map((field, idx) => (
          <div key={field.id} className="rounded-xl border border-ink/8 bg-cream-50 p-5 grid md:grid-cols-2 gap-4">
            <Field label="Job title" required error={errors.items?.[idx]?.jobTitle?.message}>
              <Input {...register(`items.${idx}.jobTitle`)} />
            </Field>
            <Field label="Employer" required error={errors.items?.[idx]?.employerName?.message}>
              <Input {...register(`items.${idx}.employerName`)} />
            </Field>
            <Field label="Sector" required={false}><Input {...register(`items.${idx}.sector`)} /></Field>
            <Field label="Nature of role" required={false} error={errors.items?.[idx]?.natureOfRole?.message}>
              <Select
                {...register(`items.${idx}.natureOfRole`)}
                options={NATURE_OF_ROLES.map((n) => ({ value: n, label: NATURE_OF_ROLE_LABELS[n] }))}
              />
            </Field>
            <Field label="Start date" required error={errors.items?.[idx]?.startDate?.message}>
              <Input type="date" {...register(`items.${idx}.startDate`)} />
            </Field>
            <Field label="End date" required={false}>
              <Input type="date" {...register(`items.${idx}.endDate`)} disabled={items[idx]?.isCurrent} />
            </Field>
            <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-ink-600">
              <input type="checkbox" {...register(`items.${idx}.isCurrent`)} className="h-4 w-4 accent-terracotta-500" />
              I currently work here
            </label>
            <div className="md:col-span-2">
              <Field label="Duties" required={false}>
                <Textarea {...register(`items.${idx}.duties`)} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Skills applied" required={false}>
                <ChipsInput
                  value={items[idx]?.skillsApplied ?? []}
                  onChange={(next) => { setValue(`items.${idx}.skillsApplied`, next, { shouldDirty: true }); persist(); }}
                  placeholder="Enter a skill and press Enter"
                />
              </Field>
            </div>
            <Field label="Reason for leaving" required={false}><Input {...register(`items.${idx}.reasonForLeaving`)} /></Field>
            <div className="md:col-span-2">
              <DocumentUpload
                category="EXPERIENCE_LETTER"
                label="Reference / experience letter (optional)"
                description="PDF, JPG, or PNG. A letter confirming this role."
                documentId={items[idx]?.letterDocumentId ?? null}
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
