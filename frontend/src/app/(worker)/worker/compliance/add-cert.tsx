'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { certificationCreateSchema, type CertificationInput } from '@oakvale/shared/schema/verification';
import { CERT_TYPES } from '@oakvale/shared/enums/verification';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/app/(worker)/worker/profile/SectionFrame';
import { DocumentUpload } from '@/app/(worker)/worker/profile/DocumentUpload';
import { complianceApi } from '@/lib/compliance-api';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';

export function AddCertForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CertificationInput>({
    resolver: zodResolver(certificationCreateSchema),
    defaultValues: { certType: 'OAKVALE_FOUNDATION' },
  });
  const mut = useMutation({
    mutationFn: complianceApi.addCertification,
    onSuccess: () => {
      toast.success('Certification saved.');
      queryClient.invalidateQueries({ queryKey: ['complianceStatus'] });
      reset();
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not save the certification.'),
  });
  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)} className="grid md:grid-cols-2 gap-4 mt-5">
      <Field label="Type" error={errors.certType?.message}>
        <Select
          {...register('certType')}
          options={CERT_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ').toLowerCase() }))}
        />
      </Field>
      <Field label="Issued by" error={errors.issuedBy?.message}>
        <Input {...register('issuedBy')} />
      </Field>
      <Field label="Certificate number (optional)" error={errors.certNumber?.message}>
        <Input {...register('certNumber')} placeholder="Leave blank if none" />
      </Field>
      <Field label="Issued on" error={errors.issuedAt?.message}>
        <Input type="date" {...register('issuedAt')} />
      </Field>
      <Field label="Expires (optional)" error={errors.expiresAt?.message}>
        <Input type="date" {...register('expiresAt')} />
      </Field>
      <div className="md:col-span-2">
        <DocumentUpload
          category="CPD_CERT"
          label="Certificate document"
          description="PDF, JPG, or PNG. Upload the certificate — this is what we verify."
          documentId={watch('certificateDocumentId') ?? null}
          onUploaded={(doc) => setValue('certificateDocumentId', doc.id, { shouldDirty: true })}
          onDeleted={() => setValue('certificateDocumentId', '', { shouldDirty: true })}
        />
        {errors.certificateDocumentId?.message ? (
          <p className="mt-1.5 text-xs text-terracotta-700">{errors.certificateDocumentId.message}</p>
        ) : null}
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || mut.isPending}>
          {mut.isPending ? 'Saving…' : 'Save certification'}
        </Button>
      </div>
    </form>
  );
}
