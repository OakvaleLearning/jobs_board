import type { ReactNode } from 'react';
import Link from 'next/link';
import { Lockup } from '@/components/brand/Lockup';

/** Shared shell for the static legal pages linked from registration (§6.1 Step 1). */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-100">
      <header className="border-b border-ink/8 h-16">
        <div className="mx-auto w-4/5 px-6 h-full flex items-center">
          <Link href="/">
            <Lockup size="md" />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-4/5 px-6 py-12 space-y-6">
        <h1 className="h-display text-3xl md:text-4xl">{title}</h1>
        <div className="space-y-4 text-sm leading-relaxed text-ink-600">{children}</div>
        <p className="pt-6 text-[11px] text-muted">
          Placeholder text pending final copy from the Oakvale legal team. Oakvale Learning Ltd ·
          jobs.oakvaleltd.com
        </p>
      </main>
    </div>
  );
}
