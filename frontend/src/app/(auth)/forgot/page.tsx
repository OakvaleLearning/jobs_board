'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotSchema } from '@oakvale/shared/schema/auth';
import { z } from 'zod';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { toastFormErrors } from '@/lib/toast';
import Link from 'next/link';

type FormValues = z.infer<typeof forgotSchema>;

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormValues>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit(values: FormValues) {
    await api.post('/auth/forgot-password', values).catch(() => null);
    setSent(true);
  }

  if (sent) {
    const email = getValues('email');
    return (
      <div className="space-y-4">
        <p className="text-eyebrow text-muted">Reset requested</p>
        <h1 className="h-display text-3xl md:text-4xl">Check your inbox.</h1>
        <p className="text-sm text-ink-600">
          If an account exists for <span className="text-ink">{email}</span>, we&rsquo;ve emailed a
          6-digit reset code.
        </p>
        <Link href={`/reset?email=${encodeURIComponent(email)}`} className="inline-block">
          <Button variant="outline">Enter reset code</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-eyebrow text-muted">Forgot password</p>
        <h1 className="h-display text-3xl md:text-4xl">Reset it.</h1>
        <p className="text-sm text-ink-600">
          We&rsquo;ll email a code that expires in ten minutes.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit, toastFormErrors)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Sending…' : 'Send reset code'}
        </Button>
        <Link href="/login" className="block text-center text-sm text-muted hover:text-ink">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
