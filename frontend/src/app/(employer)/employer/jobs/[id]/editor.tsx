'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobPostingUpdateSchema, type JobPostingUpdateInput } from '@oakvale/shared/schema/employer';
import {
  JOB_COUNTRIES,
  JOB_COUNTRY_LABELS,
  JOB_POSTING_STATUSES,
  JOB_PRIORITY_LEVELS,
  JOB_SALARY_CURRENCIES,
  JOB_SALARY_CURRENCY_LABELS,
  JOB_SCHEDULES,
  JOB_VISIBILITY,
  locationOptionsForCountry,
  salaryBandsForCurrency,
} from '@oakvale/shared/enums/employer';
import { EmployerShell } from '@/components/dashboard/EmployerShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { ChipsInput } from '@/app/(worker)/worker/profile/sections/ChipsInput';
import { SpecialisationPicker } from '@/components/ui/SpecialisationPicker';
import { employersApi } from '@/lib/employers-api';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';
import { useEmployerConfig } from '@/lib/use-employer-config';
import { JobTabs } from './JobTabs';

export function JobEditor({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useHydratedTokens();
  const config = useEmployerConfig();

  const job = useQuery({
    queryKey: ['employerJob', id],
    queryFn: () => employersApi.getJobPosting(id),
    enabled: hydrated,
  });

  const categories = useQuery({
    queryKey: ['workforceCategories'],
    queryFn: employersApi.listWorkforceCategories,
    enabled: hydrated,
  });

  const careTypes = useQuery({
    queryKey: ['careTypes'],
    queryFn: employersApi.listCareTypes,
    enabled: hydrated,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JobPostingUpdateInput>({
    resolver: zodResolver(jobPostingUpdateSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (job.data) {
      reset({
        title: job.data.title,
        description: job.data.description,
        duties: job.data.duties ?? undefined,
        country: job.data.country,
        workLocation: job.data.workLocation ?? undefined,
        schedule: job.data.schedule ?? undefined,
        salaryCurrency: job.data.salaryCurrency,
        salaryRange: job.data.salaryRange ?? undefined,
        benefits: job.data.benefits ?? [],
        specialisations: job.data.specialisations ?? [],
        openings: job.data.openings,
        deadline: job.data.deadline ?? undefined,
        priorityLevel: job.data.priorityLevel,
        status: job.data.status,
        workforceCategoryId: job.data.workforceCategoryId ?? undefined,
        careTypeId: job.data.careTypeId ?? undefined,
        backgroundCheckRequired: job.data.backgroundCheckRequired,
        visibility: job.data.visibility,
      });
    }
  }, [job.data, reset]);

  const update = useMutation({
    mutationFn: (vals: JobPostingUpdateInput) => employersApi.updateJobPosting(id, vals),
    onSuccess: () => {
      toast.success('Posting updated.');
      queryClient.invalidateQueries({ queryKey: ['employerJobs'] });
      queryClient.invalidateQueries({ queryKey: ['employerJob', id] });
      router.push('/employer/jobs');
    },
    onError: (e) => toastApiError(e, 'Could not save the posting.'),
  });

  const v = watch();

  return (
    <EmployerShell config={config}>
      <PageHeader
        eyebrow="Corporate · job posting"
        title="Edit posting"
        actions={
          <Link href="/employer/jobs" className="text-sm text-muted hover:text-ink underline underline-offset-4">
            Back to list
          </Link>
        }
      />

      <JobTabs jobId={id} />

      {!job.data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <Card>
          <form onSubmit={handleSubmit((vals) => update.mutate(vals), toastFormErrors)} className="grid md:grid-cols-2 gap-4">
            <Field label="Title" required error={errors.title?.message}>
              <Input {...register('title')} />
            </Field>
            <Field label="Status" required={false}>
              <Select
                {...register('status')}
                options={JOB_POSTING_STATUSES.map((s) => ({ value: s, label: s.toLowerCase() }))}
              />
            </Field>
            <Field label="Workforce category" required error={errors.workforceCategoryId?.message}>
              <Select
                {...register('workforceCategoryId')}
                options={[
                  { value: '', label: 'Select a category…' },
                  ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
            <Field
              label="Type of care needed"
              required
              error={errors.careTypeId?.message}
              hint="What kind of care this role is for — caregivers use this to find relevant roles."
            >
              <Select
                {...register('careTypeId')}
                options={[
                  { value: '', label: 'Select a care type…' },
                  ...(careTypes.data ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
            <Field label="Visibility" required={false}>
              <Select
                {...register('visibility')}
                options={JOB_VISIBILITY.map((x) => ({
                  value: x,
                  label: x === 'PUBLIC' ? 'Public — searchable by all workers' : 'Restricted — notify matched workers',
                }))}
              />
            </Field>
            <Field label="Background check required" required={false}>
              <label className="flex items-center gap-2 text-sm text-ink-600">
                <input type="checkbox" {...register('backgroundCheckRequired')} />
                Require a clear background check for this role
              </label>
            </Field>
            <Field label="Priority" required={false}>
              <Select
                {...register('priorityLevel')}
                options={JOB_PRIORITY_LEVELS.map((p) => ({ value: p, label: p.toLowerCase() }))}
              />
            </Field>
            <Field label="Openings" required={false}>
              <Input type="number" min={1} {...register('openings', { valueAsNumber: true })} />
            </Field>
            <Field label="Deadline" required={false}>
              <Input type="date" min={new Date().toISOString().slice(0, 10)} {...register('deadline')} />
            </Field>
            <Field label="Country" required={false}>
              <Select
                {...register('country', {
                  onChange: () => setValue('workLocation', '', { shouldDirty: true }),
                })}
                options={JOB_COUNTRIES.map((c) => ({ value: c, label: JOB_COUNTRY_LABELS[c] }))}
              />
            </Field>
            <Field label="Work location" required={false}>
              <Select
                {...register('workLocation')}
                options={[
                  { value: '', label: 'Select a location…' },
                  ...locationOptionsForCountry(v.country ?? 'NIGERIA').map((loc) => ({ value: loc, label: loc })),
                ]}
              />
            </Field>
            <Field label="Schedule" required={false}>
              <Select
                {...register('schedule')}
                options={[
                  { value: '', label: 'Select a schedule…' },
                  ...JOB_SCHEDULES.map((s) => ({ value: s, label: s })),
                ]}
              />
            </Field>
            <Field label="Salary currency" required={false}>
              <Select
                {...register('salaryCurrency', {
                  onChange: () => setValue('salaryRange', '', { shouldDirty: true }),
                })}
                options={JOB_SALARY_CURRENCIES.map((c) => ({ value: c, label: JOB_SALARY_CURRENCY_LABELS[c] }))}
              />
            </Field>
            <Field label="Salary range" required={false}>
              <Select
                {...register('salaryRange')}
                options={[
                  { value: '', label: 'Select a range…' },
                  ...salaryBandsForCurrency(v.salaryCurrency ?? 'NGN').map((b) => ({ value: b, label: b })),
                ]}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description" required error={errors.description?.message}>
                <Textarea {...register('description')} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Duties" required={false}>
                <Textarea {...register('duties')} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Benefits" required={false}>
                <ChipsInput
                  value={v.benefits ?? []}
                  onChange={(next) => setValue('benefits', next, { shouldDirty: true })}
                  placeholder="e.g. HMO, Stipend, Training"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field
                label="Care specialisations"
                required={false}
                hint="Tick the care tasks this role involves — caregivers see these when applying."
              >
                <SpecialisationPicker
                  value={v.specialisations ?? []}
                  onChange={(next) => setValue('specialisations', next, { shouldDirty: true })}
                />
              </Field>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={isSubmitting || update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </EmployerShell>
  );
}
