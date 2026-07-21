'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetSchema } from '@oakvale/shared/schema/auth';
import { z } from 'zod';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { toast, toastApiError, toastFormErrors } from '@/lib/toast';
import Link from 'next/link';

type FormValues = z.infer<typeof resetSchema>;

export default function ResetPage() {
  const router = useRouter();
  const params = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: params.get('email') ?? '' },
  });

  async function onSubmit(values: FormValues) {
    try {
      await api.post('/auth/reset-password', values);
      toast.success('Password reset. Please sign in.');
      router.push('/login');
    } catch (e) {
      toastApiError(e, 'Something went wrong.');
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-eyebrow text-muted">Set new password</p>
        <h1 className="h-display text-3xl md:text-4xl">Reset password.</h1>
      </div>
      <form onSubmit={handleSubmit(onSubmit, toastFormErrors)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} error={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="otp">6-digit code</Label>
          <Input id="otp" inputMode="numeric" maxLength={6} {...register('otp')} error={errors.otp?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register('newPassword')}
            error={errors.newPassword?.message}
          />
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </Button>
        <Link href="/login" className="block text-center text-sm text-muted hover:text-ink">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
