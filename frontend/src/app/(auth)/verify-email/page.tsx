'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { toast, toastApiError } from '@/lib/toast';
import { useAuth } from '@/lib/auth-store';
import { homeForRole } from '@/lib/role-landing';
import type { AuthUser } from '@/lib/auth-store';

type Status = 'verifying' | 'success' | 'error' | 'missing';

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'missing');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const setSession = useAuth((s) => s.setSession);
  // Guard against the effect firing twice (React 18 StrictMode) and burning the single-use token.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    api
      .post<{ data: { verified: boolean; accessToken: string; refreshToken: string; expiresIn: number; user: AuthUser } }>('/auth/verify-email', { token })
      .then((res) => {
        const { accessToken, refreshToken, user } = res.data;
        setSession({ user, accessToken, refreshToken });
        router.push(homeForRole(user.role));
      })
      .catch(() => setStatus('error'));
  }, [token, setSession, router]);

  async function onResend() {
    if (!email) {
      toast.error('Enter your email to receive a new link.');
      return;
    }
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('If that account needs verifying, a new link is on its way.');
    } catch (e) {
      toastApiError(e, 'Could not resend the link.');
    } finally {
      setResending(false);
    }
  }

  if (status === 'verifying') {
    return (
      <div className="space-y-4">
        <p className="text-eyebrow text-muted">Email verification</p>
        <h1 className="h-display text-3xl md:text-4xl">Verifying…</h1>
        <p className="text-sm text-ink-600">Confirming your email address. One moment.</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-4">
        <p className="text-eyebrow text-muted">Email verified</p>
        <h1 className="h-display text-3xl md:text-4xl">You&rsquo;re all set.</h1>
        <p className="text-sm text-ink-600">
          Your email address is confirmed. You can now sign in to your Oakvale account.
        </p>
        <Link href="/login" className="inline-block">
          <Button size="lg">Sign in</Button>
        </Link>
      </div>
    );
  }

  // 'error' (invalid/expired token) or 'missing' (no token in URL) — offer a resend.
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-eyebrow text-muted">Email verification</p>
        <h1 className="h-display text-3xl md:text-4xl">Link expired.</h1>
        <p className="text-sm text-ink-600">
          {status === 'missing'
            ? 'This page needs a verification link from your email.'
            : 'This verification link is invalid or has expired.'}{' '}
          Enter your email and we&rsquo;ll send a fresh one.
        </p>
      </div>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button onClick={onResend} size="lg" disabled={resending} className="w-full">
          {resending ? 'Sending…' : 'Send a new link'}
        </Button>
        <Link href="/login" className="block text-center text-sm text-muted hover:text-ink">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
