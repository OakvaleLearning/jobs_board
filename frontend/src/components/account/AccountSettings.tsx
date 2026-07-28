'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  updateAccountSchema,
  changePasswordSchema,
  type UpdateAccountInput,
  type ChangePasswordInput,
} from '@oakvale/shared/schema/auth';
import { Card, CardEyebrow, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Field } from '@/app/(worker)/worker/profile/SectionFrame';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import { accountApi } from '@/lib/account-api';
import { useAuth } from '@/lib/auth-store';
import { useHydratedTokens } from '@/lib/use-hydrated-tokens';

/**
 * Shared account panel used by every role's profile page: edit login identity
 * (full name, phone), see the read-only email, and change the password. Backed
 * by the auth module's /auth/me + /auth/change-password endpoints.
 */
export function AccountSettings() {
  const hydrated = useHydratedTokens();
  const me = useQuery({ queryKey: ['authMe'], queryFn: accountApi.me, enabled: hydrated });

  return (
    <div className="space-y-6">
      <AccountForm loading={me.isLoading} defaults={me.data} />
      <PasswordForm />
    </div>
  );
}

function AccountForm({
  loading,
  defaults,
}: {
  loading: boolean;
  defaults?: { fullName: string; email: string; phone?: string | null };
}) {
  const queryClient = useQueryClient();
  const updateUser = useAuth((s) => s.updateUser);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateAccountInput>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: { fullName: '', phone: '' },
  });

  // Hydrate the form once the current account loads.
  useEffect(() => {
    if (defaults) reset({ fullName: defaults.fullName, phone: defaults.phone ?? '' });
  }, [defaults, reset]);

  const mut = useMutation({
    mutationFn: accountApi.updateMe,
    onSuccess: (user) => {
      updateUser({ fullName: user.fullName, phone: user.phone });
      queryClient.invalidateQueries({ queryKey: ['authMe'] });
      reset({ fullName: user.fullName, phone: user.phone ?? '' });
      toast.success('Account details saved.');
    },
    onError: (e) => toastApiError(e, 'Could not save your account details.'),
  });

  return (
    <Card variant="glass">
      <CardEyebrow>Account</CardEyebrow>
      <CardTitle>Your login details.</CardTitle>
      <p className="mt-3 max-w-xl text-sm text-ink-600">
        This is the name and contact number tied to your login. Your email is used to sign in and
        can’t be changed here — contact support if it needs updating.
      </p>

      <form
        onSubmit={handleSubmit((v) => mut.mutate(v), toastFormErrors)}
        className="mt-6 grid md:grid-cols-2 gap-5"
      >
        <Field label="Full name" error={errors.fullName?.message} required>
          <Input {...register('fullName')} disabled={loading} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input type="tel" {...register('phone')} disabled={loading} />
        </Field>
        <Field label="Email" hint="Sign-in email — read only">
          <Input type="email" value={defaults?.email ?? ''} readOnly disabled />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={loading || mut.isPending || !isDirty}>
            {mut.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Local-only extension of the shared password schema to confirm the new password.
const passwordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string().min(1) })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'New passwords do not match.',
    path: ['confirmPassword'],
  });
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

function PasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mut = useMutation({
    mutationFn: (v: ChangePasswordInput) => accountApi.changePassword(v),
    onSuccess: () => {
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed. Other sessions have been signed out.');
    },
    onError: (e) => toastApiError(e, 'Could not change your password.'),
  });

  return (
    <Card variant="glass">
      <CardEyebrow>Security</CardEyebrow>
      <CardTitle>Change your password.</CardTitle>
      <p className="mt-3 max-w-xl text-sm text-ink-600">
        For your security, changing your password signs you out of every other device.
      </p>

      <form
        onSubmit={handleSubmit(
          (v) => mut.mutate({ currentPassword: v.currentPassword, newPassword: v.newPassword }),
          toastFormErrors,
        )}
        className="mt-6 grid md:grid-cols-2 gap-5"
      >
        <Field label="Current password" error={errors.currentPassword?.message} required className="md:col-span-2">
          <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <Field label="New password" error={errors.newPassword?.message} required>
          <Input type="password" autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword?.message} required>
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
