'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cpdRecordCreateSchema, type CpdRecordInput } from '@oakvale/shared/schema/verification';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field } from '@/app/(worker)/worker/profile/SectionFrame';
import { complianceApi } from '@/lib/compliance-api';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';

export function AddCpdForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CpdRecordInput>({ resolver: zodResolver(cpdRecordCreateSchema) });
  const mut = useMutation({
    mutationFn: complianceApi.addCpd,
    onSuccess: () => {
      toast.success('CPD record saved.');
      queryClient.invalidateQueries({ queryKey: ['complianceStatus'] });
      reset();
      onDone();
    },
    onError: (e) => toastApiError(e, 'Could not save the CPD record.'),
  });
  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)} className="grid md:grid-cols-2 gap-4 mt-5">
      <Field label="Course name" error={errors.courseName?.message}>
        <Input {...register('courseName')} />
      </Field>
      <Field label="Provider" error={errors.provider?.message}>
        <Input {...register('provider')} />
      </Field>
      <Field label="Completed on" error={errors.completedAt?.message}>
        <Input type="date" {...register('completedAt')} />
      </Field>
      <Field label="Expires (optional)" error={errors.expiresAt?.message}>
        <Input type="date" {...register('expiresAt')} />
      </Field>
      <Field label="Hours" hint="Optional" error={errors.hoursCompleted?.message}>
        <Input type="number" step="any" min={0} {...register('hoursCompleted', { valueAsNumber: true })} />
      </Field>
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || mut.isPending}>{mut.isPending ? 'Saving…' : 'Save record'}</Button>
      </div>
    </form>
  );
}
