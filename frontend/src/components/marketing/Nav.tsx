'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Lockup } from '@/components/brand/Lockup';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth, useSignOut, type AuthUser } from '@/lib/auth-store';
import { homeForRole } from '@/lib/role-landing';
import { workersApi } from '@/lib/workers-api';
import { api, hydrateTokens } from '@/lib/api-client';

export function Nav() {
  const user = useAuth((s) => s.user);
  const signOut = useSignOut();
  // Server always renders the logged-out header; only switch after mount to
  // avoid an SSR/client hydration mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrateTokens();
    if (typeof window === 'undefined') return;
    const haveTokens = Boolean(window.localStorage.getItem('oak_tokens'));
    if (haveTokens && !useAuth.getState().user) {
      api
        .get<{ data: { user: AuthUser } }>('/auth/me')
        .then((r) => useAuth.setState({ user: r.data.user }))
        .catch(() => {});
    }
  }, []);

  const signedIn = mounted && user;

  // Avatar dropdown menu state — close on outside click or Escape.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Workers have an uploaded selfie — surface it as the header avatar. Other
  // roles fall back to the initials avatar.
  const isWorker = Boolean(signedIn) && user?.role === 'WORKER';
  const documents = useQuery({
    queryKey: ['navWorkerDocs'],
    queryFn: workersApi.listDocuments,
    enabled: isWorker,
  });
  const selfieDoc = (documents.data ?? []).find(
    (d) => d.category === 'SELFIE' && d.status === 'CLEAN',
  );
  const selfieUrl = useQuery({
    queryKey: ['navSelfieUrl', selfieDoc?.id],
    queryFn: () => workersApi.getDocumentUrl(selfieDoc!.id),
    enabled: isWorker && Boolean(selfieDoc),
  });
  const photoUrl = selfieUrl.data?.downloadUrl ?? null;

  return (
    <header className="sticky top-0 z-30 bg-cream-50/70 backdrop-blur-xl border-b border-ink/8 shadow-[0_1px_0_rgba(5,150,105,0.06)] supports-[backdrop-filter]:bg-cream-50/70">
      <div className="mx-auto w-4/5 px-6 h-16 flex items-center justify-between">
        <Lockup size="md" />
        <nav className="hidden md:flex items-center gap-8 text-sm text-ink-600">
          <Link href="#about" className="hover:text-ink transition">About</Link>
          <Link href="#workers" className="hover:text-ink transition">For carers</Link>
          <Link href="#employers" className="hover:text-ink transition">For employers</Link>
          <Link href="#trust" className="hover:text-ink transition">How we verify</Link>
        </nav>
        {signedIn ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-full border border-ink/8 bg-white py-1 pl-1 pr-2 transition hover:border-brand-500/40 hover:bg-cream-50"
            >
              <Avatar src={photoUrl} name={user.fullName} size="md" />
              <ChevronDown
                className={`h-4 w-4 text-ink-600 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-card"
              >
                <div className="px-4 py-3 border-b border-ink/8">
                  <p className="text-sm font-medium text-ink truncate">{user.fullName}</p>
                  <p className="text-xs text-muted truncate">{user.email}</p>
                </div>
                <Link
                  href={homeForRole(user.role)}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-600 hover:bg-brand-50 hover:text-brand-700 transition"
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  Dashboard
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink-600 hover:bg-terracotta-50 hover:text-terracotta-700 transition"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-ink-600 hover:text-ink hidden sm:inline">
              Sign in
            </Link>
            <Link href="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
