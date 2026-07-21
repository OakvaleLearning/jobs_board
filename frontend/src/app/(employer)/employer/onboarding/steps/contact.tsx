'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactCreateSchema, type ContactCreateInput } from '@oakvale/shared/schema/employer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field } from '@/app/(worker)/worker/profile/SectionFrame';
import { toastApiError, toastFormErrors } from '@/lib/toast';
import { employersApi, type EmployerProfile } from '@/lib/employers-api';

export function ContactStep({ profile, onNext }: { profile: EmployerProfile; onNext: () => void }) {
  const queryClient = useQueryClient();
  const existing = profile.contacts.find((c) => c.isPrimary) ?? profile.contacts[0];
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ContactCreateInput>({
    resolver: zodResolver(contactCreateSchema),
    defaultValues: {
      name: existing?.name ?? '',
      position: existing?.position ?? '',
      email: existing?.email ?? '',
      phone: existing?.phone ?? '',
      isPrimary: true,
    },
  });
  const mut = useMutation({
    mutationFn: employersApi.addContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      onNext();
    },
    onError: (e) => toastApiError(e, 'Could not save the contact.'),
  });

  return (
    <Card className="space-y-5">
      <p className="text-sm text-ink-600">
        Who do we contact about placements, welfare check-ins, and invoices?
      </p>
      <form onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)} className="grid md:grid-cols-2 gap-5">
        <Field label="Full name" error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label="Position">
          <Input {...register('position')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={isSubmitting || mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save & continue'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
