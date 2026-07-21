'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  employerProfileUpdateSchema,
  type EmployerProfileUpdate,
} from '@oakvale/shared/schema/employer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { SECTORS, SECTOR_LABELS } from '@oakvale/shared/enums/worker';
import { toastApiError, toastFormErrors } from '@/lib/toast';
import { employersApi, type EmployerProfile } from '@/lib/employers-api';

export function OrgStep({ profile, onNext }: { profile: EmployerProfile; onNext: () => void }) {
  const queryClient = useQueryClient();
  const isIndividualEmployer =
    profile.employerTypeConfig?.usesIndividualEmployerNeeds ??
    profile.employerType === 'INDIVIDUAL_EMPLOYER';

  // Sector dropdown options (corporate). Limited to the two launch focus areas
  // for now (elderly/home care + crèche/early years). Store the human label
  // since it's a free-text field shown raw elsewhere (e.g. admin review).
  // Preserve any legacy free-text value that isn't one of the known labels.
  const FOCUS_SECTORS = [
    'ELDERLY_CARE',
    'CRECHE_EARLY_YEARS',
  ] as const satisfies readonly (typeof SECTORS)[number][];
  const sectorLabels = FOCUS_SECTORS.map((s) => SECTOR_LABELS[s]);
  const legacySector =
    profile.sector && !sectorLabels.includes(profile.sector) ? profile.sector : null;
  const sectorOptions = [
    { value: '', label: 'Select a sector…' },
    ...(legacySector ? [{ value: legacySector, label: legacySector }] : []),
    ...sectorLabels.map((label) => ({ value: label, label })),
  ];
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmployerProfileUpdate>({
    resolver: zodResolver(employerProfileUpdateSchema),
    defaultValues: {
      orgName: profile.orgName ?? '',
      sector: profile.sector ?? (isIndividualEmployer ? 'Family' : ''),
      // (corporate sector default falls back to '' so the placeholder shows)
      regNumber: profile.regNumber ?? '',
      address: profile.address ?? '',
      website: profile.website ?? '',
      about: profile.about ?? '',
    },
  });
  const mut = useMutation({
    mutationFn: employersApi.updateMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      onNext();
    },
    onError: (e) => toastApiError(e, 'Could not save your details.'),
  });

  return (
    <Card className="space-y-5">
      <p className="text-sm text-ink-600">
        {isIndividualEmployer
          ? 'A name we can use when we write to you about the care arrangement.'
          : 'How you’ll appear to verified workers and on placement records.'}
      </p>
      <form
        onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)}
        className="grid md:grid-cols-2 gap-5"
      >
        <Field
          label={isIndividualEmployer ? 'Family / household name' : 'Organisation name'}
          required
          error={errors.orgName?.message}
        >
          <Input {...register('orgName')} />
        </Field>
        {isIndividualEmployer ? (
          <Field label="Relationship (e.g. son)" required={false} error={errors.sector?.message}>
            <Input {...register('sector')} />
          </Field>
        ) : (
          <Field label="Sector" required={false} error={errors.sector?.message}>
            <Select {...register('sector')} options={sectorOptions} />
          </Field>
        )}
        {!isIndividualEmployer ? (
          <Field label="Registration number" required={false} error={errors.regNumber?.message}>
            <Input {...register('regNumber')} />
          </Field>
        ) : null}
        <Field label="Address" required={false} error={errors.address?.message}>
          <Input {...register('address')} />
        </Field>
        {!isIndividualEmployer ? (
          <Field label="Website" required={false} error={errors.website?.message}>
            <Input type="url" {...register('website')} placeholder="https://" />
          </Field>
        ) : null}
        <div className="md:col-span-2">
          <Field label="About" required={false} error={errors.about?.message}>
            <Textarea {...register('about')} />
          </Field>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={isSubmitting || mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save & continue'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
