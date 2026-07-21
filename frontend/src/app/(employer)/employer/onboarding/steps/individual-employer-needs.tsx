'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  individualEmployerNeedsAssessmentSchema,
  type IndividualEmployerNeedsAssessmentInput,
} from '@oakvale/shared/schema/employer';
import {
  ACCOMMODATION_TYPES,
  MOBILITY_LEVELS,
  URGENCY_LEVELS,
} from '@oakvale/shared/enums/employer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toastApiError, toastFormErrors } from '@/lib/toast';
import { employersApi, type EmployerProfile } from '@/lib/employers-api';

export function IndividualEmployerNeedsStep({
  profile,
  onNext,
}: {
  profile: EmployerProfile;
  onNext: () => void;
}) {
  const queryClient = useQueryClient();
  const isCorporate =
    profile.employerTypeConfig?.usesCorporateNeeds ?? profile.employerType === 'CORPORATE';
  const seed = (profile.individualEmployerNeedsAssessment ??
    {}) as Partial<IndividualEmployerNeedsAssessmentInput>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IndividualEmployerNeedsAssessmentInput>({
    resolver: zodResolver(individualEmployerNeedsAssessmentSchema),
    defaultValues: {
      careRecipientName: seed.careRecipientName ?? '',
      age: seed.age ?? 0,
      relationship: seed.relationship ?? '',
      conditions: seed.conditions ?? '',
      mobilityLevel: seed.mobilityLevel ?? 'INDEPENDENT',
      medicationNeeds: seed.medicationNeeds ?? '',
      preferredLanguage: seed.preferredLanguage ?? 'English',
      culturalRequirements: seed.culturalRequirements ?? '',
      dietaryRequirements: seed.dietaryRequirements ?? '',
      accommodationType: seed.accommodationType ?? 'LIVE_IN',
      urgencyLevel: seed.urgencyLevel ?? 'STANDARD',
      additionalNotes: seed.additionalNotes ?? '',
    },
  });
  const mut = useMutation({
    mutationFn: employersApi.upsertIndividualEmployerNeeds,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employerProfile'] });
      onNext();
    },
    onError: (e) => toastApiError(e, 'Could not save the assessment.'),
  });

  return (
    <Card className="space-y-5">
      <div className="inline-flex w-fit items-center rounded-full border border-ink/10 bg-ink/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-ink-700">
        {isCorporate ? 'Corporate' : 'Individual'}
      </div>
      <p className="text-sm text-ink-600">
        Tell us about the person who needs care. Our agents use this to build the shortlist.
      </p>
      <form
        onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)}
        className="grid md:grid-cols-2 gap-5"
      >
        <Field label="Recipient name" error={errors.careRecipientName?.message}>
          <Input {...register('careRecipientName')} />
        </Field>
        <Field label="Age" error={errors.age?.message}>
          <Input type="number" min={0} {...register('age', { valueAsNumber: true })} />
        </Field>
        <Field label="Relationship to you" error={errors.relationship?.message}>
          <Input {...register('relationship')} />
        </Field>
        <Field label="Preferred language" error={errors.preferredLanguage?.message}>
          <Input {...register('preferredLanguage')} />
        </Field>
        <Field label="Mobility level">
          <Select
            {...register('mobilityLevel')}
            options={MOBILITY_LEVELS.map((m) => ({ value: m, label: m.toLowerCase() }))}
          />
        </Field>
        <Field label="Accommodation">
          <Select
            {...register('accommodationType')}
            options={ACCOMMODATION_TYPES.map((m) => ({
              value: m,
              label: m.replace('_', ' ').toLowerCase(),
            }))}
          />
        </Field>
        <Field label="Urgency">
          <Select
            {...register('urgencyLevel')}
            options={URGENCY_LEVELS.map((u) => ({ value: u, label: u.toLowerCase() }))}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Conditions / diagnoses">
            <Textarea {...register('conditions')} />
          </Field>
        </div>
        <div>
          <Field label="Medication needs">
            <Textarea {...register('medicationNeeds')} />
          </Field>
        </div>
        <div>
          <Field label="Cultural requirements">
            <Textarea {...register('culturalRequirements')} />
          </Field>
        </div>
        <div>
          <Field label="Dietary requirements">
            <Textarea {...register('dietaryRequirements')} />
          </Field>
        </div>
        <div>
          <Field label="Anything else">
            <Textarea {...register('additionalNotes')} />
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
