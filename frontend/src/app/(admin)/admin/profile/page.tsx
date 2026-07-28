'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  updateAgentSelfSchema,
  type UpdateAgentSelfInput,
} from '@oakvale/shared/schema/admin';
import { AGENT_SPECIALTY_OPTIONS, AGENT_SPECIALTY_LABELS } from '@oakvale/shared/enums/admin';
import { AdminShell } from '@/components/dashboard/AdminShell';
import { PageHeader } from '@/components/dashboard/Shell';
import { AccountSettings } from '@/components/account/AccountSettings';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import { adminApi, type StaffSelf } from '@/lib/admin-api';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

export default function AdminProfilePage() {
  const hydrated = useHydratedTokens();
  const me = useQuery({ queryKey: ['adminSelf'], queryFn: adminApi.me, enabled: hydrated });

  return (
    <AdminShell>
      <PageHeader
        eyebrow="My profile"
        title="Profile & account."
        description="Manage your staff details, login, and password."
      />
      <div className="space-y-6">
        {me.data?.profile ? <AgentProfileForm self={me.data} /> : null}
        <AccountSettings />
      </div>
    </AdminShell>
  );
}

function AgentProfileForm({ self }: { self: StaffSelf }) {
  const queryClient = useQueryClient();
  const specialtyOptions = AGENT_SPECIALTY_OPTIONS.map((s) => ({
    value: s,
    label: AGENT_SPECIALTY_LABELS[s],
  }));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateAgentSelfInput>({
    resolver: zodResolver(updateAgentSelfSchema),
    defaultValues: {
      specialty: self.profile?.specialty,
      region: self.profile?.region ?? '',
      bio: self.profile?.bio ?? '',
    },
  });

  useEffect(() => {
    if (self.profile) {
      reset({
        specialty: self.profile.specialty,
        region: self.profile.region ?? '',
        bio: self.profile.bio ?? '',
      });
    }
  }, [self.profile, reset]);

  const mut = useMutation({
    mutationFn: adminApi.updateMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSelf'] });
      toast.success('Profile saved.');
    },
    onError: (e) => toastApiError(e, 'Could not save your profile.'),
  });

  return (
    <Card variant="glass">
      <CardEyebrow>Staff profile</CardEyebrow>
      <CardTitle>Your role & focus area.</CardTitle>
      <p className="mt-3 max-w-xl text-sm text-ink-600">
        This is how you appear to the rest of the operations team. Account activation is managed by
        an administrator.
      </p>
      <form
        onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)}
        className="mt-6 grid md:grid-cols-2 gap-5"
      >
        <Field label="Specialty" error={errors.specialty?.message}>
          <Select {...register('specialty')} options={specialtyOptions} />
        </Field>
        <Field label="Region" error={errors.region?.message}>
          <Input {...register('region')} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Bio" error={errors.bio?.message}>
            <Textarea {...register('bio')} />
          </Field>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={mut.isPending || !isDirty}>
            {mut.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
