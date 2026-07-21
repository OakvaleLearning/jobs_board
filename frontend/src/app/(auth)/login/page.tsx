'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@oakvale/shared/schema/auth';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { toastApiError, toastFormErrors } from '@/lib/toast';
import { useAuth, type AuthUser } from '@/lib/auth-store';
import { ROLE_LANDING } from '@/lib/role-landing';
import { TextLink } from '@/components/ui/Link';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuth((s) => s.setSession);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    try {
      const res = await api.post<{
        data: { accessToken: string; refreshToken: string; user: AuthUser };
      }>('/auth/login', values);
      setSession(res.data);
      const next = params.get('next') ?? ROLE_LANDING[res.data.user.role] ?? '/';
      router.push(next);
    } catch (e) {
      toastApiError(e, 'Something went wrong.');
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-eyebrow text-muted">Welcome back</p>
        <h1 className="h-display text-3xl md:text-4xl">Sign in.</h1>
        <p className="text-sm text-ink-600">
          New here? <TextLink href="/register">Create an account</TextLink>.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit, toastFormErrors)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot" className="text-[11px] text-muted hover:text-ink">
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
          />
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
