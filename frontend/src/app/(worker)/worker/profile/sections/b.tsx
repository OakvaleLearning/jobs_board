'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sectionBSchema, type SectionPayloads } from '@oakvale/shared/schema/worker';
import { ID_TYPES } from '@oakvale/shared/enums/worker';
import { Field, SectionFrame, Select } from '../SectionFrame';
import { Input } from '@/components/ui/Input';
import { DocumentUpload } from '../DocumentUpload';
import { useSectionSave } from '../use-section-save';
import { toastFormErrors } from '@/lib/toast';

type Values = SectionPayloads['B'];

export function SectionB({ initial }: { initial: unknown }) {
  const { save, status } = useSectionSave('B');
  const seed = (initial ?? {}) as Partial<Values>;
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(sectionBSchema),
    defaultValues: {
      idType: seed.idType ?? 'NIN',
      idNumber: seed.idNumber ?? '',
      idIssueDate: seed.idIssueDate,
      idExpiryDate: seed.idExpiryDate,
      idDocumentId: seed.idDocumentId,
      selfieId: seed.selfieId,
      proofOfAddressId: seed.proofOfAddressId,
    },
  });

  function onBlur() {
    void handleSubmit((v) => save(v))();
  }

  const values = watch();
  useEffect(() => {
    save(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.idDocumentId, values.selfieId, values.proofOfAddressId]);

  return (
    <SectionFrame
      letter="B"
      title="Identity verification"
      description="A valid ID, a selfie, and proof of address."
      status={status}
      onSave={() => void handleSubmit((v) => save(v), toastFormErrors)()}
    >
      <form onBlur={onBlur} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-5">
          <Field label="ID type" required error={errors.idType?.message}>
            <Select {...register('idType')} options={ID_TYPES.map((v) => ({ value: v, label: v.replace('_', ' ') }))} />
          </Field>
          <Field label="ID number" required error={errors.idNumber?.message}>
            <Input {...register('idNumber')} />
          </Field>
          <Field label="Issue date" required={false} error={errors.idIssueDate?.message}>
            <Input type="date" {...register('idIssueDate')} />
          </Field>
          <Field label="Expiry date" required={false} error={errors.idExpiryDate?.message}>
            <Input type="date" {...register('idExpiryDate')} />
          </Field>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <DocumentUpload
            category="ID_DOCUMENT"
            label="ID document"
            description="PDF, JPG, or PNG. Both sides if applicable."
            onUploaded={(d) => setValue('idDocumentId', d.id, { shouldDirty: true })}
            onDeleted={() => setValue('idDocumentId', null, { shouldDirty: true })}
          />
          <DocumentUpload
            category="SELFIE"
            label="Selfie (liveness)"
            description="A clear photo of your face, no filters."
            onUploaded={(d) => setValue('selfieId', d.id, { shouldDirty: true })}
            onDeleted={() => setValue('selfieId', null, { shouldDirty: true })}
          />
          <DocumentUpload
            category="PROOF_OF_ADDRESS"
            label="Proof of address"
            description="Utility bill or bank statement, last 3 months."
            onUploaded={(d) => setValue('proofOfAddressId', d.id, { shouldDirty: true })}
            onDeleted={() => setValue('proofOfAddressId', null, { shouldDirty: true })}
          />
        </div>
      </form>
    </SectionFrame>
  );
}
